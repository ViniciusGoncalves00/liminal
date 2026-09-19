import { GPUCamera } from "./gpu-camera";
import { GPUScene } from "./gpu-scene";
import { GPUTriangle } from "./gpu-triangle";
import intersectTriangleShader from "./intersect-triangle.wgsl?raw";
import colorConversorShader from "./color.wgsl?raw";
import randomShader from "./random.wgsl?raw";
import mainShader from "./main.wgsl?raw";

export class ComputeRayTracer {

    public readonly outputTexture: GPUTexture;
    public readonly gpuTextureView: GPUTextureView;
    private timeBuffer: GPUBuffer | null = null;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;

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

        this.gpuTextureView =
            this.outputTexture.createView();

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

                    ${intersectTriangleShader}
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
            });

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

        this.device.queue.submit([
            encoder.finish()
        ]);
    }
}