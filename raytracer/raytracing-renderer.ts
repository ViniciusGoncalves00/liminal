import { GPUCamera } from "./gpu/gpu-camera";
import { GPUScene } from "./gpu/gpu-scene";
import { AccumulationPass } from "./gpu/accumulation-pass";
import { ComputeRayTracer } from "./gpu/compute-ray-tracer";
import { PresentPass } from "./gpu/present-pass";
import { ExposurePass } from "./gpu/exposure-pass";

export class RayTracingRenderer {
    private readonly computeRayTracing: ComputeRayTracer;
    private readonly exposurePass: ExposurePass;
    private readonly presentPass: PresentPass;
    private readonly accumulationPass: AccumulationPass;

    private readonly canvas: HTMLCanvasElement;

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.computeRayTracing = new ComputeRayTracer(device, this.canvas.width, this.canvas.height);
        this.exposurePass = new ExposurePass(device, context, format);
        this.presentPass = new PresentPass(device, context, format);
        this.accumulationPass = new AccumulationPass();
    }

    public render(deltaTime: number, gpuScene: GPUScene, gpuCamera: GPUCamera) {
        this.computeRayTracing.render(gpuCamera, gpuScene);
        this.presentPass.render(this.computeRayTracing.postProcessTexture);

        this.exposurePass.render(
            this.computeRayTracing.postProcessTexture,
            deltaTime
        );


        this.accumulationPass.nextFrame();
    }

    public setSize(width: number, height: number, updateStyle: boolean = true): void {}
}
