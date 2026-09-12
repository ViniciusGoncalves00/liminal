import * as THREE from "three";
import { GPUTriangle } from "./gpu-triangle";

export class GPUScene {
    private readonly device: GPUDevice;

    public triangleBuffer!: GPUBuffer;
    public materialBuffer!: GPUBuffer;

    private readonly triangleData: GPUTriangle[] = [];
    private readonly materialData: Float32Array[] = [];

    private readonly materialMap =
        new Map<THREE.Material, number>();

    private readonly a = new THREE.Vector3();
    private readonly b = new THREE.Vector3();
    private readonly c = new THREE.Vector3();

    public constructor(device: GPUDevice) {
        this.device = device;
    }

    public update(scene: THREE.Scene): void {
        this.triangleData.length = 0;
        this.materialData.length = 0;
        this.materialMap.clear();

        scene.updateMatrixWorld(true);

        scene.traverse(object => {
            if (!(object instanceof THREE.Mesh))
                return;

            this.addMesh(object);
        });

        this.uploadBuffers();
    }

    private addMesh(mesh: THREE.Mesh): void {
        const geometry = mesh.geometry;

        if (!(geometry instanceof THREE.BufferGeometry))
            return;

        const positions = geometry.getAttribute("position");

        if (!positions)
            return;

        /*
         * Por enquanto suportamos apenas um material
         * por Mesh.
         */
        if (Array.isArray(mesh.material))
            throw new Error(
                "Multiple materials are not supported yet."
            );

        const material =
            mesh.material as THREE.MeshStandardMaterial;

        const materialId =
            this.addMaterial(material);

        const index = geometry.index;
        const world = mesh.matrixWorld;

        if (index) {

            for (let i = 0; i < index.count; i += 3) {

                this.a
                    .fromBufferAttribute(
                        positions,
                        index.getX(i)
                    )
                    .applyMatrix4(world);

                this.b
                    .fromBufferAttribute(
                        positions,
                        index.getX(i + 1)
                    )
                    .applyMatrix4(world);

                this.c
                    .fromBufferAttribute(
                        positions,
                        index.getX(i + 2)
                    )
                    .applyMatrix4(world);

                this.pushTriangle(materialId);
            }

        } else {

            for (let i = 0; i < positions.count; i += 3) {

                this.a
                    .fromBufferAttribute(
                        positions,
                        i
                    )
                    .applyMatrix4(world);

                this.b
                    .fromBufferAttribute(
                        positions,
                        i + 1
                    )
                    .applyMatrix4(world);

                this.c
                    .fromBufferAttribute(
                        positions,
                        i + 2
                    )
                    .applyMatrix4(world);

                this.pushTriangle(materialId);
            }
        }
    }

    private pushTriangle(materialId: number): void {
        this.triangleData.push(
            new GPUTriangle(
                this.a,
                this.b,
                this.c,
                materialId
            )
        );
    }

    private addMaterial(
        material: THREE.MeshStandardMaterial
    ): number {

        const existing =
            this.materialMap.get(material);

        if (existing !== undefined)
            return existing;

        const id = this.materialMap.size;

        this.materialMap.set(material, id);

        /*
         * WGSL:
         *
         * struct Material {
         *     baseColor : vec4<f32>,
         *     properties : vec4<f32>,
         * };
         */

        const data = new Float32Array(8);

        // baseColor
        data[0] = material.color.r;
        data[1] = material.color.g;
        data[2] = material.color.b;
        data[3] = material.opacity;

        // properties
        data[4] = material.roughness;
        data[5] = material.metalness;
        data[6] = material.emissiveIntensity;
        data[7] = 1.5; // IOR/reservado

        this.materialData.push(data);

        return id;
    }

    private uploadBuffers(): void {

        // ============================================================
        // TRIANGLES
        // ============================================================

        /*
         * Cada Triangle ocupa exatamente 64 bytes.
         */

        const triangleCount =
            this.triangleData.length;

        /*
         * Mantemos pelo menos um elemento para que
         * triangles[0] seja válido no shader.
         */
        const triangleBufferSize =
            Math.max(
                triangleCount,
                1
            ) * GPUTriangle.BYTE_SIZE;

        const triangleArrayBuffer =
            new ArrayBuffer(
                triangleBufferSize
            );

        for (
            let i = 0;
            i < triangleCount;
            i++
        ) {
            this.triangleData[i].write(
                triangleArrayBuffer,
                i * GPUTriangle.BYTE_SIZE
            );
        }

        // ============================================================
        // MATERIALS
        // ============================================================

        const materialCount =
            this.materialData.length;

        /*
         * Cada material possui 8 floats = 32 bytes.
         */
        const materialBufferSize =
            Math.max(materialCount, 1) * 8 * 4;

        const materialArrayBuffer =
            new ArrayBuffer(
                materialBufferSize
            );

        const materialFloats =
            new Float32Array(
                materialArrayBuffer
            );

        for (
            let i = 0;
            i < materialCount;
            i++
        ) {
            materialFloats.set(
                this.materialData[i],
                i * 8
            );
        }

        // ============================================================
        // GPU TRIANGLE BUFFER
        // ============================================================

        if (
            !this.triangleBuffer ||
            this.triangleBuffer.size <
                triangleBufferSize
        ) {

            this.triangleBuffer?.destroy();

            this.triangleBuffer =
                this.device.createBuffer({
                    size: triangleBufferSize,

                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_DST
                });
        }

        // ============================================================
        // GPU MATERIAL BUFFER
        // ============================================================

        if (
            !this.materialBuffer ||
            this.materialBuffer.size <
                materialBufferSize
        ) {

            this.materialBuffer?.destroy();

            this.materialBuffer =
                this.device.createBuffer({
                    size: materialBufferSize,

                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_DST
                });
        }

        // ============================================================
        // CPU -> GPU
        // ============================================================

        this.device.queue.writeBuffer(
            this.triangleBuffer,
            0,
            triangleArrayBuffer
        );

        this.device.queue.writeBuffer(
            this.materialBuffer,
            0,
            materialArrayBuffer
        );
    }
}