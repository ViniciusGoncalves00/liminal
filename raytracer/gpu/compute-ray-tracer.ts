import { GPUCamera } from "./gpu-camera";
import { GPUScene } from "./gpu-scene";

export class ComputeRayTracer {
    public readonly outputTexture: GPUTexture;
    public readonly gpuTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;

    private readonly width: number;
    private readonly height: number;

    public constructor(device: GPUDevice, width: number, height: number) {
        this.device = device;
        this.width = width;
        this.height = height;

        this.outputTexture = device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT

        });
        this.gpuTextureView =this.outputTexture.createView();

        const module = device.createShaderModule({
            code: `
                struct Camera {
                    position : vec4<f32>,
                    forward  : vec4<f32>,
                    right    : vec4<f32>,
                    up       : vec4<f32>,
                    params   : vec4<f32>,
                };

                struct Triangle {
                    p0 : vec4<f32>,
                    p1 : vec4<f32>,
                    p2 : vec4<f32>,
                    materialId : u32,
                    _pad0 : u32,
                    _pad1 : u32,
                    _pad2 : u32,
                };
                        
                struct Material {
                    baseColor : vec4<f32>,
                    properties : vec4<f32>,
                };

                @group(0) @binding(0)
                var<uniform> camera : Camera;

                @group(0) @binding(1)
                var<storage, read> triangles : array<Triangle>;

                @group(0) @binding(2)
                var<storage, read> materials : array<Material>;

                @group(0) @binding(3)
                var outputTexture : texture_storage_2d<rgba16float, write>;

                @compute @workgroup_size(8,8)
                fn main(@builtin(global_invocation_id) id : vec3<u32>){
                    let size = textureDimensions(outputTexture);

                    if(id.x >= size.x || id.y >= size.y){
                        return;
                    }

                    let uv = vec2<f32>(id.xy) / vec2<f32>(size);

                    textureStore(
                        outputTexture,
                        vec2<i32>(id.xy),
                        vec4<f32>(uv,0.2,1.0)
                    );
                }
            `
        });

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d"
                    }
                }
            ]
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        this.pipeline = device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module,
                entryPoint: "main"
            }
        });
    }

    public render(gpuCamera: GPUCamera, gpuScene: GPUScene) {
        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: gpuCamera.buffer }
                },
                {
                    binding: 1,
                    resource: { buffer: gpuScene.triangleBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: gpuScene.materialBuffer }
                },
                {
                    binding: 3,
                    resource: this.gpuTextureView
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
    }
}