@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<storage, read> triangles : array<Triangle>;
@group(0) @binding(2) var<storage, read> materials : array<Material>;
@group(0) @binding(3) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> time: Time;
@group(0) @binding(5) var<storage, read> bvh : array<BVHNode>;
@group(0) @binding(6) var<uniform> skyData : SkyData;

struct BVHNode {
    min : vec4<f32>,
    max : vec4<f32>,
    data : vec4<u32>,
    padding : vec4<u32>,
};

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let textureSize = textureDimensions(outputTexture);

    if (id.x >= textureSize.x || id.y >= textureSize.y) {
        return;
    }

    let size = vec2<f32>(textureSize);
    let scale = camera.params.x;
    let aspect = camera.params.y;

    const samplesPerPixel = 8u;
    var materialLightSourceIntensity = 0.0;

    var pixelColor = vec3<f32>(0.0);

    for (var sample = 0u; sample < samplesPerPixel; sample++) {
        var seed = id.x + id.y * textureSize.x + sample * 1973u;
        
        // --------------------------------------------------------
        // Subpixel jitter
        // --------------------------------------------------------

        var randomX = random(&seed);
        var randomY = random(&seed);

        var MAX_RAY_CASTING = 4u;
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

        var origin = camera.position.xyz;
        var direction = normalize(
            camera.forward.xyz +
            uv.x * camera.right.xyz +
            uv.y * camera.up.xyz
        );
        
        var rayColor = vec3<f32>(0.0);
        
        var last_cast_index = 0u;
        var contribution = 1.0;
        var foundLight = false;

        for (var cast_index = 0u; cast_index < MAX_RAY_CASTING; cast_index++) {
            last_cast_index = cast_index;
            let intersectionResults = intersectTriangles(origin, direction);
            
            if (intersectionResults.count == 0u) {
                let skyColor = skyColor(direction);
                contribution = 1.0;
                rayColor += skyColor * contribution;
                foundLight = true;
                break;
            }

            let intersectionResult = intersectionResults.intersections[0];
            let triangleIndex = intersectionResult.triangleIndex;
            let triangle = &triangles[triangleIndex];
            let material = materials[triangle.materialId];
            let intersectionPoint = origin + direction * intersectionResult.distance;


            let lightSourceIntensity = material.properties[2];
            let hittedLightSource = lightSourceIntensity > 0.0;

            if (hittedLightSource) {
                rayColor += material.baseColor.rgb * lightSourceIntensity;
                foundLight = true;
                break;
            } else {
                rayColor += material.baseColor.rgb * contribution;
            }

            let frontFace = dot(direction, triangle.normal) < 0.0;
            var usedNormal: vec3<f32>;
            if (frontFace) {
                usedNormal = triangle.normal;
            } else {
                usedNormal = -triangle.normal;
            };

            let materialRoughness = material.properties[0];
            
            if (materialRoughness > 0.0) {
                contribution *= (1 - dot(triangle.normal, -direction)) * (1 - materialRoughness);
            } else if (
                material.baseColor.r == 0.0 &&
                material.baseColor.g == 0.0 &&
                material.baseColor.b == 0.0
                ) {
                cast_index--;
            }

            let originOffset = usedNormal * 0.01;
            origin = intersectionPoint + originOffset;

            var refractionIndex = material.properties[1];

            if (refractionIndex > 0.0) {
                if (frontFace){
                    refractionIndex = 1.0 / refractionIndex;
                } else {
                    refractionIndex = refractionIndex;
                }

                let cosTheta = dot(-direction, usedNormal);
                let outRayPerpendicular = refractionIndex * (direction + cosTheta * usedNormal);
                let cos2Theta = 1.0 - dot(outRayPerpendicular, outRayPerpendicular);

                if (cos2Theta < 0.0) {
                    direction = reflect(direction, usedNormal);
                } else {
                    let outRayParallel = -sqrt(cos2Theta) * usedNormal;
                    direction = outRayPerpendicular + outRayParallel;
                }
            } else {
                let randomDirection = randomHemisphere(usedNormal, &seed);
                let randomLambertianDirection = usedNormal + randomDirection;
                let reflectedDirection = reflect(direction, usedNormal);

                direction = normalize(mix(reflectedDirection, randomLambertianDirection, materialRoughness));
            }
        }

        if (!foundLight) {
            rayColor = vec3<f32>(0.0);
        }
        pixelColor += rayColor / f32(last_cast_index + 1u);
    }

    pixelColor /= f32(samplesPerPixel);

    textureStore(
        outputTexture,
        vec2<i32>(id.xy),
        vec4<f32>(pixelColor, 1.0)
    );
}


struct TriangleIntersection {
    triangleIndex: u32,
    distance: f32,
};

const MAX_INTERSECTIONS = 16u;
struct TrianglesIntersectionsResult {
    intersections: array<TriangleIntersection, 16>,
    count: u32,
};

struct RaycastResult {
    intersection: TriangleIntersection,
};

// fn intersectTriangles(origin: vec3<f32>, direction: vec3<f32>) -> Intersection {
//     var closestDistance = 1e30;
//     var hitMaterialId = 0u;
//     var hitNormal = vec3<f32>(0.0);

//     var hitTriangle: Triangle;

//     let triangleCount = arrayLength(&triangles);

//     for (var i = 0u; i < triangleCount; i++) {
//         let triangle = triangles[i];

