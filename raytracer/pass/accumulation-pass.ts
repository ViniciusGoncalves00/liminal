
export class AccumulationPass {
    private readonly device: GPUDevice;
    private readonly width: number;
    private readonly height: number;

    private readonly textures: GPUTexture[];
    private readonly textureViews: GPUTextureView[];

    private readonly paramsBuffer: GPUBuffer;
    private readonly bindGroupLayout: GPUBindGroupLayout;
    private readonly pipeline: GPUComputePipeline;

    private frameCount = 0;
    private readIndex = 0;

    public constructor(
        device: GPUDevice,
        width: number,
        height: number
    ) {
        this.device = device;
        this.width = width;
        this.height = height;

        // Duas texturas para acumulação ping-pong.
        this.textures = [0, 1].map(() =>
            device.createTexture({
                size: [width, height],
                format: "rgba16float",
                usage:
                    GPUTextureUsage.STORAGE_BINDING |
                    GPUTextureUsage.TEXTURE_BINDING
            })
        );

        this.textureViews = this.textures.map(
            texture => texture.createView()
        );

        // frameCount + padding: 16 bytes.
        this.paramsBuffer = device.createBuffer({
            size: 16,
            usage:
                GPUBufferUsage.UNIFORM |
                GPUBufferUsage.COPY_DST
        });

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d"
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d"
                    }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                        minBindingSize: 16
                    }
                }
            ]
        });

        const shader = device.createShaderModule({
            code: /* wgsl */ `
                struct Params {
                    frameCount: u32,
                    _padding0: u32,
                    _padding1: u32,
                    _padding2: u32
                };

                @group(0) @binding(0)
                var currentFrame: texture_2d<f32>;

                @group(0) @binding(1)
                var previousFrame: texture_2d<f32>;

                @group(0) @binding(2)
                var outputTexture: texture_storage_2d<
                    rgba16float,
                    write
                >;

                @group(0) @binding(3)
                var<uniform> params: Params;

                @compute @workgroup_size(8, 8)
                fn main(
                    @builtin(global_invocation_id) id: vec3<u32>
                ) {
                    let dimensions = textureDimensions(currentFrame);

                    if (
                        id.x >= dimensions.x ||
                        id.y >= dimensions.y
                    ) {
                        return;
                    }

                    let pixel = vec2<i32>(id.xy);

                    let current = textureLoad(
                        currentFrame,
                        pixel,
                        0
                    );

                    // Primeiro frame: não existe histórico válido.
                    if (params.frameCount == 1u) {
                        textureStore(
                            outputTexture,
                            pixel,
                            current
                        );
                        return;
                    }

                    let previous = textureLoad(
                        previousFrame,
                        pixel,
                        0
                    );

                    let weight = 1.0 / f32(params.frameCount);

                    let accumulated = previous + (current - previous) * weight;

                    textureStore(
                        outputTexture,
                        pixel,
                        accumulated
                    );
                }
            `
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout]
        });

        this.pipeline = device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module: shader,
                entryPoint: "main"
            }
        });
    }

    public render(inputTexture: GPUTexture): void {
        this.frameCount++;

        const writeIndex = 1 - this.readIndex;

        this.device.queue.writeBuffer(
            this.paramsBuffer,
            0,
            new Uint32Array([this.frameCount, 0, 0, 0])
        );

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: inputTexture.createView()
                },
                {
                    binding: 1,
                    resource: this.textureViews[this.readIndex]
                },
                {
                    binding: 2,
                    resource: this.textureViews[writeIndex]
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.paramsBuffer
                    }
                }
            ]
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

        this.device.queue.submit([encoder.finish()]);

        // A textura recém-escrita passa a ser o histórico.
        this.readIndex = writeIndex;
    }

    public reset(): void {
        this.frameCount = 0;
        this.readIndex = 0;
    }

    public get outputTexture(): GPUTexture {
        return this.textures[this.readIndex];
    }

    public get outputTextureView(): GPUTextureView {
        return this.textureViews[this.readIndex];
    }

    public get accumulatedFrames(): number {
        return this.frameCount;
    }

    public dispose(): void {
        for (const texture of this.textures) {
            texture.destroy();
        }

        this.paramsBuffer.destroy();
    }
}
