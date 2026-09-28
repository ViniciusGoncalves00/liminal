import * as THREE from "three";
import { BVHNode } from "./BVHNode";
import type { GPUTriangle } from "./gpu-triangle";

export class BVHBuilder {
    public build(triangles: GPUTriangle[]): BVHNode[] {
        const nodes: BVHNode[] = []
        const indices = triangles.map((_, i) => i);

        this.buildNode(triangles, indices, 0, indices.length, nodes);

        return nodes;
    }

    private buildNode(triangles: GPUTriangle[], indices: number[], start: number, end: number, nodes: BVHNode[]): number {
        const nodeIndex = nodes.length;
        const node = new BVHNode();

        nodes.push(node);

        // 1. calcula AABB

        const box = new THREE.Box3();

        for (let i = start; i < end; i++) {
            const triangle = triangles[indices[i]];

            box.expandByPoint(triangle.p0);
            box.expandByPoint(triangle.p1);
            box.expandByPoint(triangle.p2);
            // this.expandBounds(node, triangle);
        }

        const count = end - start;

        // 2. folha

        const MAX_TRIANGLES = 4;

        if (count <= MAX_TRIANGLES) {

            node.firstTriangle = start;
            node.triangleCount = count;

            return nodeIndex;
        }

        // 3. escolhe eixo

        const axis =
            this.chooseSplitAxis(
                triangles,
                indices,
                start,
                end
            );

        // 4. ordena

        const slice = indices.slice(start, end);
        slice.sort((a, b) => {
            const ca = this.centroid(triangles[a]);
            const cb = this.centroid(triangles[b]);

            return ca.getComponent(axis) - cb.getComponent(axis);
        });

        for (let i = 0; i < slice.length; i++) {
            indices[start + i] = slice[i];
        }

        // 5. divide

        const middle = Math.floor((start + end) / 2);

        const left = this.buildNode(triangles, indices, start, middle, nodes);
        const right = this.buildNode(triangles, indices, middle, end, nodes);

        node.left = left;
        node.right = right;

        return nodeIndex;
    }

    private centroid(triangle: GPUTriangle): THREE.Vector3 {
        return new THREE.Vector3().add(triangle.p0).add(triangle.p1).add(triangle.p2).divideScalar(3);
    }

    private chooseSplitAxis(triangles: GPUTriangle[], indices: number[], start: number, end: number): 0 | 1 | 2 {
        const min = new THREE.Vector3( Infinity,  Infinity,  Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

        for (let i = start; i < end; i++) {
            const triangle = triangles[indices[i]];
            const centroid = this.centroid(triangle);

            min.min(centroid);
            max.max(centroid);
        }

        const extent = max.clone().sub(min);

        if (extent.x >= extent.y && extent.x >= extent.z) {
            return 0; // X
        }

        if (extent.y >= extent.z) {
            return 1; // Y
        }

        return 2; // Z
    }
}