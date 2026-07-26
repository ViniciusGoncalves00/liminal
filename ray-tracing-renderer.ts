import * as THREE from 'three';
import { TrianglesCollection } from './triangle-collection';
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
    public readonly rayBounces: number = 5;

    public readonly antiAliasingActive: boolean = true;
    private readonly jitter = new THREE.Vector3();

    private readonly cameraPosition = new THREE.Vector3();
    private readonly cameraForward = new THREE.Vector3();
    private readonly cameraRight = new THREE.Vector3();
    private readonly cameraUp = new THREE.Vector3();

    private readonly currentRayDirection = new THREE.Vector3();

    private cameraHalfWidth: number = 0;
    private cameraHalfHeight: number = 0;
    
    // #region SAVED
    private screenX: number = 0;
    private screenY: number = 0;

    private viewportY: number = 0;
    private viewportX: number = 0;

    private readonly tempRay = new THREE.Ray();
    private readonly tempDirection = new THREE.Vector3();
    private readonly tempColor = new THREE.Vector3();
    private readonly attenuation = new THREE.Vector3();
    private readonly hitData = new HitData();
    private readonly skyYellow = new THREE.Vector3(1.0, 0.75, 0.5);
    private readonly skyBlue = new THREE.Vector3(0.5, 0.75, 1.0);
    private readonly interval = new Interval(0.001, Infinity);
    // #endregion

    public readonly hittableCollection: TrianglesCollection = new TrianglesCollection();

    private canvasContext: CanvasRenderingContext2D;
    private imageData: ImageData;
    private pixels: Uint8ClampedArray;
    private colorInterval: Interval = new Interval(0, 1);

    private samplesPerPixel: number = 10;
    private pixelSamplesScale: number = 1 / this.samplesPerPixel;


    public constructor(parameters?: RayTracingRendererParameters | undefined) {
        this.domElement = (parameters?.canvas as HTMLCanvasElement) ?? document.createElement('canvas');
        this.xRays = parameters?.xRays ?? 10;
        this.yRays = parameters?.yRays ?? 10;

        this.canvasContext = this.domElement.getContext("2d")!;
        this.imageData = this.canvasContext.createImageData(this.domElement.width, this.domElement.height);
        this.pixels = this.imageData.data;
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.storeUpdatedCameraValues(camera);

        this.storedRay.origin.copy(camera.position);

        for (this.screenX = 0; this.screenX < this.domElement.width; this.screenX++) {
            for (this.screenY = 0; this.screenY < this.domElement.height; this.screenY++) {
                this.storeUpdatedScreenToViewportPoint();
                this.updateRayDirection();

                this.storedRay.direction.copy(this.currentRayDirection);

                const index = (this.screenY * this.domElement.width + this.screenX) * 4;

                this.storedRayColor.set(0, 0, 0);

                if (this.antiAliasingActive) {
                    this.applyAntiAliasing();
                } else {
                    this.storedRayColor.add(this.getRayColor(this.storedRay, this.rayBounces, this.hittableCollection));
                }

                this.writeColorIntoPixelArray(this.pixels, index, this.storedRayColor);
            }
        }

        this.canvasContext.putImageData(this.imageData, 0, 0);
    }

    public storeUpdatedCameraValues(camera: THREE.PerspectiveCamera): void {
        this.cameraPosition.copy(camera.position);
        camera.getWorldDirection(this.cameraForward);
        this.cameraRight.crossVectors(this.cameraForward, camera.up).normalize();
        this.cameraUp.crossVectors(this.cameraRight, this.cameraForward).normalize();

        this.cameraHalfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        this.cameraHalfWidth = this.cameraHalfHeight * camera.aspect;
    }

    public storeUpdatedScreenToViewportPoint(jitterX = 0, jitterY = 0): void {
        this.viewportX = ((this.screenX + 0.5 + jitterX) / this.domElement.width) * 2 - 1;
        this.viewportY = 1 - ((this.screenY + 0.5 + jitterY) / this.domElement.height) * 2;
    }

    public getRayColor(ray: THREE.Ray, bounces: number, world: TrianglesCollection): THREE.Vector3 {
        this.tempRay.origin.copy(ray.origin);
        this.tempRay.direction.copy(ray.direction);

        this.attenuation.set(1, 1, 1);

        for (let bounce = 0; bounce < bounces; bounce++) {
            if (!world.hit(this.tempRay, this.interval, this.hitData)) {

                const t = 0.5 * (this.tempRay.direction.y + 1);

                this.tempColor.copy(this.skyYellow);
                this.tempColor.lerp(this.skyBlue, t);
                this.tempColor.multiply(this.attenuation);

                return this.tempColor;
            }

            this.attenuation.multiplyScalar(0.5);

            this.tempDirection.copy(VectorUtils.randomOnSurface(this.hitData.normal));
            // this.tempDirection.copy(this.hitData.normal);
            // this.tempDirection.reflect(this.tempRay.direction);
            // this.tempDirection.addScaledVector(VectorUtils.randomVector(), 2).normalize();

            this.tempRay.origin.copy(this.hitData.point);
            this.tempRay.direction.copy(this.tempDirection);
        }

        this.tempColor.set(0, 0, 0);
        return this.tempColor;
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

    public randomizePixelJitter(): THREE.Vector3 {
        this.jitter.set(Math.random() - 0.5, Math.random() - 0.5, 0);
        return this.jitter;
    }

    public applyAntiAliasing() {
        for (let sample = 0; sample < this.samplesPerPixel; sample++) {
            this.randomizePixelJitter();
            this.storeUpdatedScreenToViewportPoint(this.jitter.x, this.jitter.y);
            this.updateRayDirection();

            this.storedRayColor.add(this.getRayColor(this.storedRay, this.rayBounces, this.hittableCollection));
        }
        this.storedRayColor.multiplyScalar(this.pixelSamplesScale);
    }

    private updateRayDirection(): void {
        this.currentRayDirection.copy(this.cameraForward);
        this.currentRayDirection.addScaledVector(this.cameraRight, this.viewportX * this.cameraHalfWidth);
        this.currentRayDirection.addScaledVector(this.cameraUp, this.viewportY * this.cameraHalfHeight);
        this.currentRayDirection.normalize();

        this.storedRay.direction.copy(this.currentRayDirection);
    }
}