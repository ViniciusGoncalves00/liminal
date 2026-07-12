import * as THREE from 'three';
import type { Ray } from "three";
import type { Hittable } from "./hittable";
import { HitData } from './hit-data';
import type { Interval } from './interval';

export class Sphere implements Hittable {
    public readonly center: THREE.Vector3;
    public readonly radius: number;

    public constructor(center: THREE.Vector3, radius: number) {
        this.center = center;
        this.radius = radius;
    }

    public hit(ray: Ray, interval: Interval, hitData: HitData): boolean {
        const originToCenter = new THREE.Vector3().subVectors(this.center, ray.origin);
        const a = ray.direction.lengthSq();
        const h = ray.direction.dot(originToCenter);
        const c = originToCenter.lengthSq() - this.radius * this.radius;
        const discriminant = h * h - a * c;
        
        if (discriminant < 0) {
            return false;
        }

        const sqrtDiscriminant = Math.sqrt(discriminant);
        let root = (h - sqrtDiscriminant) / a;
        
        if (!interval.surrounds(root)) {
            root = (h + sqrtDiscriminant) / a;
            if (!interval.surrounds(root))
                return false;
        }

        const point = ray.at(root, new THREE.Vector3());
        const normal = point.clone().sub(this.center).divideScalar(this.radius);

        hitData.setPoint(point).setT(root).setFaceNormal(ray, normal)

        return true;
    }
}