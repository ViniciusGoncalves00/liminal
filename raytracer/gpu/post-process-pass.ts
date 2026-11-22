import colorConversorShader from "./color.wgsl?raw";
import randomShader from "./random.wgsl?raw";

export class PostProcessPass {
    public readonly outputTexture: GPUTexture;
    public readonly outputTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;
    private readonly bindGroupLayout: GPUBindGroupLayout;

    private readonly width: number;
    private readonly height: number;

    public constructor(device: GPUDevice, width: number, height: number) {
        this.device = device;
        this.width = width;
        this.height = height;

        // ============================================================
        // Output texture
        // ============================================================

        this.outputTexture = device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        });

        this.outputTextureView = this.outputTexture.createView();

        // ============================================================
        // Shader
        // ============================================================

        const module = device.createShaderModule({
            code: `
                ${colorConversorShader}
                ${randomShader}

                @group(0) @binding(0)
                var inputTexture: texture_2d<f32>;

                @group(0) @binding(1)
                var outputTexture: texture_storage_2d<rgba16float, write>;

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

                    var color = textureLoad(
                        inputTexture,
                        pixel,
                        0
                    );

                    let hsv = rgbToHsv(color.rgb);
                    let value = hsv[2];

                    var sum = vec4<f32>(0.0);
                    var sumCount = 0;

                    for (var x = -1i; x <= 1; x++) {
                        for (var y = -1i; y <= 1i; y++) {
                            sumCount++;
                            
                            var seed = id.x + id.y * textureSize.x * 1973u;
                            
                            let randomPixel = vec2<i32>(
                                i32(f32(id.x) + random(&seed) * 2),
                                i32(f32(id.y) + random(&seed) * 2)
                            );

                            let p = clamp(
                                randomPixel,
                                vec2<i32>(0),
                                vec2<i32>(textureSize) - 1
                            );

                            sum += textureLoad(
                                inputTexture,
                                p,
                                0
                            );
                        }
                    }

                    color += sum / f32(sumCount);

                    textureStore(
                        outputTexture,
                        pixel,
                        color
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
                        sampleType: "float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d",
                    },
                },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });

        // ============================================================
        // Compute pipeline
        // ============================================================

        this.pipeline = device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module,
                entryPoint: "main",
            },
        });
    }

    // ================================================================
    // Render
    // ================================================================

    public render(inputTexture: GPUTexture): void {
        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: inputTexture.createView(),
                },
                {
                    binding: 1,
                    resource: this.outputTextureView,
                },
            ],
        });

        const encoder = this.device.createCommandEncoder();

        const pass = encoder.beginComputePass();

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup);

        pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));

        pass.end();

        this.device.queue.submit([encoder.finish()]);
    }

    public dispose(): void {
        this.outputTexture.destroy();
    }
}