//         var triangleNormal = vec3<f32>(0.0);

//         let currentDistance = intersectRayTriangle(
//             origin,
//             direction,
//             triangle,
//             &triangleNormal
//         );

//         if (currentDistance > 0.0 && currentDistance < closestDistance) {
//             closestDistance = currentDistance;
//             hitMaterialId = triangle.materialId;
//             hitNormal = triangleNormal;
//             hitTriangle = triangle;
//         }
//     }

//     let point = origin + direction * closestDistance;

//     // if distance is still -1.0, it means we didn't hit anything, so we can return a default intersection
//     return Intersection(
//         point,
//         closestDistance,
//         hitNormal,
//         hitMaterialId
//     );
// }

// fn skyColor(direction: vec3<f32>) -> vec3<f32> {
//     let intensity = abs(direction.y);
//     let sunDirection = skyData.sunDirection;
//     let sunSize = skyData.sunIntensity;

//     var dot = dot(direction, sunDirection);
//     if (dot > 0.0) {
//         dot = pow(dot, 1000.0);
//     } else {
//         dot = 0.0;
//     }

//     let darkBlue = vec3<f32>(0.10, 0.25, 0.50);
//     let lightBlue = vec3<f32>(0.25, 0.55, 0.85);
//     let sunColor = vec3<f32>(1.0 * sunSize, 1.0 * sunSize, 1.0 * sunSize);

//     var skyColor = mix(lightBlue, darkBlue, intensity);
//     skyColor = mix(skyColor, sunColor, dot);

//     return skyColor;
// }

fn skyColor(rayDirection: vec3<f32>) -> vec3<f32> {
    var rayDot = abs(dot(rayDirection, vec3<f32>(0, 1, 0)));
    var skyColor = mix(skyData.horizonColor, skyData.zenithColor, rayDot);

    var fogDot = 1.0 - rayDot;
    if (fogDot > 0.0) {
        fogDot = pow(fogDot, skyData.fogSpreadness);
    } else {
        fogDot = 0.0;
    }

    skyColor = mix(skyColor, skyData.fogColor, clamp(fogDot, 0.0, 1.0));
    
    var sunDot = dot(rayDirection, skyData.sunDirection);
    if (sunDot > 0.0) {
        sunDot = pow(sunDot, 1000.0);
    } else {
        sunDot = 0.0;
    }

    let sunColor = vec3<f32>(skyData.sunIntensity);
    skyColor = mix(skyColor, sunColor, sunDot);
    let sunIntensity = skyData.sunDirection.y;
    skyColor *= (sunIntensity + 1.0) / 2.0;

    return skyColor;
}

fn intersectTriangles(origin: vec3<f32>, direction: vec3<f32>) -> TrianglesIntersectionsResult {
    var intersections: array<TriangleIntersection, MAX_INTERSECTIONS>;
    var intersectionCount = 0u;

    const minDistance = 0.001;

    var stack: array<u32, 64>;
    var stackSize = 0u;

    stack[stackSize] = 0u;
    stackSize++;

    while (stackSize > 0u) {
        stackSize--;

        let nodeIndex = stack[stackSize];
        let node = bvh[nodeIndex];

        if (!rayIntersectionsWithAABBChat(origin, direction, node.min.xyz, node.max.xyz)) {
            continue;
        }

        // Leaf
        if (node.data.w > 0u) {
            for (var i = 0u; i < node.data.w; i++) {
                let triangleIndex = node.data.z + i;
                let triangle = triangles[triangleIndex];

                let distance = intersectRayTriangle(origin, direction, triangle);
                if (distance <= minDistance) {
                    continue;
                }

                var insertIndex = intersectionCount;

                for (var j = 0u; j < intersectionCount; j++) {
                    if (distance < intersections[j].distance) {
                        insertIndex = j;
                        break;
                    }
                }

                if (intersectionCount < MAX_INTERSECTIONS) {
                    var j = intersectionCount;

                    while (j > insertIndex) {
                        intersections[j] = intersections[j - 1u];
                        j--;
                    }

                    intersections[insertIndex] = TriangleIntersection(
                        triangleIndex,
                        distance
                    );

                    intersectionCount++;
                } else if (insertIndex < MAX_INTERSECTIONS) {
                    var j = MAX_INTERSECTIONS - 1u;

                    while (j > insertIndex) {
                        intersections[j] = intersections[j - 1u];
                        j--;
                    }

                    intersections[insertIndex] = TriangleIntersection(
                        triangleIndex,
                        distance
                    );
                }
            }
        } else {
            stack[stackSize] = node.data.x;
            stackSize++;

            stack[stackSize] = node.data.y;
            stackSize++;
        }
    }

    return TrianglesIntersectionsResult(
        intersections,
        intersectionCount
    );
}

fn rayIntersectionsWithAABBChat(
    origin: vec3<f32>,
    direction: vec3<f32>,
    minBounds: vec3<f32>,
    maxBounds: vec3<f32>
) -> bool {

    let invDirection = 1.0 / direction;

    let t0 = (minBounds - origin) * invDirection;
    let t1 = (maxBounds - origin) * invDirection;

    let tMin = min(t0, t1);
    let tMax = max(t0, t1);

    let near = max(
        max(tMin.x, tMin.y),
        tMin.z
    );

    let far = min(
        min(tMax.x, tMax.y),
        tMax.z
    );

    return far >= max(near, 0.0);
}