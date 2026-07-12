import type { Ray } from "three";
import type { HitData } from "./hit-data";

export interface Hittable {
    hit(ray: Ray, min: number, max: number, hitData: HitData): boolean;
}