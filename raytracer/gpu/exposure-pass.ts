export class ExposurePass {
    private readonly context: GPUCanvasContext;
    private readonly device: GPUDevice;

    private readonly renderPipeline: GPURenderPipeline;
    private readonly luminancePipeline: GPUComputePipeline;
    private readonly exposurePipeline: GPUComputePipeline;

    private readonly sampler: GPUSampler;

    private readonly exposureBuffer: GPUBuffer;
    private readonly paramsBuffer: GPUBuffer;

    private partialBuffer?: GPUBuffer;
    private partialBufferSize = 0;

    private readonly workgroupSize = 8;
    private readonly reductionSize = 256;

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
        this.device = device;
        this.context = context;

        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // =====================================================
        // BUFFERS
        // =====================================================

        this.exposureBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.exposureBuffer, 0, new Float32Array([1.0, 0.0, 0.0, 0.0]));

        this.paramsBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // =====================================================
        // LUMINANCE COMPUTE SHADER
        // =====================================================

        const luminanceShader = device.createShaderModule({
            code: `
                struct Partial {
                    sum: f32,
                    count: u32,
                    padding: vec2<u32>,
                };

                @group(0) @binding(0)
                var image: texture_2d<f32>;

                @group(0) @binding(1)
                var<storage, read_write> partials: array<Partial>;

                var<workgroup> sums: array<f32, 64>;
                var<workgroup> counts: array<u32, 64>;

                @compute @workgroup_size(8, 8)
                fn csMain(
                    @builtin(global_invocation_id) id: vec3<u32>,
                    @builtin(local_invocation_index) localIndex: u32,
                    @builtin(workgroup_id) groupId: vec3<u32>
                ) {
                    let dimensions = textureDimensions(image);

                    var logLuminance = 0.0;
                    var pixelCount = 0u;

                    if (
                        id.x < dimensions.x &&
                        id.y < dimensions.y
                    ) {
                        let color = textureLoad(
                            image,
                            vec2<i32>(id.xy),
                            0
                        );

                        let luminance = dot(
                            color.rgb,
                            vec3<f32>(
                                0.2126,
                                0.7152,
                                0.0722
                            )
                        );

                        logLuminance = log(
                            max(luminance, 0.0001)
                        );

                        pixelCount = 1u;
                    }

                    // Store local results.
                    sums[localIndex] = logLuminance;
                    counts[localIndex] = pixelCount;

                    workgroupBarrier();

                    // Reduce 64 pixels into one partial result.
                    var stride = 32u;

                    loop {
                        if (localIndex < stride) {
                            sums[localIndex] +=
                                sums[localIndex + stride];

                            counts[localIndex] +=
                                counts[localIndex + stride];
                        }

                        workgroupBarrier();

                        if (stride == 1u) {
                            break;
                        }

                        stride = stride / 2u;
                    }

                    // One result per workgroup.
                    if (localIndex == 0u) {
                        let dimensions = textureDimensions(image);

                        let groupsX = (dimensions.x + 7u) / 8u;

                        let index =
                            groupId.y * groupsX + groupId.x;

                        partials[index].sum = sums[0];
                        partials[index].count = counts[0];
                        partials[index].padding = vec2<u32>(0u);
                    }
                }
            `,
        });

        this.luminancePipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: luminanceShader,
                entryPoint: "csMain",
            },
        });

        // =====================================================
        // EXPOSURE COMPUTE SHADER
        // =====================================================

        const exposureShader = device.createShaderModule({
            code: `
                struct Partial {
                    sum: f32,
                    count: u32,
                    padding: vec2<u32>,
                };

                struct ExposureData {
                    value: f32,
                    padding0: f32,
                    padding1: f32,
                    padding2: f32,
                };

                struct Params {
                    deltaTime: f32,
                    speedUp: f32,
                    speedDown: f32,
                    minExposure: f32,
                    maxExposure: f32,
                    keyValue: f32,
                    padding0: u32,
                    padding1: u32,
                };

                @group(0) @binding(0)
                var<storage, read> partials: array<Partial>;

                @group(0) @binding(1)
                var<storage, read_write> exposureData: ExposureData;

                @group(0) @binding(2)
                var<uniform> params: Params;

                var<workgroup> sums: array<f32, 256>;
                var<workgroup> counts: array<u32, 256>;

                @compute @workgroup_size(256)
                fn csMain(
                    @builtin(local_invocation_index) localIndex: u32
                ) {
                    let partialCount = arrayLength(&partials);

                    // Each thread accumulates multiple partials.
                    var localSum = 0.0;
                    var localCount = 0u;

                    var i = localIndex;

                    loop {
                        if (i >= partialCount) {
                            break;
                        }

                        localSum += partials[i].sum;
                        localCount += partials[i].count;

                        i += 256u;
                    }

                    sums[localIndex] = localSum;
                    counts[localIndex] = localCount;

                    workgroupBarrier();

                    // Reduce all partial results.
                    var stride = 128u;

                    loop {
                        if (localIndex < stride) {
                            sums[localIndex] +=
                                sums[localIndex + stride];

                            counts[localIndex] +=
                                counts[localIndex + stride];
                        }

                        workgroupBarrier();

                        if (stride == 1u) {
                            break;
                        }

                        stride = stride / 2u;
                    }

                    // Calculate target exposure.
                    if (localIndex == 0u) {
                        let averageLogLuminance =
                            sums[0] / f32(max(counts[0], 1u));

                        let averageLuminance =
                            exp(averageLogLuminance);

                        let targetExposure = clamp(
                            params.keyValue /
                            max(averageLuminance, 0.0001),
                            params.minExposure,
                            params.maxExposure
                        );

                        // Temporal adaptation.
                        let previousExposure = exposureData.value;

                        let speed = select(
                            params.speedDown,
                            params.speedUp,
                            targetExposure > previousExposure
                        );

                        let dt = clamp(
                            params.deltaTime,
                            0.0,
                            0.1
                        );

                        let blend = 1.0 - exp(-dt * speed);

                        exposureData.value = mix(
                            previousExposure,
                            targetExposure,
                            blend
                        );
                    }
                }
            `,
        });

        this.exposurePipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: exposureShader,
                entryPoint: "csMain",
            },
        });

        // =====================================================
        // RENDER SHADER
        // =====================================================

        const renderShader = device.createShaderModule({
            code: `
                struct ExposureData {
                    value: f32,
                    padding0: f32,
                    padding1: f32,
                    padding2: f32,
                };

                struct VSOut {
                    @builtin(position) position: vec4<f32>,
                    @location(0) uv: vec2<f32>,
                };

                @group(0) @binding(0)
                var image: texture_2d<f32>;

                @group(0) @binding(1)
                var sample: sampler;

                @group(0) @binding(2)
                var<storage, read> exposureData: ExposureData;

                @vertex
                fn vsMain(
                    @builtin(vertex_index) index: u32
                ) -> VSOut {
                    var out: VSOut;

                    let positions = array<vec2<f32>, 6>(
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 1.0, -1.0),
                        vec2<f32>(-1.0,  1.0),

                        vec2<f32>(-1.0,  1.0),
                        vec2<f32>( 1.0, -1.0),
                        vec2<f32>( 1.0,  1.0)
                    );

                    let position = positions[index];

                    out.position = vec4<f32>(
                        position,
                        0.0,
                        1.0
                    );

                    out.uv = vec2<f32>(
                        position.x * 0.5 + 0.5,
                        0.5 - position.y * 0.5
                    );

                    return out;
                }

                // ACES approximation.
                fn ACES(color: vec3<f32>) -> vec3<f32> {
                    let a = 2.51;
                    let b = 0.03;
                    let c = 2.43;
                    let d = 0.59;
                    let e = 0.14;

                    return clamp(
                        (color * (a * color + b)) /
                        (color * (c * color + d) + e),
                        vec3<f32>(0.0),
                        vec3<f32>(1.0)
                    );
                }

                @fragment
                fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
                    let color = textureSample(
                        image,
                        sample,
                        in.uv
                    );

                    // Apply exposure.
                    let exposedColor =
                        color.rgb * exposureData.value;

                    // Tone mapping.
                    let mappedColor = ACES(
                        max(exposedColor, vec3<f32>(0.0))
                    );

                    return vec4<f32>(
                        mappedColor,
                        color.a
                    );
                }
            `,
        });

        this.renderPipeline = device.createRenderPipeline({
            layout: "auto",

            vertex: {
                module: renderShader,
                entryPoint: "vsMain",
            },

            fragment: {
                module: renderShader,
                entryPoint: "fsMain",
                targets: [
                    {
                        format,
                    },
                ],
            },

            primitive: {
                topology: "triangle-list",
            },
        });
    }

    // =========================================================
    // RENDER
    // =========================================================

    public render(texture: GPUTexture, deltaTime: number) {
        const width = texture.width;
        const height = texture.height;

        const groupsX = Math.ceil(width / this.workgroupSize);

        const groupsY = Math.ceil(height / this.workgroupSize);

        const partialCount = groupsX * groupsY;

        // Allocate or resize partial buffer.
        const requiredSize = partialCount * 16;

        if (!this.partialBuffer || this.partialBufferSize < requiredSize) {
            this.partialBuffer?.destroy();

            this.partialBuffer = this.device.createBuffer({
                size: requiredSize,
                usage: GPUBufferUsage.STORAGE,
            });

            this.partialBufferSize = requiredSize;
        }

        // Update temporal parameters.
        const paramsData = new ArrayBuffer(32);

        const floats = new Float32Array(paramsData);

        floats[0] = deltaTime;
        floats[1] = 3.0; // Speed to adapt to brighter scenes.
        floats[2] = 1.5; // Speed to adapt to darker scenes.
        floats[3] = 1.0; // Minimum exposure.
        floats[4] = 5.0; // Maximum exposure.
        floats[5] = 0.18; // Middle gray.

        this.device.queue.writeBuffer(this.paramsBuffer, 0, paramsData);

        // =====================================================
        // BIND GROUPS
        // =====================================================

        const luminanceBindGroup = this.device.createBindGroup({
            layout: this.luminancePipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: texture.createView(),
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.partialBuffer,
                    },
                },
            ],
        });

        const exposureBindGroup = this.device.createBindGroup({
            layout: this.exposurePipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.partialBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.exposureBuffer,
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.paramsBuffer,
                    },
                },
            ],
        });

        const renderBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: texture.createView(),
                },
                {
                    binding: 1,
                    resource: this.sampler,
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.exposureBuffer,
                    },
                },
            ],
        });

        // =====================================================
        // COMMAND ENCODER
        // =====================================================

        const encoder = this.device.createCommandEncoder();

        // PASS 1: Luminance reduction.
        {
            const pass = encoder.beginComputePass();

            pass.setPipeline(this.luminancePipeline);
            pass.setBindGroup(0, luminanceBindGroup);

            pass.dispatchWorkgroups(groupsX, groupsY);

            pass.end();
        }

        // PASS 2: Exposure calculation and adaptation.
        {
            const pass = encoder.beginComputePass();

            pass.setPipeline(this.exposurePipeline);
            pass.setBindGroup(0, exposureBindGroup);

            pass.dispatchWorkgroups(1);

            pass.end();
        }

        // PASS 3: Exposure and tone mapping.
        {
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: this.context.getCurrentTexture().createView(),

                        loadOp: "clear",
                        storeOp: "store",
                    },
                ],
            });

            pass.setPipeline(this.renderPipeline);
            pass.setBindGroup(0, renderBindGroup);

            pass.draw(6);

            pass.end();
        }

        this.device.queue.submit([encoder.finish()]);
    }

    public dispose() {
        this.exposureBuffer.destroy();
        this.paramsBuffer.destroy();
        this.partialBuffer?.destroy();
    }
}
