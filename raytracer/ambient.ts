import * as THREE from "three";

export class Ambient {
    public readonly horizonColor: THREE.Color = new THREE.Color();
    public readonly zenithColor: THREE.Color = new THREE.Color();
    public readonly fogColor: THREE.Color = new THREE.Color();
    public readonly fogSpreadness: number = 10.0;

    public readonly sunDirection: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    public sunIntensity: number = 1.0;

    public setHorizonColor(r: number, g: number, b: number): Ambient {
        this.horizonColor.set(r, g, b);
        return this;
    }
    
    public setZenithColor(r: number, g: number, b: number): Ambient {
        this.zenithColor.set(r, g, b);
        return this;
    }

    public setFogColor(r: number, g: number, b: number): Ambient {
        this.fogColor.set(r, g, b);
        return this;
    }

    public setfogSpreadness(v: number): Ambient {
        this.sunIntensity = v;
        return this;
    }
    
    public setSunDirection(x: number, y: number, z: number): Ambient {
        this.sunDirection.set(x, y, z);
        return this;
    }

    public setSunIntensity(v: number): Ambient {
        this.sunIntensity = v;
        return this;
    }
}