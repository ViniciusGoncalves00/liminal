import * as THREE from 'three';

export interface RayTracingRendererParameters extends THREE.WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    xRays?: number;
    yRays?: number;
}

export class RayTracingRenderer {
    public readonly domElement: HTMLCanvasElement;
    public readonly xRays: number;
    public readonly yRays: number;

    public constructor(parameters?: RayTracingRendererParameters | undefined) {
        this.domElement = (parameters?.canvas as HTMLCanvasElement) ?? document.createElement('canvas');
        this.xRays = parameters?.xRays ?? 10;
        this.yRays = parameters?.yRays ?? 10;
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        const canvas = this.domElement as HTMLCanvasElement;
        const context = canvas.getContext("2d")!;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const lookDirection = camera.getWorldDirection(new THREE.Vector3());
        lookDirection.normalize();

        const cellWidth = Math.floor(canvas.width / this.xRays);
        const cellHeight = Math.floor(canvas.height / this.yRays);

        for (let x = 0; x < canvas.width; x += cellWidth) {
            for (let y = 0; y < canvas.height; y += cellHeight) {
                const ndc = new THREE.Vector3(
                    (x + cellWidth / 2) / canvas.width * 2 - 1,
                    -((y + cellHeight / 2) / canvas.height * 2 - 1),
                    0.5
                );

                const worldPoint = ndc.unproject(camera);
                const direction = worldPoint.sub(camera.position).normalize();

                const r = (direction.x * 0.5 + 0.5) * 255;
                const g = (direction.y * 0.5 + 0.5) * 255;
                const b = (direction.z * 0.5 + 0.5) * 255;

                context.fillStyle = `rgb(${r}, ${g}, ${b})`;
                context.fillRect(x, y, cellWidth, cellHeight);
            }
        }
    }
}