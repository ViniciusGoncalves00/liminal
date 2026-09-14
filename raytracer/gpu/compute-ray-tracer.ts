import { GPUCamera } from "./gpu-camera";
import { GPUScene } from "./gpu-scene";
import { GPUTriangle } from "./gpu-triangle";

export class ComputeRayTracer {

    public readonly outputTexture: GPUTexture;
    public readonly gpuTextureView: GPUTextureView;
    private timeBuffer: GPUBuffer | null = null;

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

        this.timeBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.gpuTextureView =
            this.outputTexture.createView();

        // ============================================================
        // Shader
        // ============================================================

        const module =
            device.createShaderModule({

                code: `
                    ${GPUCamera.SHADER}
                    ${GPUTriangle.SHADER}

                    struct Material {
                        baseColor : vec4<f32>,
                        properties : vec4<f32>,
                    };

                    struct Time {
                        value: f32,
                    };

fn intersectTriangle(
    origin: vec3<f32>,
    direction: vec3<f32>,
    triangle: Triangle,
    hitNormal: ptr<function, vec3<f32>>
) -> f32 {

    let edge1 = triangle.p1.xyz - triangle.p0.xyz;
    let edge2 = triangle.p2.xyz - triangle.p0.xyz;

    let pvec = cross(direction, edge2);

    let det = dot(edge1, pvec);

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

    *hitNormal = normalize(cross(edge1, edge2));

    return t;
}

fn hsvToRgb(hsv: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), hsv.y);
}

fn random(seed: ptr<function, u32>) -> f32 {
    var x = *seed;

    x ^= x >> 16u;
    x *= 0x7feb352du;
    x ^= x >> 15u;
    x *= 0x846ca68bu;
    x ^= x >> 16u;

    *seed = x;

    return f32(x) / 4294967295.0;
}

fn randomRange(
    seed: ptr<function, u32>,
    min: f32,
    max: f32
) -> f32 {
    return min + random(seed) * (max - min);
}

fn randomUnitVector(seed: ptr<function, u32>) -> vec3<f32> {
    let z = random(seed) * 2.0 - 1.0;
    let phi = random(seed) * 2.0 * 3.14159265;

    let r = sqrt(1.0 - z * z);

    return vec3<f32>(
        r * cos(phi),
        r * sin(phi),
        z
    );
}

fn randomHemisphere(
    normal: vec3<f32>,
    seed: ptr<function, u32>
) -> vec3<f32> {

    var direction = randomUnitVector(seed);

    if (dot(direction, normal) < 0.0) {
        direction = -direction;
    }

    return direction;
}

fn cosineWeightedHemisphere(
    normal: vec3<f32>,
    seed: ptr<function, u32>
) -> vec3<f32> {

    let r1 = random(seed);
    let r2 = random(seed);

    let phi = 2.0 * 3.14159265 * r1;
    let r = sqrt(r2);

    let x = r * cos(phi);
    let y = r * sin(phi);
    let z = sqrt(1.0 - r2);

    // Base ortonormal ao redor da normal
    var tangent: vec3<f32>;

    if (abs(normal.x) > 0.1) {
        tangent = normalize(
            cross(
                vec3<f32>(0.0, 1.0, 0.0),
                normal
            )
        );
    } else {
        tangent = normalize(
            cross(
                vec3<f32>(1.0, 0.0, 0.0),
                normal
            )
        );
    }

    let bitangent = cross(normal, tangent);

    return normalize(
        tangent * x +
        bitangent * y +
        normal * z
    );
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

                    @group(0) @binding(4)
                    var<uniform> time: Time;

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
                        uv.y = -uv.y;

                        uv.x *= aspect;
                        uv *= scale;

                        var origin = camera.position.xyz;

                        var direction = normalize(
                            camera.forward.xyz +
                            uv.x * camera.right.xyz +
                            uv.y * camera.up.xyz
                        );

                        const samplesPerPixel = 1u;

                        var accumulatedColor = vec3<f32>(0.0);

                        var bounces = 16u;
                        var lastBounce = 0u;
                        var hitScaped = false;

                        for (var sample = 0u; sample < samplesPerPixel; sample++) {
                            var seed = id.x + id.y * textureSize.x + sample * 1973u;
                            
                            // --------------------------------------------------------
                            // Subpixel jitter
                            // --------------------------------------------------------

                            var randomX = random(&seed);
                            var randomY = random(&seed);

                            if (sample == 0u) {
                                randomX = 0.5;
                                randomY = 0.5;
                            }

                            let pixel = vec2<f32>(
                                f32(id.x) + randomX,
                                f32(id.y) + randomY
                            );

                            // --------------------------------------------------------
                            // Pixel -> NDC
                            // --------------------------------------------------------

                            var uv = pixel / size;
                            uv = uv * 2.0 - 1.0;
                            uv.y = -uv.y;
                            uv.x *= aspect;
                            uv *= scale;

                            // --------------------------------------------------------
                            // Ray
                            // --------------------------------------------------------

                            direction = normalize(
                                camera.forward.xyz +
                                uv.x * camera.right.xyz +
                                uv.y * camera.up.xyz
                            );
                            
                            for (var bounce = 0u; bounce < bounces; bounce++) {
                                var closestT = 1e30;
                                var hitMaterialId = 0u;
                                var hit = false;

                                lastBounce = bounce;

                                var hitNormal = vec3<f32>(0.0);
                                let triangleCount = arrayLength(&triangles);

                                for (var i = 0u; i < triangleCount; i++) {
                                    let triangle = triangles[i];
                                    var triangleNormal = vec3<f32>(0.0);

                                    let t = intersectTriangle(origin, direction, triangle, &triangleNormal);

                                    if (t > 0.0 && t < closestT) {
                                        closestT = t;
                                        hitMaterialId = triangle.materialId;
                                        hitNormal = triangleNormal;
                                        hit = true;
                                    }
                                }

                                // --------------------------------------------------------
                                // Miss
                                // --------------------------------------------------------

                                if (!hit) {

                                    let intensity =
                                        1.0 - abs(direction.y);

                                    let darkBlue =
                                        vec3<f32>(0.02, 0.05, 0.15);

                                    let lightBlue =
                                        vec3<f32>(0.25, 0.55, 0.85);

                                    accumulatedColor +=
                                        mix(darkBlue, lightBlue, intensity);

                                    hitScaped = true;
                                    break;
                                }

                                // --------------------------------------------------------
                                // Hit
                                // --------------------------------------------------------

                                let hitPoint = origin + direction * closestT;

                                let material = materials[hitMaterialId];

                                accumulatedColor += material.baseColor.rgb * 1.0 / (f32(bounce) + 1.0);

                                // --------------------------------------------------------
                                // Próximo bounce
                                // --------------------------------------------------------

                                origin = hitPoint + hitNormal * 0.001;
                                direction = reflect(direction, hitNormal);
                                direction.x *= randomRange(&seed, 1.0, 1.2);
                                direction.y *= randomRange(&seed, 1.0, 1.2);
                                direction.z *= randomRange(&seed, 1.0, 1.2);
                                direction = normalize(direction);
                            }
                        }


                        // ============================================================
                        // Average
                        // ============================================================

                        var color = vec3<f32>(0.0);
                        if (hitScaped) {
                            color = accumulatedColor / f32(samplesPerPixel) / f32(lastBounce + 1u);
                        }

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
                    },

                    {
                        binding: 4,

                        visibility:
                            GPUShaderStage.COMPUTE,

                        buffer: {
                            type: "uniform"
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
        const time = performance.now() / 1000;

        this.device?.queue.writeBuffer(
            this.timeBuffer!,
            0,
            new Float32Array([time])
        );

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
                    },

                    {
                        binding: 4,

                        resource: {
                            buffer:
                                this.timeBuffer
                        }
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