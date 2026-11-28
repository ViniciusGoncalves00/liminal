import { GPUCamera } from "../gpu/gpu-camera";
import { GPUScene } from "../gpu/gpu-scene";
import { GPUTriangle } from "../gpu/gpu-triangle";
import { GPUMaterial } from "../gpu/gpu-material";
import { GPUAmbient } from "../gpu/gpu-ambient";
import { GPUSphere } from "../gpu/gpu-sphere";
import { BVHNode } from "../gpu/BVHNode";

import collisionShader from "../shader/collision.wgsl?raw";
import normalShader from "../shader/normal.wgsl?raw";

export class NormalAndDepthPass {
    public readonly normalTexture: GPUTexture;
    public readonly normalTextureView: GPUTextureView;

    public readonly depthTexture: GPUTexture;
    public readonly depthTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;
    private readonly bindGroupLayout: GPUBindGroupLayout;

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
        // Normal texture
        // ============================================================

        this.normalTexture = device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC,
        });

        this.normalTextureView = this.normalTexture.createView();

        // ============================================================
        // Depth texture
        // ============================================================

        this.depthTexture = device.createTexture({
            size: [width, height],
            format: "r32float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC,
        });

        this.depthTextureView = this.depthTexture.createView();

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

            ${collisionShader}

            ${normalShader}
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
                    storageTexture: {
                        access: "write-only",
                        format: "rgba16float",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "r32float",
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

    public render(
        gpuCamera: GPUCamera,
        gpuScene: GPUScene
    ): void {
        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: gpuCamera.buffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: gpuScene.triangleBuffer,
                    },
                },
                {
                    binding: 2,
                    resource: this.normalTextureView,
                },
                {
                    binding: 3,
                    resource: {
                        buffer: gpuScene.bvhBuffer,
                    },
                },
                {
                    binding: 4,
                    resource: {
                        buffer: gpuScene.sphereBuffer,
                    },
                },
                {
                    binding: 5,
                    resource: this.depthTextureView,
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
        this.normalTexture.destroy();
        this.depthTexture.destroy();
    }
}