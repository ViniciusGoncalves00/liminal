@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<storage, read> triangles : array<Triangle>;
@group(0) @binding(2) var<storage, read> materials : array<Material>;
@group(0) @binding(3) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> time: Time;
@group(0) @binding(5) var<storage, read> bvh : array<BVHNode>;
@group(0) @binding(6) var<uniform> skyData : SkyData;
@group(0) @binding(7) var<storage, read> spheres : array<Sphere>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let textureSize = textureDimensions(outputTexture);

    if (id.x >= textureSize.x || id.y >= textureSize.y) {
        return;
    }

    let TEXTURE_SIZE = vec2<f32>(f32(textureSize.x), f32(textureSize.y));
    const TARGET_SAMPLES_PER_PIXEL = 49u;
    const SQUAREROOT_SAMPLES_PER_PIXEL = u32(sqrt(f32(TARGET_SAMPLES_PER_PIXEL)));
    const AFFECTIVE_SAMPLES_PER_PIXEL = SQUAREROOT_SAMPLES_PER_PIXEL * SQUAREROOT_SAMPLES_PER_PIXEL;
    const RECIP_SQUAREROOT_SAMPLES_PER_PIXEL = 1.0 / f32(SQUAREROOT_SAMPLES_PER_PIXEL);
    const MAX_BOUNCES = 4u;

    var pixelColor = vec3<f32>(0.0);

    for (var s_i = 0u; s_i < SQUAREROOT_SAMPLES_PER_PIXEL; s_i++) {
        for (var s_j = 0u; s_j < SQUAREROOT_SAMPLES_PER_PIXEL; s_j++) {
            let sample = s_i * SQUAREROOT_SAMPLES_PER_PIXEL + s_j;
            var seed = id.x + id.y * textureSize.x + sample * 1973u;
            var stratifiedPixel = sampleStratifiedSquare(s_i, s_j, RECIP_SQUAREROOT_SAMPLES_PER_PIXEL, &seed);

            // if (sample == 0u) {
            //     stratifiedPixel.x = 0.0;
            //     stratifiedPixel.y = 0.0;
            // }

            let pixel = vec2<f32>(
                f32(id.x) + stratifiedPixel.x,
                f32(id.y) + stratifiedPixel.y
            );

            let ray = castRay(pixel, TEXTURE_SIZE, MAX_BOUNCES, &seed);
            pixelColor += ray.color;
        }
    }
    
    pixelColor /= f32(AFFECTIVE_SAMPLES_PER_PIXEL);

    textureStore(
        outputTexture,
        vec2<i32>(id.xy),
        vec4<f32>(pixelColor, 1.0)
    );
}

fn castRay(
    pixel: vec2<f32>,
    textureSize: vec2<f32>,
    maxBounces: u32,
    seed: ptr<function, u32>
) -> Ray {

    let scale = camera.params.x;
    let aspect = camera.params.y;

    var uv = pixel / textureSize;
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

    var radiance = vec3<f32>(0.0);
    var throughput = vec3<f32>(1.0);

    for (var bounce = 0u; bounce < maxBounces; bounce++) {

        let triangleHit = intersectTriangles(origin, direction);
        let sphereHit = intersectSpheres(origin, direction);

        let hasTriangle = triangleHit.count > 0u;
        let hasSphere = sphereHit.hit;

        // Nenhuma interseção: contribuição do ambiente.
        if (!hasTriangle && !hasSphere) {
            radiance += throughput * skyColor(direction);
            break;
        }

        var material: Material;
        var normal: vec3<f32>;
        var hitPosition: vec3<f32>;
        var distance: f32;

        let triangleDistance = select(
            1e30,
            triangleHit.intersections[0].distance,
            hasTriangle
        );

        if (hasSphere && sphereHit.distance < triangleDistance) {

            material = materials[sphereHit.materialId];
            normal = sphereHit.normal;
            hitPosition = sphereHit.position;
            distance = sphereHit.distance;

        } else {

            let hit = triangleHit.intersections[0];
            let triangle = triangles[hit.triangleIndex];

            material = materials[triangle.materialId];
            normal = triangle.normal;
            distance = hit.distance;
            hitPosition = origin + direction * distance;
        }

        // Normal orientada para o lado de onde veio o raio.
        let frontFace = dot(direction, normal) < 0.0;
        let usedNormal = select(-normal, normal, frontFace);

        // Emissão do material.
        let emission = material.baseColor.rgb * material.properties[2];
        radiance += throughput * emission;

        // Material emissivo: encerra o caminho nesta versão.
        if (material.properties[2] > 0.0) {
            break;
        }

        // Atualiza a origem para evitar auto-interseção.
        origin = hitPosition + usedNormal * 0.001;

        // Espalhamento do material.
        let roughness = material.properties[0];
        let refractionIndex = material.properties[3];

        if (refractionIndex > 1.0) {

            var eta = refractionIndex;

            if (frontFace) {
                eta = 1.0 / eta;
            }

            let cosTheta = min(
                dot(-direction, usedNormal),
                1.0
            );

            let sinTheta = sqrt(1.0 - cosTheta * cosTheta);

            let cannotRefract = eta * sinTheta > 1.0;

            let shouldReflect =
                cannotRefract ||
                reflectance(cosTheta, eta) > random(seed);

            if (shouldReflect) {
                direction = reflect(direction, usedNormal);
            } else {
                direction = normalize(
                    refract(direction, usedNormal, eta)
                );
            }

            // Dielétrico ideal: sem absorção.
        } else {

            // direction = reflectLambertian(
            //     direction,
            //     usedNormal,
            //     roughness,
            //     seed
            // );

            direction = randomLambertian(
                usedNormal,
                seed
            );

            // Atenuação pela refletância do material.
            throughput *= material.baseColor.rgb;
        }

    }

    return Ray(origin, direction, radiance);
}

