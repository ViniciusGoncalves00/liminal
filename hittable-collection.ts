import type { Ray } from "three";
import { HitData } from "./hit-data";
import type { Hittable } from "./hittable";
import { Interval } from "./interval";

export class HitabbleCollection implements Hittable {
    public readonly objets: Hittable[] = [];

    public hit(ray: Ray, interval: Interval, hitData: HitData): boolean {
        const tempHitData: HitData = new HitData();
        let hitSomething = false;
        let closestSoFar = interval.max;

        const rayInterval = new Interval(interval.min, interval.max);

        for (let index = 0; index < this.objets.length; index++) {
            const hittable = this.objets[index];
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