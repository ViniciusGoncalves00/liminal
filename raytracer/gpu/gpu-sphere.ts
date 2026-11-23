import * as THREE from "three";
import type { GPURepresentation } from "./gpu-representation";

export class GPUSphere implements GPURepresentation {
    public static readonly ELEMENTS_COUNT: number = 8;
    public static readonly BYTE_SIZE: number = GPUSphere.ELEMENTS_COUNT * Float32Array.BYTES_PER_ELEMENT;
    public static readonly SHADER: string = `
        struct Sphere {
            center : vec3<f32>,
            radius : f32,
            materialId : u32,
            _padding1 : u32,
            _padding2 : u32,
            _padding3 : u32,
        };
    `;

    public readonly data = new Array(GPUSphere.ELEMENTS_COUNT);

    public constructor() {
        this.setCenter(0, 0, 0);
        this.setRadius(0);
        this.setMaterialID(0);
        this.data[5] = 0;
        this.data[6] = 0;
        this.data[7] = 0;
    }

    public set(center: THREE.Vector3, radius: number, materialId: number): this {
        this.setCenter(...center.toArray());
        this.setRadius(radius);
        this.setMaterialID(materialId);
        return this;
    }

    public setCenter(x: number, y: number, z: number): this {
        this.data[0] = x;
        this.data[1] = y;
        this.data[2] = z;
        return this;
    }

    public setRadius(radius: number): this {
        this.data[3] = radius;
        return this;
    }

    public setMaterialID(id: number): this {
        this.data[4] = id;
        return this;
    }

    public write(buffer: ArrayBuffer, byteOffset: number): number {
        const view = new DataView(buffer);

        view.setFloat32((byteOffset += 0), this.data[0], true);
        view.setFloat32((byteOffset += 4), this.data[1], true);
        view.setFloat32((byteOffset += 4), this.data[2], true);
        view.setFloat32((byteOffset += 4), this.data[3], true);
        view.setUint32((byteOffset += 4), this.data[4], true);

        view.setUint32((byteOffset += 4), 0, true);
        view.setUint32((byteOffset += 4), 0, true);
        view.setUint32((byteOffset += 4), 0, true);

        return byteOffset += 4;
    }
}
