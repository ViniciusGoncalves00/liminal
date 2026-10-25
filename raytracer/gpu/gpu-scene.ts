import * as THREE from "three";
import { GPUTriangle } from "./gpu-triangle";
import { BVHNode } from "./BVHNode";
import { BVHBuilder } from "./BVHBuilder";
import { GPUAmbient } from "./gpu-ambient";
import { GPUSphere } from "./gpu-sphere";
import { GPUMaterial } from "./gpu-material";

export class GPUScene {
    private readonly device: GPUDevice;

    public triangleBuffer!: GPUBuffer;
    public sphereBuffer!: GPUBuffer;
    public materialBuffer!: GPUBuffer;
    public bvhBuffer!: GPUBuffer;
    public skyBuffer!: GPUBuffer;
    public gpuAmbient: GPUAmbient;
    private bvhData: BVHNode[] = [];

    private readonly triangleData: GPUTriangle[] = [];
    private readonly sphereData: GPUSphere[] = [];
    private readonly materialData: GPUMaterial[] = [];

    private readonly materialMap = new Map<THREE.Material, number>();

    private readonly tempP0 = new THREE.Vector3();
    private readonly tempP1 = new THREE.Vector3();
    private readonly tempP2 = new THREE.Vector3();
    private readonly tempNormal = new THREE.Vector3();

    public constructor(device: GPUDevice) {
        this.device = device;
        this.gpuAmbient = new GPUAmbient(device);
    }

    public update(scene: THREE.Scene): void {
        this.triangleData.length = 0;
        this.sphereData.length = 0;
        this.materialData.length = 0;
        this.bvhData.length = 0;

        this.materialMap.clear();

        scene.updateMatrixWorld(true);

        scene.traverse(object => {
            if (!(object instanceof THREE.Mesh))
                    return;

                this.addMesh(object);
            }
        );

        const builder = new BVHBuilder();
        const result = builder.build(this.triangleData);

        this.bvhData = result.nodes;

        this.triangleData.length = 0;
        this.triangleData.push(...result.triangles);

        this.enqueueBuffers();
    }

