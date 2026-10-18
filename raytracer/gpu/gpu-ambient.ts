import * as THREE from "three";

export class GPUAmbient {
    private readonly device: GPUDevice;

    private static readonly FLOAT_COUNT = 15;
    private static readonly UINT_COUNT = 1;
    public static readonly BYTE_SIZE = GPUAmbient.FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT + GPUAmbient.UINT_COUNT * Uint32Array.BYTES_PER_ELEMENT;
    public static readonly SIZE = GPUAmbient.FLOAT_COUNT + GPUAmbient.UINT_COUNT;

    public static readonly SHADER: string = `
        struct SkyData {
            horizonColor : vec3<f32>,
            _offset1: f32,
            zenithColor : vec3<f32>,
            _offset2: f32,
            fogColor : vec3<f32>,
            _offset3: f32,
            sunDirection : vec3<f32>,
            sunIntensity : f32,
        };
    `;

    public readonly horizonColor = new Float32Array(3);
    public readonly zenithColor = new Float32Array(3);
    public readonly fogColor = new Float32Array(3);
    public readonly sunDirection = new Float32Array(3);
    public readonly sunIntensity = new Float32Array(1);
    public readonly buffer: GPUBuffer;

    public constructor(device: GPUDevice, horizonColor?: THREE.Color, zenithColor?: THREE.Color, fogColor?: THREE.Color, sunDirection?: THREE.Vector3, sunIntensity?: number) {
        this.device = device;
        this.buffer = this.device.createBuffer({
            size: GPUAmbient.BYTE_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.horizonColor[0] = horizonColor ? horizonColor.r : 1;
        this.horizonColor[1] = horizonColor ? horizonColor.g : 1;
        this.horizonColor[2] = horizonColor ? horizonColor.b : 1;

        this.zenithColor[0] = zenithColor ? zenithColor.r : 1;
        this.zenithColor[1] = zenithColor ? zenithColor.g : 1;
        this.zenithColor[2] = zenithColor ? zenithColor.b : 1;

        this.fogColor[0] = fogColor ? fogColor.r : 1;
        this.fogColor[1] = fogColor ? fogColor.g : 1;
        this.fogColor[2] = fogColor ? fogColor.b : 1;

        this.sunDirection[0] = sunDirection ? sunDirection.x : 0;
        this.sunDirection[1] = sunDirection ? sunDirection.y : 0;
        this.sunDirection[2] = sunDirection ? sunDirection.z : 0;

        this.sunIntensity[0] = sunIntensity ? sunIntensity : 0;
    }

    public setHorizonColor(r: number, g: number, b: number): GPUAmbient {
        this.horizonColor[0] = r;
        this.horizonColor[1] = g;
        this.horizonColor[2] = b;
        return this;
    }

    public setZenithColor(r: number, g: number, b: number): GPUAmbient {
        this.zenithColor[0] = r;
        this.zenithColor[1] = g;
        this.zenithColor[2] = b;
        return this;
    }

    public setFogColor(r: number, g: number, b: number): GPUAmbient {
        this.fogColor[0] = r;
        this.fogColor[1] = g;
        this.fogColor[2] = b;
        return this;
    }

    public setSunDirection(x: number, y: number, z: number): GPUAmbient {
        this.sunDirection[0] = x;
        this.sunDirection[1] = y;
        this.sunDirection[2] = z;
        return this;
    }

    public setSunIntensity(intensity: number): GPUAmbient {
        this.sunIntensity[0] = intensity;
        return this;
    }

    public write(array: Float32Array, floatOffset: number): number {
        array.set(this.horizonColor, floatOffset);
        floatOffset += 4;

        array.set(this.zenithColor, floatOffset);
        floatOffset += 4;

        array.set(this.fogColor, floatOffset);
        floatOffset += 4;

        array.set(this.sunDirection, floatOffset);
        floatOffset += 3;

        array.set(this.sunIntensity, floatOffset);
        floatOffset += 1;

        return floatOffset;
    }
}