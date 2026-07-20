import * as THREE from 'three';
import { HitabbleCollection } from './hittable-collection';
import { HitData } from './hit-data';
import { Sphere } from './sphere';
import { Interval } from './interval';
import { VectorUtils } from './vector-utils';
import { Utils } from './utils';

export interface RayTracingRendererParameters extends THREE.WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    xRays?: number;
    yRays?: number;
}

export class RayTracingRenderer {
    public readonly domElement: HTMLCanvasElement;
    public readonly xRays: number;
    public readonly yRays: number;
    public readonly storedRay: THREE.Ray = new THREE.Ray();
    public readonly storedRayColor: THREE.Vector3 = new THREE.Vector3();

    public readonly antiAliasingActive: boolean = true;
    public readonly depth: number = 10;
    private readonly jitter = new THREE.Vector3();

    private readonly cameraPosition = new THREE.Vector3();
    private readonly cameraForward = new THREE.Vector3();
    private readonly cameraRight = new THREE.Vector3();
    private readonly cameraUp = new THREE.Vector3();

    private readonly tempDirection = new THREE.Vector3();

    private cameraHalfWidth: number = 0;
    private cameraHalfHeight: number = 0;

    private screenX: number = 0;
    private screenY: number = 0;

    private renderLoopX: number = 0;
    private renderLoopY: number = 0;

    public readonly hittableCollection: HitabbleCollection = new HitabbleCollection();

    private canvasContext: CanvasRenderingContext2D;
    private imageData: ImageData;
    private pixels: Uint8ClampedArray;
    private colorInterval: Interval = new Interval(0, 1);

    private samplesPerPixel: number = 5;
    private pixelSamplesScale: number = 1 / this.samplesPerPixel;

    public constructor(parameters?: RayTracingRendererParameters | undefined) {
        this.domElement = (parameters?.canvas as HTMLCanvasElement) ?? document.createElement('canvas');
        this.xRays = parameters?.xRays ?? 10;
        this.yRays = parameters?.yRays ?? 10;

        this.canvasContext = this.domElement.getContext("2d")!;
        this.imageData = this.canvasContext.createImageData(this.domElement.width, this.domElement.height);
        this.pixels = this.imageData.data;

        this.hittableCollection.objets.push(
            new Sphere(new THREE.Vector3(0, 0, -1), 1),
            new Sphere(new THREE.Vector3(0, 2.05, -1), 1),
        )
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.storeUpdatedCameraValues(camera);

        this.storedRay.origin.copy(camera.position);

        for (this.renderLoopX = 0; this.renderLoopX < this.domElement.width; this.renderLoopX++) {
            for (this.renderLoopY = 0; this.renderLoopY < this.domElement.height; this.renderLoopY++) {

                this.screenX = ((this.renderLoopX + 0.5) / this.domElement.width) * 2 - 1;
                this.screenY = 1 - ((this.renderLoopY + 0.5) / this.domElement.height) * 2;

                this.tempDirection.copy(this.cameraForward);
                this.tempDirection.addScaledVector(this.cameraRight, this.screenX * this.cameraHalfWidth);
                this.tempDirection.addScaledVector(this.cameraUp, this.screenY * this.cameraHalfHeight);
                this.tempDirection.normalize();

                this.storedRay.direction.copy(this.tempDirection);

                const index = (this.renderLoopY * this.domElement.width + this.renderLoopX) * 4;

                this.storedRayColor.set(0, 0, 0);

                if (this.antiAliasingActive) {
                    this.antiAliasing(camera, this.renderLoopX, this.renderLoopY);
                } else {
                    this.storedRayColor.add(this.getRayColor(this.storedRay, this.depth, this.hittableCollection));
                }

                this.writeColorIntoPixelArray(this.pixels, index, this.storedRayColor);
            }
        }

        this.canvasContext.putImageData(this.imageData, 0, 0);
    }

    public handlePixel(): void {

    }

    public storeUpdatedCameraValues(camera: THREE.PerspectiveCamera): void {
        this.cameraPosition.copy(camera.position);
        camera.getWorldDirection(this.cameraForward);
        this.cameraRight.crossVectors(this.cameraForward, camera.up).normalize();
        this.cameraUp.crossVectors(this.cameraRight, this.cameraForward).normalize();

        this.cameraHalfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        this.cameraHalfWidth = this.cameraHalfHeight * camera.aspect;
    }

    public getRayColor(ray: THREE.Ray, depth: number, hittableCollection: HitabbleCollection): THREE.Vector3 {
        if (depth <= 0) return new THREE.Vector3();

        const hitData = new HitData();
        if (hittableCollection.hit(ray, new Interval(0.001, Infinity), hitData)) {
            const direction = hitData.normal.clone().add(VectorUtils.randomUnitVector());
            return this.getRayColor(new THREE.Ray(hitData.point, direction), depth-1, hittableCollection).multiplyScalar(0.5);
        }

        const unitDirection = ray.direction.clone().normalize();

        const a = 0.5 * (unitDirection.y + 1.0);

        const white = new THREE.Vector3(1.0, 1.0, 1.0);
        const blue = new THREE.Vector3(0.5, 0.7, 1.0);

        return white.lerp(blue, a);
    }
    
    public writeColorIntoPixelArray(pixels: Uint8ClampedArray, index: number, color: THREE.Vector3, alphaValue: number = 1): void {
        const r = Utils.linearSpaceToGammaSpace(color.x);
        const g = Utils.linearSpaceToGammaSpace(color.y);
        const b = Utils.linearSpaceToGammaSpace(color.z);

        pixels[index + 0] = this.colorInterval.clamp(r) * 256;
        pixels[index + 1] = this.colorInterval.clamp(g) * 256;
        pixels[index + 2] = this.colorInterval.clamp(b) * 256;
        pixels[index + 3] = alphaValue * 256;
    }

    public pixelArrayToColor(pixels: Uint8ClampedArray, index: number): THREE.Vector3 {
        return new THREE.Vector3(pixels[index + 0], pixels[index + 1], pixels[index + 2]);
    }

    public randomizeJitterWithSquareSample(): THREE.Vector3 {
        this.jitter.set(Math.random() - 0.5,Math.random() - 0.5, 0);
        return this.jitter;
    }

    public antiAliasing(camera: THREE.PerspectiveCamera, x: number, y: number) {
        for (let sample = 0; sample < this.samplesPerPixel; sample++) {
            this.randomizeJitterWithSquareSample();
            this.generateRay(x, y, this.jitter.x, this.jitter.y);

            this.storedRayColor.add(this.getRayColor(this.storedRay, this.depth, this.hittableCollection));
        }
        this.storedRayColor.multiplyScalar(this.pixelSamplesScale);
    }

    private generateRay(pixelX: number,pixelY: number, jitterX = 0, jitterY = 0): void {
        this.screenX = ((pixelX + 0.5 + jitterX) / this.domElement.width) * 2 - 1;
        this.screenY = 1 - ((pixelY + 0.5 + jitterY) / this.domElement.height) * 2;

        this.tempDirection.copy(this.cameraForward);
        this.tempDirection.addScaledVector(this.cameraRight, this.screenX * this.cameraHalfWidth);
        this.tempDirection.addScaledVector(this.cameraUp, this.screenY * this.cameraHalfHeight);
        this.tempDirection.normalize();

        this.storedRay.direction.copy(this.tempDirection);
    }
}