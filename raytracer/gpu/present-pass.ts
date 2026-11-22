export class PresentPass {
    private readonly context: GPUCanvasContext;
    private readonly device: GPUDevice;
    private readonly pipeline: GPURenderPipeline;
    private readonly sampler: GPUSampler;
    private bindGroup?: GPUBindGroup;
    private currentTexture?: GPUTexture;

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
        this.device = device;
        this.context = context;
        this.sampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        const shader = device.createShaderModule({
            code: `
                struct VSOut {
                    @builtin(position)
                    position:vec4<f32>,

                    @location(0)
                    uv:vec2<f32>
                }

                @vertex
                fn vsMain(@builtin(vertex_index) vertexIndex:u32)->VSOut {
                    var pos = array<vec2<f32>,6>(
                        vec2(-1, -1),
                        vec2( 1, -1),
                        vec2(-1,  1),

                        vec2(-1,  1),
                        vec2( 1, -1),
                        vec2( 1,  1)
                    );

                    var uv = array<vec2<f32>,6>(
                        vec2(0, 1),
                        vec2(1, 1),
                        vec2(0, 0),

                        vec2(0, 0),
                        vec2(1, 1),
                        vec2(1, 0)

                    );

                    var out:VSOut;
                    out.position = vec4(pos[vertexIndex], 0, 1);
                    out.uv = uv[vertexIndex];
                    return out;
                }

                @group(0) @binding(0)
                var image:texture_2d<f32>;

                @group(0) @binding(1)
                var sample:sampler;

                @fragment
                fn fsMain(in:VSOut)->@location(0) vec4<f32>{
                    return textureSample(image, sample, in.uv);
                }
            `,
        });

        this.pipeline = device.createRenderPipeline({
            layout: "auto",

            vertex: {
                module: shader,
                entryPoint: "vsMain",
            },

            fragment: {
                module: shader,
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

    public render(texture: GPUTexture) {
        this.currentTexture = texture;

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: texture.createView(),
                },
                {
                    binding: 1,
                    resource: this.sampler,
                },
            ],
        });

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6);
        pass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}
