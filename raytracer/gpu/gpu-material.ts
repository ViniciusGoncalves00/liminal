import * as THREE from "three";

export class GPUMaterial {
    public static readonly FLOAT_COUNT = 8;
    public static readonly BYTE_SIZE = GPUMaterial.FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT;
    public static readonly SHADER: string = `
        struct Material {
            baseColor : vec4<f32>,
            properties : vec4<f32>,
        };
    `;

    public readonly baseColor = new Float32Array(4);
    public readonly properties = new Float32Array(4);

    public constructor(material?: THREE.MeshPhysicalMaterial) {
        this.baseColor[0] = material ? material.color.r : 1;
        this.baseColor[1] = material ? material.color.g : 1;
        this.baseColor[2] = material ? material.color.b : 1;
        this.baseColor[3] = material ? material.opacity : 1;

        this.properties[0] = material ? material.roughness : 1;
        this.properties[1] = material ? material.metalness : 0;
        this.properties[2] = material ? material.emissiveIntensity : 0;
        this.properties[3] = material ? material.ior : 0;
    }

    public setFromMaterial(material: THREE.MeshPhysicalMaterial): this {
        this.baseColor[0] = material.color.r;
        this.baseColor[1] = material.color.g;
        this.baseColor[2] = material.color.b;
        this.baseColor[3] = material.opacity;

        this.properties[0] = material.roughness;
        this.properties[1] = material.metalness;
        this.properties[2] = material.emissiveIntensity;
        this.properties[3] = material.ior;

        return this;
    }

    public write(array: Float32Array, floatOffset: number): number {
        array.set(this.baseColor, floatOffset);
        floatOffset += 4;

        array.set(this.properties, floatOffset);
        floatOffset += 4;

        return floatOffset;
    }
}