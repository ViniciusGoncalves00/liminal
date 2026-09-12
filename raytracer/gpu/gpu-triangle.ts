import * as THREE from "three";

export class Triangle {
    public readonly p0 = new THREE.Vector4();
    public readonly p1 = new THREE.Vector4();
    public readonly p2 = new THREE.Vector4();

    public materialId = 0;

    public static readonly BYTE_SIZE = 64;
    public static readonly FLOAT_COUNT = 16;

    public constructor(p0?: THREE.Vector3, p1?: THREE.Vector3, p2?: THREE.Vector3, materialId = 0) {
        if (p0) this.p0.set(p0.x, p0.y, p0.z, 1);
        if (p1) this.p1.set(p1.x, p1.y, p1.z, 1);
        if (p2) this.p2.set(p2.x, p2.y, p2.z, 1);

        this.materialId = materialId;
    }

    public set(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, materialId: number): this {
        this.p0.set(p0.x, p0.y, p0.z, 1);
        this.p1.set(p1.x, p1.y, p1.z, 1);
        this.p2.set(p2.x, p2.y, p2.z, 1);

        this.materialId = materialId;

        return this;
    }

    public write(buffer: ArrayBuffer, byteOffset = 0): void {
        const floats = new Float32Array(buffer, byteOffset, Triangle.FLOAT_COUNT);
        const uints = new Uint32Array(buffer, byteOffset, Triangle.FLOAT_COUNT);

        let i = 0;

        floats[i++] = this.p0.x;
        floats[i++] = this.p0.y;
        floats[i++] = this.p0.z;
        floats[i++] = this.p0.w;

        floats[i++] = this.p1.x;
        floats[i++] = this.p1.y;
        floats[i++] = this.p1.z;
        floats[i++] = this.p1.w;

        floats[i++] = this.p2.x;
        floats[i++] = this.p2.y;
        floats[i++] = this.p2.z;
        floats[i++] = this.p2.w;

        uints[i++] = this.materialId;

        uints[i++] = 0;
        uints[i++] = 0;
        uints[i++] = 0;
    }
}