import * as THREE from 'three';

export class Ray {
    private readonly origin: THREE.Vector3;
    private readonly direction: THREE.Vector3;

    public constructor(origin: THREE.Vector3, direction: THREE.Vector3
    ) {
        this.origin = origin.clone();
        this.direction = direction.clone().normalize();
    }

    public at(t: number): THREE.Vector3 {
        return this.origin.clone().add(this.direction.clone().multiplyScalar(t));
    }
}