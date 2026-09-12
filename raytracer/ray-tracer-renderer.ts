import * as THREE from 'three';
import { GPUCamera } from './gpu/gpu-camera';
import { GPUScene } from './gpu/gpu-scene';
import { AccumulationPass } from './gpu/accumulation-pass';
import { ComputeRayTracer } from './gpu/compute-ray-tracer';
import { PresentPass } from './gpu/present-pass';

export class RayTracerRenderer {
    private device: GPUDevice | null = null;
    private gpuCamera: GPUCamera | null = null;
    public gpuScene: GPUScene | null = null;
    private accumulationPass: AccumulationPass | null = null;
    private computeRayTracer: ComputeRayTracer | null = null;
    private presentPass: PresentPass | null = null;
    private canvas: HTMLCanvasElement | null = null;

    public async init(canvas: HTMLCanvasElement): Promise<void> {
        this.canvas = canvas;
        
        const adapter = await navigator.gpu.requestAdapter();
        if(!adapter) {
            console.log("Adapter cannot be found.");
            return;
        } 

        this.device = await adapter.requestDevice();
        const context = canvas.getContext("webgpu");

        if (!context) throw new Error("WebGPU not supported.");

        const format = navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            device: this.device,
            format,
            alphaMode: "opaque"
        });

        this.gpuCamera = new GPUCamera(this.device);
        this.gpuScene = new GPUScene(this.device);
        this.accumulationPass = new AccumulationPass();
        this.computeRayTracer = new ComputeRayTracer(this.device, this.canvas!.width, this.canvas!.height);
        this.presentPass = new PresentPass(this.device, context, format);

        this.device.addEventListener("uncapturederror", event => {
            console.error("My custom WebGPU error:", event.error);
        });
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.gpuCamera?.update(camera, this.canvas!.width / this.canvas!.height);
        this.gpuScene?.update(scene);
        
        this.computeRayTracer?.render(this.gpuCamera!, this.gpuScene!);
        this.presentPass?.render(this.computeRayTracer?.outputTexture!);
        
        this.accumulationPass?.nextFrame();
    }
}