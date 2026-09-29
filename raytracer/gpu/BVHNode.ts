import * as THREE from "three";

export class BVHNode {
    public static readonly BYTE_SIZE = 64;
    
    public readonly min: THREE.Vector3 = new THREE.Vector3( Infinity,  Infinity,  Infinity);
    public readonly max: THREE.Vector3 = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    public left: number = -1;
    public right: number = -1;

    public firstTriangle: number = 0;
    public triangleCount: number = 0;

    public isLeaf(): boolean {
        return this.left === -1;
    }

    public write(
        buffer: ArrayBuffer,
        offset: number
    ): void {

        const view =
            new DataView(
                buffer,
                offset,
                BVHNode.BYTE_SIZE
            );

        // min

        view.setFloat32(
            0,
            this.min.x,
            true
        );

        view.setFloat32(
            4,
            this.min.y,
            true
        );

        view.setFloat32(
            8,
            this.min.z,
            true
        );

        // padding: 12

        // max

        view.setFloat32(
            16,
            this.max.x,
            true
        );

        view.setFloat32(
            20,
            this.max.y,
            true
        );

        view.setFloat32(
            24,
            this.max.z,
            true
        );

        // padding: 28

        // data

        view.setUint32(
            32,
            this.left < 0
                ? 0xffffffff
                : this.left,
            true
        );

        view.setUint32(
            36,
            this.right < 0
                ? 0xffffffff
                : this.right,
            true
        );

        view.setUint32(
            40,
            this.firstTriangle,
            true
        );

        view.setUint32(
            44,
            this.triangleCount,
            true
        );
    }
}