    private addMesh(mesh: THREE.Mesh): void {
        const geometry = mesh.geometry;
        if (!(geometry instanceof THREE.BufferGeometry)) return;

        const positions = geometry.getAttribute("position");
        if (!positions) return;

        if (Array.isArray(mesh.material))
            throw new Error("Multiple materials are not supported yet.");

        const material = mesh.material as THREE.MeshPhysicalMaterial;
        const materialId = this.getOrCreateMaterial(material);

        const index = geometry.index;
        const world = mesh.matrixWorld;

        if (geometry instanceof THREE.SphereGeometry) {
            const sphereGeometry: THREE.SphereGeometry = geometry;
            sphereGeometry.computeBoundingSphere();
            this.pushSphere(mesh.position, sphereGeometry.boundingSphere?.radius!, materialId);
        } else {
            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    this.tempP0.fromBufferAttribute(positions, index.getX(i    )).applyMatrix4(world);
                    this.tempP1.fromBufferAttribute(positions, index.getX(i + 1)).applyMatrix4(world);
                    this.tempP2.fromBufferAttribute(positions, index.getX(i + 2)).applyMatrix4(world);
                    this.tempNormal.crossVectors(
                        this.tempP1.clone().sub(this.tempP0),
                        this.tempP2.clone().sub(this.tempP0)
                    ).normalize();

                    this.pushTriangle(materialId);
                }

            } else {
                for (let i = 0; i < positions.count; i += 3) {
                    this.tempP0.fromBufferAttribute(positions, i    ).applyMatrix4(world);
                    this.tempP1.fromBufferAttribute(positions, i + 1).applyMatrix4(world);
                    this.tempP2.fromBufferAttribute(positions, i + 2).applyMatrix4(world);
                    this.tempNormal.crossVectors(
                        this.tempP1.clone().sub(this.tempP0),
                        this.tempP2.clone().sub(this.tempP0)
                    ).normalize();

                    this.pushTriangle(materialId);
                }
            }
        }
    }

    private pushTriangle(materialId: number): void {
        this.triangleData.push(
            new GPUTriangle().set(
                this.tempP0,
                this.tempP1,
                this.tempP2,
                this.tempNormal,
                materialId
            )
        );
    }

    private pushSphere(center: THREE.Vector3, radius: number, materialId: number): void {
        this.sphereData.push(new GPUSphere().set(center, radius, materialId));
    }

    private getOrCreateMaterial(material: THREE.MeshPhysicalMaterial): number {
        const existing = this.materialMap.get(material);

        if (existing !== undefined) return existing;

        const id = this.materialMap.size;
        this.materialMap.set(material, id);

        this.materialData.push(new GPUMaterial(material));

        return id;
    }

    private enqueueBuffers(): void {
        this.enqueueTriangleBuffer();
        this.enqueueSphereBuffer();
        this.enqueueMaterialBuffer();
        this.enqueueAmbientBuffer();
        this.enqueueBVHBuffer();
    }

    private enqueueTriangleBuffer(): void {
        const triangleCount = this.triangleData.length;
        const triangleBufferSize = Math.max(triangleCount, 1) * GPUTriangle.BYTE_SIZE;
        const triangleArrayBuffer = new ArrayBuffer(triangleBufferSize);

        for (let i = 0; i < triangleCount; i++) {
            this.triangleData[i].write(triangleArrayBuffer, i * GPUTriangle.BYTE_SIZE);
        }

        if (!this.triangleBuffer || this.triangleBuffer.size < triangleBufferSize) {

            this.triangleBuffer?.destroy();

            this.triangleBuffer =
                this.device.createBuffer({
                    size: triangleBufferSize,

                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_DST
                });
        }

        
        this.device.queue.writeBuffer(this.triangleBuffer, 0, triangleArrayBuffer);
    }

    private enqueueSphereBuffer(): void {
        const sphereCount = this.sphereData.length;
        const sphereBufferSize = Math.max(sphereCount, 1) * GPUTriangle.BYTE_SIZE;
        const sphereArrayBuffer = new ArrayBuffer(sphereBufferSize);

        let byteOffset = 0;
        for (let i = 0; i < sphereCount; i++) {
            byteOffset = this.sphereData[i].write(sphereArrayBuffer, byteOffset);
        }

        if (!this.sphereBuffer || this.sphereBuffer.size < sphereBufferSize) {

            this.sphereBuffer?.destroy();

            this.sphereBuffer =
                this.device.createBuffer({
                    size: sphereBufferSize,

                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_DST
                });
        }

        
        this.device.queue.writeBuffer(this.sphereBuffer, 0, sphereArrayBuffer);
    }

    private enqueueMaterialBuffer(): void {
        const materialCount = this.materialData.length;
        const materialBufferSize = Math.max(materialCount, 1) * GPUMaterial.BYTE_SIZE;

        const materialArrayBuffer = new ArrayBuffer(materialBufferSize);
        const materialFloats = new Float32Array(materialArrayBuffer);

        for (let i = 0; i < materialCount; i++) {
            this.materialData[i].write(materialFloats, i * GPUMaterial.FLOAT_COUNT);
        }

        if (!this.materialBuffer || this.materialBuffer.size < materialBufferSize) {
            this.materialBuffer?.destroy();

            this.materialBuffer =
                this.device.createBuffer({
                    size: materialBufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                });
        }

        this.device.queue.writeBuffer(this.materialBuffer, 0, materialArrayBuffer);
    }

    private enqueueBVHBuffer(): void {
        const bvhCount = this.bvhData.length;
        const bvhBufferSize = Math.max(bvhCount, 1) * BVHNode.BYTE_SIZE;
        const bvhArrayBuffer = new ArrayBuffer(bvhBufferSize);
        
        for (let i = 0; i < bvhCount; i++) {
            this.bvhData[i].write(bvhArrayBuffer, i * BVHNode.BYTE_SIZE);
        }

        if (!this.bvhBuffer || this.bvhBuffer.size < bvhBufferSize) {
            this.bvhBuffer?.destroy();
        
            this.bvhBuffer =
                this.device.createBuffer({
                    size: bvhBufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                });
        }

        this.device.queue.writeBuffer(this.bvhBuffer, 0, bvhArrayBuffer);
    }

    private enqueueAmbientBuffer(): void {
        const skyArrayBuffer = new Float32Array(GPUAmbient.SIZE);
        this.gpuAmbient.write(skyArrayBuffer, 0);

        this.device.queue.writeBuffer(this.gpuAmbient.buffer, 0, skyArrayBuffer);
    }
}