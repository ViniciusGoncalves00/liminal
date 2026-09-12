import * as THREE from "three";
import { GPU_CAMERA_LAYOUT } from "./gpu-camera-layout";

export class GPUCamera {
    public readonly buffer: GPUBuffer;

    private readonly device: GPUDevice;
    private readonly data = new Float32Array(20);
    private readonly shader: string = "";

    private readonly forward = new THREE.Vector3();
    private readonly right = new THREE.Vector3();
    private readonly up = new THREE.Vector3();

    public constructor(device: GPUDevice) {
        this.device = device;

        this.buffer =
            device.createBuffer({
                size: GPU_CAMERA_LAYOUT.byteSize,

                usage:
                    GPUBufferUsage.UNIFORM |
                    GPUBufferUsage.COPY_DST
            });
    }

    public update(camera: THREE.PerspectiveCamera, aspect: number) {
        camera.updateMatrixWorld(true);
        camera.getWorldDirection(this.forward);

        this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

        const fovRadians = THREE.MathUtils.degToRad(camera.fov);
        const halfFovScale = Math.tan(fovRadians * 0.5);

        this.data.set([
            camera.position.x,
            camera.position.y,
            camera.position.z,
            0,

            this.forward.x,
            this.forward.y,
            this.forward.z,
            0,

            this.right.x,
            this.right.y,
            this.right.z,
            0,

            this.up.x,
            this.up.y,
            this.up.z,
            0,

            halfFovScale,
            aspect,
            0,
            0
        ]);

        this.device.queue.writeBuffer(
            this.buffer,
            0,
            this.data
        );
    }

    public updateShader(): string {
        return this.shader;
    }
}