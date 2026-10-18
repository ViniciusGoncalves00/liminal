import * as THREE from "three";

export class GPUSky {
    private readonly device: GPUDevice;

    private static readonly FLOAT_COUNT = 11;
    private static readonly UINT_COUNT = 1;
    public static readonly BYTE_SIZE = GPUSky.FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT + GPUSky.UINT_COUNT * Uint32Array.BYTES_PER_ELEMENT;
    public static readonly SIZE = GPUSky.FLOAT_COUNT + GPUSky.UINT_COUNT;

    public static readonly SHADER: string = `
        struct SkyData {
            horizonColor : vec4<f32>,
            zenithColor : vec4<f32>,
            sunDirection : vec3<f32>,
            sunIntensity : f32,
        };
    `;

    public readonly horizonColor = new Float32Array(4);
    public readonly zenithColor = new Float32Array(4);
    public readonly sunDirection = new Float32Array(3);
    public readonly sunIntensity = new Float32Array(1);
    public readonly buffer: GPUBuffer;

    public constructor(device: GPUDevice, horizonColor?: THREE.Color, zenithColor?: THREE.Color, sunDirection?: THREE.Vector3, sunIntensity?: number) {
        this.device = device;
        this.buffer = this.device.createBuffer({
            size: GPUSky.BYTE_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.horizonColor[0] = horizonColor ? horizonColor.r : 1;
        this.horizonColor[1] = horizonColor ? horizonColor.g : 1;
        this.horizonColor[2] = horizonColor ? horizonColor.b : 1;
        this.horizonColor[3] = 0;

        this.zenithColor[0] = zenithColor ? zenithColor.r : 1;
        this.zenithColor[1] = zenithColor ? zenithColor.g : 1;
        this.zenithColor[2] = zenithColor ? zenithColor.b : 1;
        this.zenithColor[3] = 0;

        this.sunDirection[0] = sunDirection ? sunDirection.x : 0;
        this.sunDirection[1] = sunDirection ? sunDirection.y : 0;
        this.sunDirection[2] = sunDirection ? sunDirection.z : 0;

        this.sunIntensity[0] = sunIntensity ? sunIntensity : 0;
    }

    public setHorizonColor(color: THREE.Color): GPUSky {
        this.horizonColor[0] = color.r;
        this.horizonColor[1] = color.g;
        this.horizonColor[2] = color.b;
        return this;
    }

    public setZenithColor(color: THREE.Color): GPUSky {
        this.zenithColor[0] = color.r;
        this.zenithColor[1] = color.g;
        this.zenithColor[2] = color.b;
        return this;
    }

    public setSunDirection(direction: THREE.Vector3): GPUSky {
        this.sunDirection[0] = direction.x;
        this.sunDirection[1] = direction.y;
        this.sunDirection[2] = direction.z;
        return this;
    }

    public setSunIntensity(intensity: number): GPUSky {
        this.sunIntensity[0] = intensity;
        return this;
    }

    public write(array: Float32Array, floatOffset: number): number {
        array.set(this.horizonColor, floatOffset);
        floatOffset += 4;

        array.set(this.zenithColor, floatOffset);
        floatOffset += 4;

        array.set(this.sunDirection, floatOffset);
        floatOffset += 3;

        array.set(this.sunIntensity, floatOffset);
        floatOffset += 1;

        return floatOffset;
    }
}