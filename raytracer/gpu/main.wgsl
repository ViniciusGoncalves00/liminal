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