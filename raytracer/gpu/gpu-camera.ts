import * as THREE from "three";

export class GPUCamera {
    public static readonly FLOAT_COUNT: number = 20;
    public static readonly BYTE_SIZE: number = GPUCamera.FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT;
    public static readonly SHADER: string = `
        struct Camera {
            position : vec4<f32>,
            forward  : vec4<f32>,
            right    : vec4<f32>,
            up       : vec4<f32>,
            params   : vec4<f32>,
        };
    `;

    public readonly buffer: GPUBuffer;

    private readonly device: GPUDevice;
    private readonly data = new Float32Array(GPUCamera.FLOAT_COUNT);
    private readonly forward = new THREE.Vector3();
    private readonly right = new THREE.Vector3();
    private readonly up = new THREE.Vector3();

    public constructor(device: GPUDevice) {
        this.device = device;

        this.buffer =
            device.createBuffer({
                size: GPUCamera.BYTE_SIZE,

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
}