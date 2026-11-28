
export class PostProcessPass {
    public readonly outputTexture: GPUTexture;
    public readonly outputTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;
    private readonly bindGroupLayout: GPUBindGroupLayout;

    private readonly thresholdBuffer: GPUBuffer;

    private readonly width: number;
    private readonly height: number;

    public constructor(
        device: GPUDevice,
        width: number,
        height: number
    ) {
        this.device = device;
        this.width = width;
        this.height = height;

        // ============================================================
        // Output texture
        // ============================================================

        this.outputTexture = device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.outputTextureView = this.outputTexture.createView();

        // ============================================================
        // Threshold buffer
        // ============================================================

        this.thresholdBuffer = device.createBuffer({
            size: 4,
            usage:
                GPUBufferUsage.UNIFORM |
                GPUBufferUsage.COPY_DST,
        });

        // ============================================================
        // Shader
        // ============================================================

        const module = device.createShaderModule({
            code: `
                struct FilterSettings {
                    threshold: f32,
                };

                @group(0) @binding(0)
                var inputTexture: texture_2d<f32>;

                @group(0) @binding(1)
                var normalTexture: texture_2d<f32>;

                @group(0) @binding(2)
                var outputTexture: texture_storage_2d<rgba16float, write>;

                @group(0) @binding(3)
                var<uniform> settings: FilterSettings;

                @compute @workgroup_size(8, 8)
                fn main(
                    @builtin(global_invocation_id) id: vec3<u32>
                ) {
                    let textureSize = textureDimensions(outputTexture);

                    if (
                        id.x >= textureSize.x ||
                        id.y >= textureSize.y
                    ) {
                        return;
                    }

                    let pixel = vec2<i32>(id.xy);

                    let centerColor = textureLoad(
                        inputTexture,
                        pixel,
                        0
                    );

                    let centerNormalData = textureLoad(
                        normalTexture,
                        pixel,
                        0
                    );

                    // Céu: mantém a cor original.
                    if (centerNormalData.a == 0.0) {
                        textureStore(
                            outputTexture,
                            pixel,
                            centerColor
                        );

                        return;
                    }

                    let centerNormal = normalize(centerNormalData.rgb);

                    var colorSum = vec4<f32>(0.0);
                    var sampleCount = 0.0;

                    for (var x = -1i; x <= 1i; x++) {
                        for (var y = -1i; y <= 1i; y++) {

                            let neighborPixel = pixel + vec2<i32>(x, y);

                            let p = clamp(
                                neighborPixel,
                                vec2<i32>(0),
                                vec2<i32>(textureSize) - 1
                            );

                            let neighborNormalData = textureLoad(
                                normalTexture,
                                p,
                                0
                            );

                            // Ignora pixels do céu.
                            if (neighborNormalData.a == 0.0) {
                                continue;
                            }

                            let neighborNormal = normalize(
                                neighborNormalData.rgb
                            );

                            let normalDifference = 1.0 - dot(
                                centerNormal,
                                neighborNormal
                            );

                            if (normalDifference > settings.threshold) {
                                continue;
                            }

                            colorSum += textureLoad(
                                inputTexture,
                                p,
                                0
                            );

                            sampleCount += 1.0;
                        }
                    }

                    let result = colorSum / max(sampleCount, 1.0);

                    textureStore(
                        outputTexture,
                        pixel,
                        result
                    );
                }
            `,
        });

        // ============================================================
        // Bind group layout
        // ============================================================

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });

        this.pipeline = device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module,
                entryPoint: "main",
            },
        });

        this.setThreshold(0.05);
    }

    // ================================================================
    // Threshold
    // ================================================================

    public setThreshold(value: number): void {
        this.device.queue.writeBuffer(
            this.thresholdBuffer,
            0,
            new Float32Array([value])
        );
    }

    // ================================================================
    // Render
    // ================================================================

    public render(
        inputTexture: GPUTexture,
        normalTexture: GPUTexture
    ): void {

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: inputTexture.createView(),
                },
                {
                    binding: 1,
                    resource: normalTexture.createView(),
                },
                {
                    binding: 2,
                    resource: this.outputTextureView,
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.thresholdBuffer,
                    },
                },
            ],
        });

        const encoder = this.device.createCommandEncoder();

        const pass = encoder.beginComputePass();

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup);

        pass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        pass.end();

        this.device.queue.submit([
            encoder.finish(),
        ]);
    }

    public dispose(): void {
        this.outputTexture.destroy();
        this.thresholdBuffer.destroy();
    }
}
