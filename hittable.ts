import type { Ray } from "three";
import type { HitData } from "./hit-data";
import type { Interval } from "./interval";

export interface Hittable {
    hit(ray: Ray, interval: Interval, hitData: HitData): boolean;
}