import { GPUCamera } from "./gpu-camera";
import { GPUScene } from "./gpu-scene";
import { GPUTriangle } from "./gpu-triangle";
import { GPUMaterial } from "./gpu-material";
import { GPUAmbient } from "./gpu-ambient";
import { GPUSphere } from "./gpu-sphere";
import { BVHNode } from "./BVHNode";

import collisionShader from "./collision.wgsl?raw";
import colorConversorShader from "./color.wgsl?raw";
import randomShader from "./random.wgsl?raw";
import mainShader from "./main.wgsl?raw";

export class RayTracingPass {
    public readonly outputTexture: GPUTexture;
    public readonly outputTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;
    private readonly bindGroupLayout: GPUBindGroupLayout;

    private readonly timeBuffer: GPUBuffer;

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
        // Time buffer
        // ============================================================

        this.timeBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // ============================================================
        // Shader
        // ============================================================

        const shaderCode = `
            ${GPUCamera.SHADER}
            ${GPUTriangle.SHADER}
            ${GPUSphere.SHADER}
            ${GPUMaterial.SHADER}
            ${GPUAmbient.SHADER}
            ${BVHNode.SHADER}

            struct Time {
                value: f32,
            };

            ${collisionShader}
            ${colorConversorShader}
            ${randomShader}

            ${mainShader}
        `;

        const module = device.createShaderModule({
            code: shaderCode,
        });

        // ============================================================
        // Bind group layout
        // ============================================================

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 7,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
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

    public render(gpuCamera: GPUCamera, gpuScene: GPUScene): void {
        const time = performance.now() / 1000;

        this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([time]));

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: gpuCamera.buffer },
                },
                {
                    binding: 1,
                    resource: { buffer: gpuScene.triangleBuffer },
                },
                {
                    binding: 2,
                    resource: { buffer: gpuScene.materialBuffer },
                },
                {
                    binding: 3,
                    resource: this.outputTextureView,
                },
                {
                    binding: 4,
                    resource: { buffer: this.timeBuffer },
                },
                {
                    binding: 5,
                    resource: { buffer: gpuScene.bvhBuffer },
                },
                {
                    binding: 6,
                    resource: { buffer: gpuScene.gpuAmbient.buffer },
                },
                {
                    binding: 7,
                    resource: { buffer: gpuScene.sphereBuffer },
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
        this.timeBuffer.destroy();
    }
}
