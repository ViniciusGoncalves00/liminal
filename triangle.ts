import * as THREE from 'three';
import type { Hittable } from './hittable';
import type { HitData } from './hit-data';
import type { Interval } from './interval';

export class Triangle implements Hittable {

    public readonly p0: THREE.Vector3;
    public readonly p1: THREE.Vector3;
    public readonly p2: THREE.Vector3;

    public readonly material: THREE.Material;
    public readonly mesh: THREE.Mesh;

    private readonly edge1: THREE.Vector3;
    private readonly edge2: THREE.Vector3;
    private readonly normal: THREE.Vector3;

    private readonly pvec = new THREE.Vector3();
    private readonly tvec = new THREE.Vector3();
    private readonly qvec = new THREE.Vector3();
    private readonly point = new THREE.Vector3();

    private static readonly EPSILON = 1e-8;

    public constructor(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, material: THREE.Material, mesh: THREE.Mesh) {
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;

        this.material = material;
        this.mesh = mesh;

        this.edge1 = new THREE.Vector3().subVectors(p1, p0);
        this.edge2 = new THREE.Vector3().subVectors(p2, p0);
        this.normal = new THREE.Vector3().crossVectors(this.edge1, this.edge2).normalize();
    }

    public hit(ray: THREE.Ray,interval: Interval,hitData: HitData): boolean {
        this.pvec.crossVectors(ray.direction, this.edge2);

        const det = this.edge1.dot(this.pvec);

        if (Math.abs(det) < Triangle.EPSILON)
            return false;

        const invDet = 1 / det;

        this.tvec.subVectors(ray.origin, this.p0);

        const u = this.tvec.dot(this.pvec) * invDet;

        if (u < 0 || u > 1)
            return false;

        this.qvec.crossVectors(this.tvec, this.edge1);

        const v = ray.direction.dot(this.qvec) * invDet;

        if (v < 0 || u + v > 1)
            return false;

        const t = this.edge2.dot(this.qvec) * invDet;

        if (!interval.surrounds(t))
            return false;

        this.point
            .copy(ray.direction)
            .multiplyScalar(t)
            .add(ray.origin);

        hitData
            .setPoint(this.point)
            .setT(t)
            .setFaceNormal(ray, this.normal);

        return true;
    }
}