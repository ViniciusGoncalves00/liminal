import { GPUCamera } from "./gpu-camera";
import { GPUScene } from "./gpu-scene";
import { GPUTriangle } from "./gpu-triangle";
import collisionShader from "./collision.wgsl?raw";
import colorConversorShader from "./color.wgsl?raw";
import randomShader from "./random.wgsl?raw";
import mainShader from "./main.wgsl?raw";

export class ComputeRayTracer {

    public readonly outputTexture: GPUTexture;
    public readonly postProcessTexture: GPUTexture;
    public readonly gpuTextureView: GPUTextureView;
    public readonly postProcessGpuTextureView: GPUTextureView;
    private timeBuffer: GPUBuffer | null = null;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;
    private readonly postProcessPipeline: GPUComputePipeline;

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
        // Output
        // ============================================================

        this.outputTexture =
            device.createTexture({
                size: [width, height],

                format: "rgba16float",

                usage:
                    GPUTextureUsage.STORAGE_BINDING |
                    GPUTextureUsage.TEXTURE_BINDING
            });

        this.timeBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.gpuTextureView = this.outputTexture.createView();

        // ============================================================
        // Shader
        // ============================================================

        const module =
            device.createShaderModule({
                code: `
                    ${GPUCamera.SHADER}
                    ${GPUTriangle.SHADER}

                    struct Material {
                        baseColor : vec4<f32>,
                        properties : vec4<f32>,
                    };

                    struct Time {
                        value: f32,
                    };

                    ${collisionShader}
                    ${colorConversorShader}
                    ${randomShader}
                    
                    ${mainShader}
                `
            });

        // ============================================================
        // Bind group layout
        // ============================================================

        const bindGroupLayout =
            device.createBindGroupLayout({

                entries: [

                    {
                        binding: 0,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "uniform"
                        }
                    },

                    {
                        binding: 1,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "read-only-storage"
                        }
                    },

                    {
                        binding: 2,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "read-only-storage"
                        }
                    },

                    {
                        binding: 3,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        storageTexture: {
                            access: "write-only",
                            format: "rgba16float",
                            viewDimension: "2d"
                        }
                    },

                    {
                        binding: 4,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "uniform"
                        }
                    }
                ]
            });

        const pipelineLayout =
            device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout
                ]
            });

        this.pipeline =
            device.createComputePipeline({

                layout: pipelineLayout,

                compute: {
                    module,
                    entryPoint: "main"
                }
            });

        this.postProcessTexture = device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING
        });

        this.postProcessGpuTextureView = this.postProcessTexture.createView();

        const postProcessModule =
            device.createShaderModule({
                code: `
                    ${colorConversorShader}

                    @group(0) @binding(0)
                    var inputTexture: texture_2d<f32>;
                                
                    @group(0) @binding(1)
                    var outputTexture: texture_storage_2d<rgba16float, write>;
                                
                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                        let size = textureDimensions(outputTexture);
                                
                        if (id.x >= size.x || id.y >= size.y) {
                            return;
                        }
                        
                        // var color = textureLoad(inputTexture, vec2<i32>(id.xy), 0);
                        // var colorHsv = rgbToHsv(vec3<f32>(color.rgb));
                        // var value = colorHsv[2];
                        
                        // if (value < 0.2 || value > 0.8) {
                        //     for (var x = -1i; x <= 1i; x++) {
                        //         for (var y = -1i; y <= 1i; y++) {
                        //             let p = vec2<i32>(id.xy) + vec2<i32>(x, y);
                        //             let clamped = clamp(
                        //                 p,
                        //                 vec2<i32>(0),
                        //                 vec2<i32>(size) - 1
                        //             );

                        //             color += textureLoad(inputTexture, clamped, 0);
                        //         }
                        //     }

                        //     color /= 9.0;
                        // }

                        // textureStore(
                        //     outputTexture,
                        //     vec2<i32>(id.xy),
                        //     color
                        // );
                                
                        textureStore(
                            outputTexture,
                            vec2<i32>(id.xy),
                            textureLoad(inputTexture, vec2<i32>(id.xy), 0)
                        );
                    }
                `
            });

        const postProcessBindGroupLayout =
            device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,

                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                },

                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,

                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d"
                    }
                }
            ]
        });

        const postProcessPipelineLayout =
            device.createPipelineLayout({
                bindGroupLayouts: [
                    postProcessBindGroupLayout
                ]
            });
        
        this.postProcessPipeline =
            device.createComputePipeline({
                layout: postProcessPipelineLayout,
            
                compute: {
                    module: postProcessModule,
                    entryPoint: "main"
                }
            });
    }

    public render(
        gpuCamera: GPUCamera,
        gpuScene: GPUScene
    ): void {
        const time = performance.now() / 1000;

        this.device?.queue.writeBuffer(
            this.timeBuffer!,
            0,
            new Float32Array([time])
        );

        const bindGroup =
            this.device.createBindGroup({

                layout:
                    this.pipeline.getBindGroupLayout(0),

                entries: [

                    {
                        binding: 0,

                        resource: {
                            buffer:
                                gpuCamera.buffer
                        }
                    },

                    {
                        binding: 1,

                        resource: {
                            buffer:
                                gpuScene.triangleBuffer
                        }
                    },

                    {
                        binding: 2,

                        resource: {
                            buffer:
                                gpuScene.materialBuffer
                        }
                    },

                    {
                        binding: 3,

                        resource:
                            this.gpuTextureView
                    },

                    {
                        binding: 4,

                        resource: {
                            buffer:
                                this.timeBuffer
                        }
                    }
                ]
            }
        );
        
        const postProcessBindGroup =
            this.device.createBindGroup({
                layout:
                    this.postProcessPipeline.getBindGroupLayout(0),
            
                entries: [
                    {
                        binding: 0,
                    
                        resource:
                            this.outputTexture.createView()
                    },
                
                    {
                        binding: 1,
                    
                        resource:
                            this.postProcessGpuTextureView
                    }
                ]
            }
        );

        const encoder =
            this.device.createCommandEncoder();

        const pass =
            encoder.beginComputePass();

        pass.setPipeline(
            this.pipeline
        );

        pass.setBindGroup(
            0,
            bindGroup
        );

        pass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        pass.end();

        const postProcessPass =
            encoder.beginComputePass();

        postProcessPass.setPipeline(
            this.postProcessPipeline
        );

        postProcessPass.setBindGroup(
            0,
            postProcessBindGroup
        );

        postProcessPass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        postProcessPass.end();

        this.device.queue.submit([
            encoder.finish()
        ]);
    }
}