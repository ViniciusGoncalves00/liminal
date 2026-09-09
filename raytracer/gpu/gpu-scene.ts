import * as THREE from "three";

export class GPUScene {
    private readonly device: GPUDevice

    public readonly triangles = new Float32Array(0);
    public readonly materials = new Float32Array(0);

    public triangleBuffer!: GPUBuffer;
    public materialBuffer!: GPUBuffer;

    private readonly triangleData: number[] = [];
    private readonly materialData: number[] = [];

    private readonly materialMap = new Map<THREE.Material, number>();

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

        const index = geometry.index;

        const world = mesh.matrixWorld;
        
        const materialId = this.addMaterial(mesh.material as THREE.Material);

        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                this.a.fromBufferAttribute(positions, index.getX(i)).applyMatrix4(world);
                this.b.fromBufferAttribute(positions, index.getX(i + 1)).applyMatrix4(world);
                this.c.fromBufferAttribute(positions, index.getX(i + 2)).applyMatrix4(world);

                this.pushTriangle(materialId);
            }
        }
        else {
            for (let i = 0; i < positions.count; i += 3) {

                this.a.fromBufferAttribute(positions, i).applyMatrix4(world);
                this.b.fromBufferAttribute(positions, i + 1).applyMatrix4(world);
                this.c.fromBufferAttribute(positions, i + 2).applyMatrix4(world);

                this.pushTriangle(materialId);
            }
        }

    }

    private pushTriangle(materialId: number): void {
        this.triangleData.push(
            this.a.x,
            this.a.y,
            this.a.z,

            this.b.x,
            this.b.y,
            this.b.z,

            this.c.x,
            this.c.y,
            this.c.z,

            materialId
        );

    }

    private addMaterial(material: THREE.Material): number {
        const existing = this.materialMap.get(material);

        if (existing !== undefined)
            return existing;

        const standard = material as THREE.MeshStandardMaterial;

        const id = this.materialMap.size;

        this.materialMap.set(material, id);

        this.materialData.push(

            standard.color.r,
            standard.color.g,
            standard.color.b,

            standard.roughness ?? 1,
            standard.metalness ?? 0,

            0,
            0,
            0

        );

        return id;

    }

    private uploadBuffers(): void {

        const triangles = new Float32Array(this.triangleData);
        const materials = new Float32Array(this.materialData);

        if (
            !this.triangleBuffer ||
            this.triangleBuffer.size < triangles.byteLength
        ) {

            this.triangleBuffer?.destroy();

            this.triangleBuffer = this.device.createBuffer({

                size: triangles.byteLength,

                usage:
                    GPUBufferUsage.STORAGE |
                    GPUBufferUsage.COPY_DST

            });

        }

        if (
            !this.materialBuffer ||
            this.materialBuffer.size < materials.byteLength
        ) {

            this.materialBuffer?.destroy();

            this.materialBuffer = this.device.createBuffer({

                size: materials.byteLength,

                usage:
                    GPUBufferUsage.STORAGE |
                    GPUBufferUsage.COPY_DST

            });

        }

        this.device.queue.writeBuffer(
            this.triangleBuffer,
            0,
            triangles
        );

        this.device.queue.writeBuffer(
            this.materialBuffer,
            0,
            materials
        );

    }

}