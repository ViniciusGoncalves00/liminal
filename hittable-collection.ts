import type { Ray } from "three";
import { HitData } from "./hit-data";
import type { Hittable } from "./hittable";

export class HitabbleCollection implements Hittable {
    public readonly objets: Hittable[] = [];

    public hit(ray: Ray, tMin: number, tMax: number, hitData: HitData): boolean {
        const tempHitData: HitData = new HitData();
        let hitSomething = false;
        let closestSoFar = tMax;

        this.objets.forEach(hittable => {
            if (!hittable.hit(ray, tMin, closestSoFar, tempHitData)) return;

            hitSomething = true;
            closestSoFar = tempHitData.t;
            hitData.setPoint(tempHitData.point);
            hitData.setT(tempHitData.t);
            hitData.setFaceNormal(ray, tempHitData.normal);
        })

        return hitSomething;
    }

        //     hit_record temp_rec;
        // bool hit_anything = false;
        // auto closest_so_far = ray_tmax;

        // for (const auto& object : objects) {
        //     if (object->hit(r, ray_tmin, closest_so_far, temp_rec)) {
        //         hit_anything = true;
        //         closest_so_far = temp_rec.t;
        //         rec = temp_rec;
        //     }
        // }

        // return hit_anything;
}