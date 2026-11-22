import { GPUCamera } from "./gpu/gpu-camera";
import { GPUScene } from "./gpu/gpu-scene";
import { AccumulationPass } from "./gpu/accumulation-pass";
import { PresentPass } from "./gpu/present-pass";
import { ExposurePass } from "./gpu/exposure-pass";
import { RayTracingPass } from "./gpu/raytracing-pass";
import { PostProcessPass } from "./gpu/post-process-pass";

export class RayTracingRenderer {
    private readonly rayTracingPass: RayTracingPass;
    private readonly postProcessPass: PostProcessPass;
    private readonly exposurePass: ExposurePass;
    private readonly presentPass: PresentPass;
    private readonly accumulationPass: AccumulationPass;

    private readonly canvas: HTMLCanvasElement;

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.rayTracingPass = new RayTracingPass(device, this.canvas.width, this.canvas.height);
        this.postProcessPass = new PostProcessPass(device, this.canvas.width, this.canvas.height);
        this.exposurePass = new ExposurePass(device, context, format);
        this.presentPass = new PresentPass(device, context, format);
        this.accumulationPass = new AccumulationPass();
    }

    public render(deltaTime: number, gpuScene: GPUScene, gpuCamera: GPUCamera) {
        this.rayTracingPass.render(gpuCamera, gpuScene);
        this.postProcessPass.render(this.rayTracingPass.outputTexture);
        this.presentPass.render(this.postProcessPass.outputTexture);

        this.exposurePass.render(this.postProcessPass.outputTexture, deltaTime);

        this.accumulationPass.nextFrame();
    }

    public setSize(width: number, height: number, updateStyle: boolean = true): void {}
}