fn reflectLambertian(direction: vec3<f32>, normal: vec3<f32>, roughness: f32, seed: ptr<function, u32>) -> vec3<f32> {
    let randomDirection = randomHemisphere(normal, seed);
    let randomLambertianDirection = normal + randomDirection;
    let reflectedDirection = reflect(direction, normal);

    return normalize(mix(reflectedDirection, randomLambertianDirection, roughness));
}

fn randomLambertian(
    normal: vec3<f32>,
    seed: ptr<function, u32>
) -> vec3<f32> {
    return normalize(normal + randomUnitVector(seed));
}

fn refract(direction: vec3<f32>, normal: vec3<f32>, refractionIndex: f32) -> vec3<f32> {
    let cos_theta = min(dot(-direction, normal), 1.0);
    let r_out_perp = refractionIndex * (direction + cos_theta * normal);
    let r_out_parallel = -sqrt(abs(1.0 - dot(r_out_perp, r_out_perp))) * normal;

    return r_out_perp + r_out_parallel;
}

fn reflectance(cosine: f32, refractionIndex: f32) -> f32 {
    var r0 = (1.0 - refractionIndex) / (1.0 + refractionIndex);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

fn pointAtRay(ray: Ray, t: f32) -> vec3<f32> {
    return ray.origin + ray.direction * t;
}

fn sampleStratifiedSquare(x: u32, y: u32, recip_sqrt_spp: f32, seed: ptr<function, u32>) -> vec2<f32> {
    let px = ((f32(x) + random(seed)) * recip_sqrt_spp) - 0.5;
    let py = ((f32(y) + random(seed)) * recip_sqrt_spp) - 0.5;

    return vec2<f32>(px, py);
}

struct TriangleIntersection {
    triangleIndex: u32,
    distance: f32,
};

struct Ray {
    origin: vec3<f32>,
    direction: vec3<f32>,
    color: vec3<f32>,
};

const MAX_INTERSECTIONS = 16u;
struct TrianglesIntersectionsResult {
    intersections: array<TriangleIntersection, 16>,
    count: u32,
};

struct RaycastResult {
    intersection: TriangleIntersection,
};

struct SphereHit {
    distance: f32,
    position: vec3<f32>,
    normal: vec3<f32>,
    materialId: u32,
    hit: bool,
};

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

fn intersectSpheres(
    origin: vec3<f32>,
    direction: vec3<f32>
) -> SphereHit {
    var closestHit: SphereHit;
    closestHit.distance = 1e30;
    closestHit.materialId = 0u;
    closestHit.position = vec3<f32>(0.0);
    closestHit.normal = vec3<f32>(0.0);
    closestHit.hit = false;

    for (var i = 0u; i < arrayLength(&spheres); i++) {
        let sphere = spheres[i];
        let oc = origin - sphere.center;

        let a = dot(direction, direction);
        let b = 2.0 * dot(oc, direction);
        let c = dot(oc, oc) - sphere.radius * sphere.radius;

        let discriminant = b * b - 4.0 * a * c;

        if (discriminant < 0.0) {
            continue;
        }

        let sqrtDiscriminant = sqrt(discriminant);
        let t0 = (-b - sqrtDiscriminant) / (2.0 * a);
        let t1 = (-b + sqrtDiscriminant) / (2.0 * a);

        var t = t0;

        if (t < 0.001) {
            t = t1;
        }

        if (t < 0.001 || t >= closestHit.distance) {
            continue;
        }

        let position = origin + direction * t;

        closestHit.distance = t;
        closestHit.position = position;
        closestHit.normal = normalize(position - sphere.center);
        closestHit.materialId = sphere.materialId;
        closestHit.hit = true;
    }

    return closestHit;
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