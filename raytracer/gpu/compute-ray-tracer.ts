import { GPUCamera } from "./gpu-camera";
import { GPU_CAMERA_SHADER } from "./gpu-camera-layout";
import { GPUScene } from "./gpu-scene";

export class ComputeRayTracer {

    public readonly outputTexture: GPUTexture;
    public readonly gpuTextureView: GPUTextureView;

    private readonly device: GPUDevice;
    private readonly pipeline: GPUComputePipeline;

    private readonly width: number;
    private readonly height: number;

    public constructor(
        device: GPUDevice,
        width: number,
        height: number
    ) {
        this.device = device;
        this.width = width;
        this.height = height;

        // ============================================================
        // Output
        // ============================================================

        this.outputTexture =
            device.createTexture({
                size: [width, height],

                format: "rgba16float",

                usage:
                    GPUTextureUsage.STORAGE_BINDING |
                    GPUTextureUsage.TEXTURE_BINDING
            });

        this.gpuTextureView =
            this.outputTexture.createView();

        // ============================================================
        // Shader
        // ============================================================

        const module =
            device.createShaderModule({

                code: `
                    ${GPU_CAMERA_SHADER}

                    struct Triangle {
                        p0 : vec4<f32>,
                        p1 : vec4<f32>,
                        p2 : vec4<f32>,

                        materialId : u32,
                        _pad0 : u32,
                        _pad1 : u32,
                        _pad2 : u32,
                    };

                    struct Material {
                        baseColor : vec4<f32>,
                        properties : vec4<f32>,
                    };

                    fn intersectTriangle(
    origin: vec3<f32>,
    direction: vec3<f32>,
    triangle: Triangle
) -> f32 {

    let edge1 = triangle.p1.xyz - triangle.p0.xyz;
    let edge2 = triangle.p2.xyz - triangle.p0.xyz;

    let pvec = cross(direction, edge2);

    let det = dot(edge1, pvec);

    // Parallel / nearly parallel
    if (abs(det) < 0.000001) {
        return -1.0;
    }

    let invDet = 1.0 / det;

    let tvec = origin - triangle.p0.xyz;

    let u = dot(tvec, pvec) * invDet;

    if (u < 0.0 || u > 1.0) {
        return -1.0;
    }

    let qvec = cross(tvec, edge1);

    let v = dot(direction, qvec) * invDet;

    if (v < 0.0 || u + v > 1.0) {
        return -1.0;
    }

    let t = dot(edge2, qvec) * invDet;

    if (t <= 0.0) {
        return -1.0;
    }

    return t;
}

fn hsvToRgb(hsv: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), hsv.y);
}


                    // =================================================
                    // Resources
                    // =================================================

                    @group(0) @binding(0)
                    var<uniform> camera : Camera;

                    @group(0) @binding(1)
                    var<storage, read>
                        triangles : array<Triangle>;

                    @group(0) @binding(2)
                    var<storage, read>
                        materials : array<Material>;

                    @group(0) @binding(3)
                    var outputTexture :
                        texture_storage_2d<
                            rgba16float,
                            write
                        >;


                    // =================================================
                    // Main
                    // =================================================

                    @compute @workgroup_size(8, 8)
                    fn main(
                        @builtin(global_invocation_id)
                        id : vec3<u32>
                    ) {

                        // ---------------------------------------------
                        // Bounds
                        // ---------------------------------------------

                        let textureSize = textureDimensions(outputTexture);

                        if (id.x >= textureSize.x ||id.y >= textureSize.y) {
                            return;
                        }


                        // ---------------------------------------------
                        // Pixel -> NDC
                        // ---------------------------------------------

                        let pixel = vec2<f32>(id.xy);
                        let size = vec2<f32>(textureSize);
                        let scale = camera.params.x;
                        let aspect = camera.params.y;

                        var uv = (vec2<f32>(id.xy) + vec2<f32>(0.5)) / vec2<f32>(textureSize);
                        uv = uv * 2.0 - 1.0;

                        uv.x *= aspect;
                        uv *= scale;

                        let origin = camera.position.xyz;

                        let direction = normalize(
                            camera.forward.xyz +
                            uv.x * camera.right.xyz +
                            uv.y * camera.up.xyz
                        );


                        var closestT = 1e30;
                        var hitMaterialId = 0u;
                        var hit = false;

                        let triangleCount =
                            arrayLength(&triangles);

                        for (var i = 0u; i < triangleCount; i++) {
                            let triangle = triangles[i];

                            let t = intersectTriangle(origin, direction, triangle);

                                if (
                                    t > 0.0 &&
                                    t < closestT
                                ) {
                                    closestT = t;
                                    hitMaterialId = triangle.materialId;
                                    hit = true;
                                }
                            }


                        // ================================================================
                        // Background
                        // ================================================================
                                
                        // if (!hit) {
                        //     var horizontalDirection = normalize(vec2<f32>(direction.x, direction.z));
                        //     var intensity = 1 - abs(direction.y);

                        //     var angle = atan2(direction.z, direction.x);

                        //     var hue = fract(angle / (2.0 * 3.14159265));
                        //     var sector = hue * 3.0;
                        //     var t = fract(sector);

                        //     var strength = 1 - abs(t * 2.0 - 1.0);
                        //     strength = pow(smoothstep(0.0, 0.8, strength), 1.2);

                        //     let color = hsvToRgb(vec3<f32>(degrees(angle) / 360, 1.0, intensity * strength));

                        //     textureStore(
                        //         outputTexture,
                        //         vec2<i32>(id.xy),
                        //         vec4<f32>(color, 1.0)
                        //     );
                                
                        //     return;
                        // }

                        if (!hit) {
                            var intensity = 1.0 - abs(direction.y);

                            let darkBlue = vec3<f32>(0.02, 0.05, 0.15);
                            let lightBlue = vec3<f32>(0.25, 0.55, 0.85);
                                        
                            var color = mix(
                                darkBlue,
                                lightBlue,
                                intensity
                            );

                            textureStore(
                                outputTexture,
                                vec2<i32>(id.xy),
                                vec4<f32>(color, 1.0)
                            );
                                
                            return;
                        }


                        // ================================================================
                        // Material
                        // ================================================================

                        let material =
                            materials[hitMaterialId];

                        let color =
                            material.baseColor.rgb;

                        textureStore(
                            outputTexture,
                            vec2<i32>(id.xy),
                            vec4<f32>(color, 1.0)
                        );
                    }
                `
            });

        // ============================================================
        // Bind group layout
        // ============================================================

        const bindGroupLayout =
            device.createBindGroupLayout({

                entries: [

                    {
                        binding: 0,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "uniform"
                        }
                    },

                    {
                        binding: 1,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "read-only-storage"
                        }
                    },

                    {
                        binding: 2,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "read-only-storage"
                        }
                    },

                    {
                        binding: 3,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        storageTexture: {
                            access: "write-only",
                            format: "rgba16float",
                            viewDimension: "2d"
                        }
                    }
                ]
            });

        const pipelineLayout =
            device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout
                ]
            });

        this.pipeline =
            device.createComputePipeline({

                layout: pipelineLayout,

                compute: {
                    module,
                    entryPoint: "main"
                }
            });
    }

    public render(
        gpuCamera: GPUCamera,
        gpuScene: GPUScene
    ): void {

        const bindGroup =
            this.device.createBindGroup({

                layout:
                    this.pipeline.getBindGroupLayout(0),

                entries: [

                    {
                        binding: 0,

                        resource: {
                            buffer:
                                gpuCamera.buffer
                        }
                    },

                    {
                        binding: 1,

                        resource: {
                            buffer:
                                gpuScene.triangleBuffer
                        }
                    },

                    {
                        binding: 2,

                        resource: {
                            buffer:
                                gpuScene.materialBuffer
                        }
                    },

                    {
                        binding: 3,

                        resource:
                            this.gpuTextureView
                    }
                ]
            });

        const encoder =
            this.device.createCommandEncoder();

        const pass =
            encoder.beginComputePass();

        pass.setPipeline(
            this.pipeline
        );

        pass.setBindGroup(
            0,
            bindGroup
        );

        pass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        pass.end();

        this.device.queue.submit([
            encoder.finish()
        ]);
    }
}