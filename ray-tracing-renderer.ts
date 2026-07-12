import * as THREE from 'three';
import { HitabbleCollection } from './hittable-collection';
import { HitData } from './hit-data';
import { Sphere } from './sphere';

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

    public readonly hittableCollection: HitabbleCollection = new HitabbleCollection();

    private canvasContext: CanvasRenderingContext2D;
    private imageData: ImageData;
    private pixels: Uint8ClampedArray;

    public constructor(parameters?: RayTracingRendererParameters | undefined) {
        this.domElement = (parameters?.canvas as HTMLCanvasElement) ?? document.createElement('canvas');
        this.xRays = parameters?.xRays ?? 10;
        this.yRays = parameters?.yRays ?? 10;

        this.canvasContext = this.domElement.getContext("2d")!;
        this.imageData = this.canvasContext.createImageData(this.domElement.width, this.domElement.height);
        this.pixels = this.imageData.data;

        this.hittableCollection.objets.push(
            new Sphere(new THREE.Vector3(0, 0, -1), 1),
            new Sphere(new THREE.Vector3(0, 3, -1), 1),
        )
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        const lookDirection = camera.getWorldDirection(new THREE.Vector3());
        lookDirection.normalize();

        const cellWidth = Math.floor(this.domElement.width / this.xRays);
        const cellHeight = Math.floor(this.domElement.height / this.yRays);

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const halfWidth = halfHeight * camera.aspect;

        this.ray.origin.copy(camera.position);

        const direction = new THREE.Vector3();
        let u, v, r, g, b;

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

                [r, g, b] = this.rayColor(this.ray, this.hittableCollection);

                this.pixels[index + 0] = r;
                this.pixels[index + 1] = g;
                this.pixels[index + 2] = b;
                this.pixels[index + 3] = 255;
            }
        }

        this.canvasContext.putImageData(this.imageData, 0, 0);
    }

    // public hitSphere(ray: THREE.Ray, sphereCenter: THREE.Vector3, sphereRadius: number): number {
    //     const originToCenter = new THREE.Vector3().subVectors(sphereCenter, ray.origin);
    //     const a = ray.direction.lengthSq();
    //     const h = ray.direction.dot(originToCenter);
    //     const c = originToCenter.lengthSq() - sphereRadius * sphereRadius;
    //     const discriminant = h * h - a * c;

    //     if (discriminant < 0) {
    //         return -1.0;
    //     } else {
    //         return (h - Math.sqrt(discriminant) ) / a;
    //     }
    // }

    public rayColor(ray: THREE.Ray, hittableCollection: HitabbleCollection): [number, number, number] {
        let r, g, b;
        
        const hitData = new HitData();
        if (hittableCollection.hit(ray, 0, Infinity, hitData)) {
            r = 0.5 * (hitData.normal.x + 1) * 255;
            g = 0.5 * (hitData.normal.y + 1) * 255;
            b = 0.5 * (hitData.normal.z + 1) * 255;
        } else {
            r = (ray.direction.x * 0.5 + 0.5) * 255;
            g = (ray.direction.y * 0.5 + 0.5) * 255;
            b = (ray.direction.z * 0.5 + 0.5) * 255;
        }
        return [r, g, b];
    }
}