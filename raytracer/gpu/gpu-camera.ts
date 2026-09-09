import * as THREE from 'three';

export class GPUCamera {
    private readonly device: GPUDevice;
    private readonly data: Float32Array = new Float32Array(20);
    public readonly buffer: GPUBuffer;

    public constructor(device: GPUDevice) {
        this.device = device;
        this.buffer = device.createBuffer({
            size: this.data.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    public update(camera: THREE.PerspectiveCamera) {
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();

        camera.getWorldDirection(forward);

        right.crossVectors(forward, camera.up).normalize();
        up.crossVectors(right, forward).normalize();

        const tanHalfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        const tanHalfWidth = tanHalfHeight * camera.aspect;

        this.data.set([
            camera.position.x,
            camera.position.y,
            camera.position.z,
            0,

            forward.x,
            forward.y,
            forward.z,
            0,

            right.x,
            right.y,
            right.z,
            0,

            up.x,
            up.y,
            up.z,
            0,

            tanHalfWidth,
            tanHalfHeight,
            camera.near,
            camera.far
        ]);

        this.device.queue.writeBuffer(
            this.buffer,
            0,
            this.data
        );
    }

}