import * as THREE from "three";

export class GPUMaterial {
    // vec4<f32>
    public readonly baseColor = new Float32Array(4);

    // vec4<f32>
    public readonly properties = new Float32Array(4);

    public constructor() {

        // Cor
        this.baseColor[0] = 1; // R
        this.baseColor[1] = 1; // G
        this.baseColor[2] = 1; // B
        this.baseColor[3] = 1; // A

        // Propriedades
        this.properties[0] = 1; // Roughness
        this.properties[1] = 0; // Metallic
        this.properties[2] = 0; // Emissive Strength
        this.properties[3] = 1; // IOR ou reservado
    }

    public setFromMaterial(material: THREE.MeshStandardMaterial): this {

        this.baseColor[0] = material.color.r;
        this.baseColor[1] = material.color.g;
        this.baseColor[2] = material.color.b;
        this.baseColor[3] = material.opacity;

        this.properties[0] = material.roughness;
        this.properties[1] = material.metalness;
        this.properties[2] = material.emissiveIntensity;
        this.properties[3] = 1.5; // índice de refração padrão

        return this;
    }

    public write(array: Float32Array, offset: number): number {

        array.set(this.baseColor, offset);
        offset += 4;

        array.set(this.properties, offset);
        offset += 4;

        return offset;
    }

    public static readonly FLOAT_COUNT = 8;
    public static readonly BYTE_SIZE = GPUMaterial.FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT;

}