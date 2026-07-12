import * as THREE from 'three';

export class HitData {
    public point: THREE.Vector3 = new THREE.Vector3();
    public normal: THREE.Vector3 = new THREE.Vector3(); 
    public t: number = 0;
    public frontFace: boolean = true;

    public setPoint(point: THREE.Vector3): HitData {
        this.point = point;
        return this;
    }

    public setT(t: number): HitData {
        this.t = t;
        return this;
    }

    public setFaceNormal(ray: THREE.Ray, normal: THREE.Vector3): HitData {
        this.frontFace = ray.direction.dot(normal) < 0;
        this.normal = this.frontFace ? normal : normal.clone().multiplyScalar(-1);
        return this;
    }
}