import * as THREE from 'three';
import { Triangle } from './triangle';
import type { Hittable } from './hittable';
import { HitData } from './hit-data';
import { Interval } from './interval';

export class TrianglesCollection implements Hittable {
    public readonly triangles: Triangle[] = [];

    public addObject(scene: THREE.Scene): void {
        this.triangles.length = 0;

        scene.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;

            const geometry = object.geometry;

            if (!(geometry instanceof THREE.BufferGeometry)) return;

            const positions = geometry.getAttribute("position");
            const indices = geometry.index;

            object.updateWorldMatrix(true, false);

            const world = object.matrixWorld;

            if (indices) {
                for (let i = 0; i < indices.count; i += 3) {

                    const a = new THREE.Vector3()
                        .fromBufferAttribute(positions, indices.getX(i))
                        .applyMatrix4(world);

                    const b = new THREE.Vector3()
                        .fromBufferAttribute(positions, indices.getX(i + 1))
                        .applyMatrix4(world);

                    const c = new THREE.Vector3()
                        .fromBufferAttribute(positions, indices.getX(i + 2))
                        .applyMatrix4(world);

                    this.triangles.push(new Triangle(a, b, c, object.material, object));
                }
            } else {
                for (let i = 0; i < positions.count; i += 3) {

                    const a = new THREE.Vector3()
                        .fromBufferAttribute(positions, i)
                        .applyMatrix4(world);

                    const b = new THREE.Vector3()
                        .fromBufferAttribute(positions, i + 1)
                        .applyMatrix4(world);

                    const c = new THREE.Vector3()
                        .fromBufferAttribute(positions, i + 2)
                        .applyMatrix4(world);

                    this.triangles.push(new Triangle(a, b, c, object.material, object));
                }
            }
        });
    }

    public hit(ray: THREE.Ray, interval: Interval, hitData: HitData): boolean {
        const tempHitData: HitData = new HitData();
        let hitSomething = false;
        let closestSoFar = interval.max;

        const rayInterval = new Interval(interval.min, interval.max);

        for (let index = 0; index < this.triangles.length; index++) {
            const hittable = this.triangles[index];
            if (!hittable.hit(ray, rayInterval, tempHitData)) continue;
            
            hitSomething = true;
            closestSoFar = tempHitData.t;
            rayInterval.max = closestSoFar;

            hitData.setPoint(tempHitData.point);
            hitData.setT(tempHitData.t);
            hitData.setFaceNormal(ray, tempHitData.normal);
        }

        return hitSomething;
    }
}