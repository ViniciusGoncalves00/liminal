
import * as THREE from "three";
import type { GPURepresentation } from "./gpu-representation";

export class GPUTriangle implements GPURepresentation {
    public static readonly ELEMENTS_COUNT = 16;
    public static readonly BYTE_SIZE = GPUTriangle.ELEMENTS_COUNT * Float32Array.BYTES_PER_ELEMENT;
    public static readonly SHADER: string = `
        struct Triangle {
            p0 : vec4<f32>,
            p1 : vec4<f32>,
            p2 : vec4<f32>,
            normal : vec3<f32>,
            materialId : u32,
        };
    `;

    public readonly data = new Array<number>(GPUTriangle.ELEMENTS_COUNT);
    public p0: THREE.Vector3 = new THREE.Vector3();
    public p1: THREE.Vector3 = new THREE.Vector3();
    public p2: THREE.Vector3 = new THREE.Vector3();
    public normal: THREE.Vector3 = new THREE.Vector3();

    public set(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, normal: THREE.Vector3, materialId: number): this {
        this.setP0(p0);
        this.setP1(p1);
        this.setP2(p2);
        this.setNormal(normal);
        this.setMaterialID(materialId);

        return this;
    }

    public setP0(v: THREE.Vector3): this {
        this.p0.copy(v);

        this.data[0] = v.x;
        this.data[1] = v.y;
        this.data[2] = v.z;
        this.data[3] = 1;

        return this;
    }

    public setP1(v: THREE.Vector3): this {
        this.p1.copy(v);

        this.data[4] = v.x;
        this.data[5] = v.y;
        this.data[6] = v.z;
        this.data[7] = 1;

        return this;
    }

    public setP2(v: THREE.Vector3): this {
        this.p2.copy(v);

        this.data[8] = v.x;
        this.data[9] = v.y;
        this.data[10] = v.z;
        this.data[11] = 1;

        return this;
    }

    public setNormal(v: THREE.Vector3): this {
        this.normal.copy(v);

        this.data[12] = v.x;
        this.data[13] = v.y;
        this.data[14] = v.z;

        return this;
    }

    public setMaterialID(id: number): this {
        this.data[15] = id;

        return this;
    }

    public write(buffer: ArrayBuffer, byteOffset = 0): number {
        const view = new DataView(buffer);

        for (let i = 0; i < 15; i++) {
            view.setFloat32(
                byteOffset + i * Float32Array.BYTES_PER_ELEMENT,
                this.data[i],
                true
            );
        }

        view.setUint32(
            byteOffset + 15 * Float32Array.BYTES_PER_ELEMENT,
            this.data[15],
            true
        );

        return byteOffset + GPUTriangle.BYTE_SIZE;
    }
}