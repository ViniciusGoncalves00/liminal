import * as THREE from "three";

export class BVHNode {
    public readonly min: THREE.Vector3 = new THREE.Vector3( Infinity,  Infinity,  Infinity);
    public readonly max: THREE.Vector3 = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    public left: number = -1;
    public right: number = -1;

    public firstTriangle: number = 0;
    public triangleCount: number = 0;

    public isLeaf(): boolean {
        return this.left === -1;
    }
}