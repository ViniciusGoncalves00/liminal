import * as THREE from 'three';
import { HitabbleCollection } from './hittable-collection';
import { HitData } from './hit-data';
import { Sphere } from './sphere';
import { Interval } from './interval';

export interface RayTracingRendererParameters extends THREE.WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    xRays?: number;
    yRays?: number;
}

export class RayTracingRenderer {
    public readonly domElement: HTMLCanvasElement;
    public readonly xRays: number;
    public readonly yRays: number;
    public readonly ray: THREE.Ray = new THREE.Ray();
    public readonly rayColor: THREE.Vector3 = new THREE.Vector3();

    public readonly hittableCollection: HitabbleCollection = new HitabbleCollection();

    private canvasContext: CanvasRenderingContext2D;
    private imageData: ImageData;
    private pixels: Uint8ClampedArray;
    private lastFramepixels: Uint8ClampedArray;
    private colorInterval: Interval = new Interval(0, 255);

    private samplesPerPixel: number = 10;
    private pixelSamplesScale: number = 1 / this.samplesPerPixel;
    private sampleRadius: number = 3;

    public constructor(parameters?: RayTracingRendererParameters | undefined) {
        this.domElement = (parameters?.canvas as HTMLCanvasElement) ?? document.createElement('canvas');
        this.xRays = parameters?.xRays ?? 10;
        this.yRays = parameters?.yRays ?? 10;

        this.canvasContext = this.domElement.getContext("2d")!;
        this.imageData = this.canvasContext.createImageData(this.domElement.width, this.domElement.height);
        this.pixels = this.imageData.data;
        this.lastFramepixels = this.imageData.data;

        this.hittableCollection.objets.push(
            new Sphere(new THREE.Vector3(0, 0, -1), 1),
            new Sphere(new THREE.Vector3(0, 3, -1), 1),
        )
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        const lookDirection = camera.getWorldDirection(new THREE.Vector3());
        lookDirection.normalize();

        // const cellWidth = Math.floor(this.domElement.width / this.xRays);
        // const cellHeight = Math.floor(this.domElement.height / this.yRays);

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const halfWidth = halfHeight * camera.aspect;

        this.ray.origin.copy(camera.position);

        const direction = new THREE.Vector3();
        let u, v;

        // for (let x = 0; x < this.domElement.width; x += cellWidth) {
        //     for (let y = 0; y < this.domElement.height; y += cellHeight) {
        //         u = ((x + 0.5) / this.domElement.width) * 2 - 1;
        //         v = 1 - ((y + 0.5) / this.domElement.height) * 2;

        //         direction.copy(forward);
        //         direction.addScaledVector(right, u * halfWidth);
        //         direction.addScaledVector(up, v * halfHeight);

        //         this.ray.setDirection(direction);

        //         const index = (y * this.domElement.width + x) * 4;

        //         [r, g, b] = this.rayColor(this.ray);

        //         this.pixels[index + 0] = r;
        //         this.pixels[index + 1] = g;
        //         this.pixels[index + 2] = b;
        //         this.pixels[index + 3] = 255;

        //         for (let i = 0; i < cellWidth; i++) {
        //             for (let j = 0; j < cellHeight; j++) {
        //                 this.pixels[index + 0 + i * 4 + j * this.domElement.width * 4] = r;
        //                 this.pixels[index + 1 + i * 4 + j * this.domElement.width * 4] = g;
        //                 this.pixels[index + 2 + i * 4 + j * this.domElement.width * 4] = b;
        //                 this.pixels[index + 3 + i * 4 + j * this.domElement.width * 4] = 255;
        //             }
        //         }
        //     }
        // }

        for (let x = 0; x < this.domElement.width; x++) {
            for (let y = 0; y < this.domElement.height; y++) {
                u = ((x + 0.5) / this.domElement.width) * 2 - 1;
                v = 1 - ((y + 0.5) / this.domElement.height) * 2;

                direction.copy(forward);
                direction.addScaledVector(right, u * halfWidth);
                direction.addScaledVector(up, v * halfHeight);

                this.ray.direction.copy(direction);

                const index = (y * this.domElement.width + x) * 4;

                const color = new THREE.Vector3();
                this.setRayColor(this.ray, this.hittableCollection);
                color.add(this.rayColor);

                // for (let sample = 0; sample < this.samplesPerPixel; sample++) {
                //     this.randomizeRayDirection(x, y);
                //     this.setRayColor(this.ray, this.hittableCollection);
                //     color.add(this.rayColor);
                // }

                for (let i = -this.sampleRadius; i < this.sampleRadius; i++) {
                    for (let j = -this.sampleRadius; j < this.sampleRadius; j++) {
                        const samePixel = i === 0 && j === 0;
                        if (samePixel) continue;

                        const outsideX = x + i < 0 || x + i > this.domElement.width;
                        if (outsideX) continue;

                        const outsideY = y + j < 0 || y + j > this.domElement.height;
                        if (outsideY) continue;

                        const previousColor = this.restoreColor(this.lastFramepixels, index);
                        previousColor.multiplyScalar(0.015);
                        color.add(previousColor);
                    }
                }

                // this.writeColor(this.pixels, index, color.multiplyScalar(this.pixelSamplesScale));
                this.writeColor(this.pixels, index, color)
            }
        }

        this.canvasContext.putImageData(this.imageData, 0, 0);
        this.lastFramepixels.set(this.pixels);
    }

    public setRayColor(ray: THREE.Ray, hittableCollection: HitabbleCollection): void{
        const hitData = new HitData();
        if (hittableCollection.hit(this.ray, new Interval(0, Infinity), hitData)) {
            this.rayColor.set(
                0.5 * (hitData.normal.x + 1) * 255,
                0.5 * (hitData.normal.y + 1) * 255,
                0.5 * (hitData.normal.z + 1) * 255,
            )
            return;
        }

        this.rayColor.set(
            (ray.direction.x * 0.5 + 0.5) * 255,
            (ray.direction.y * 0.5 + 0.5) * 255,
            (ray.direction.z * 0.5 + 0.5) * 255,
        )
    }

    public randomizeRayDirection(x: number, y: number): void {
        const offset = this.sampleSquare();

        offset.x += x;
        offset.y += y;

        this.ray.direction.sub(offset);
    }

    public sampleSquare(): THREE.Vector3 {
        return new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0);
    }

    public randomInInterval(min: number, max: number): number {
        return  min + (max - min) * Math.random();
    }

    public writeColor(pixels: Uint8ClampedArray, index: number, color: THREE.Vector3): void {
        pixels[index + 0] = this.colorInterval.clamp(color.x);
        pixels[index + 1] = this.colorInterval.clamp(color.y);
        pixels[index + 2] = this.colorInterval.clamp(color.z);
        pixels[index + 3] = 255;
    }

    public restoreColor(pixels: Uint8ClampedArray, index: number): THREE.Vector3 {
        return new THREE.Vector3(pixels[index + 0], pixels[index + 1], pixels[index + 2]);
    }
}