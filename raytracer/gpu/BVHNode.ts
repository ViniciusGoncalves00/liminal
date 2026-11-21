import * as THREE from "three";

export class BVHNode {
    public static readonly ELEMENTS_COUNT = 16;
    public static readonly BYTE_SIZE = BVHNode.ELEMENTS_COUNT * Float32Array.BYTES_PER_ELEMENT;
    public static readonly SHADER: string = `
        struct BVHNode {
            min : vec4<f32>,
            max : vec4<f32>,
            data : vec4<u32>,
            padding : vec4<u32>,
        };
    `;

    public readonly min: THREE.Vector3 = new THREE.Vector3(Infinity, Infinity, Infinity);
    public readonly max: THREE.Vector3 = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    public left: number = -1;
    public right: number = -1;

    public firstTriangle: number = 0;
    public triangleCount: number = 0;

    public isLeaf(): boolean {
        return this.left === -1;
    }

    public write(buffer: ArrayBuffer, offset: number): number {
        const view = new DataView(buffer, offset, BVHNode.BYTE_SIZE);

        view.setFloat32(0, this.min.x, true);
        view.setFloat32(4, this.min.y, true);
        view.setFloat32(8, this.min.z, true);

        view.setFloat32(16, this.max.x, true);
        view.setFloat32(20, this.max.y, true);
        view.setFloat32(24, this.max.z, true);

        view.setUint32(32, this.left < 0 ? 0xffffffff : this.left, true);
        view.setUint32(36, this.right < 0 ? 0xffffffff : this.right, true);

        view.setUint32(40, this.firstTriangle, true);
        view.setUint32(44, this.triangleCount, true);

        return offset + BVHNode.BYTE_SIZE;
    }
}
