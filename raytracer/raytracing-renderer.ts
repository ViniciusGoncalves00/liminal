import { GPUCamera } from "./gpu/gpu-camera";
import { GPUScene } from "./gpu/gpu-scene";
import { AccumulationPass } from "./pass/accumulation-pass";
import { PresentPass } from "./pass/present-pass";
import { ExposurePass } from "./pass/exposure-pass";
import { RayTracingPass } from "./pass/raytracing-pass";
import { PostProcessPass } from "./pass/post-process-pass";
import { NormalPass } from "./pass/normal-pass";

export class RayTracingRenderer {
    private readonly rayTracingPass: RayTracingPass;
    private readonly postProcessPass: PostProcessPass;
    private readonly normalPass: NormalPass;
    private readonly exposurePass: ExposurePass;
    private readonly presentPass: PresentPass;
    private readonly accumulationPass: AccumulationPass;

    private readonly canvas: HTMLCanvasElement;

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.rayTracingPass = new RayTracingPass(device, this.canvas.width, this.canvas.height);
        this.postProcessPass = new PostProcessPass(device, this.canvas.width, this.canvas.height);
        this.normalPass = new NormalPass(device, this.canvas.width, this.canvas.height);
        this.exposurePass = new ExposurePass(device, context, format);
        this.presentPass = new PresentPass(device, context, format);
        this.accumulationPass = new AccumulationPass(device, this.canvas.width, this.canvas.height);

        window.addEventListener("resetAccumulation", () => this.accumulationPass.reset());
    }

    public render(deltaTime: number, gpuScene: GPUScene, gpuCamera: GPUCamera) {
        this.rayTracingPass.render(gpuCamera, gpuScene);
        this.normalPass.render(gpuCamera, gpuScene);
        this.postProcessPass.render(this.rayTracingPass.outputTexture, this.normalPass.outputTexture);

        this.accumulationPass.render(this.postProcessPass.outputTexture);
        
        this.presentPass.render(this.accumulationPass.outputTexture);
        this.exposurePass.render(this.accumulationPass.outputTexture, deltaTime);
    }

    public setSize(width: number, height: number, updateStyle: boolean = true): void {}
}
