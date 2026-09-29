import type { BVHNode } from "./BVHNode";
import type { GPUTriangle } from "./gpu-triangle";

export interface BVHBuildResult {
    nodes: BVHNode[];
    triangles: GPUTriangle[];
}