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
    const TARGET_SAMPLES_PER_PIXEL = 25u;
    const SQUAREROOT_SAMPLES_PER_PIXEL = u32(sqrt(f32(TARGET_SAMPLES_PER_PIXEL)));
    const AFFECTIVE_SAMPLES_PER_PIXEL = SQUAREROOT_SAMPLES_PER_PIXEL * SQUAREROOT_SAMPLES_PER_PIXEL;
    const RECIP_SQUAREROOT_SAMPLES_PER_PIXEL = 1.0 / f32(SQUAREROOT_SAMPLES_PER_PIXEL);
    const MAX_BOUNCES = 4u;

    var pixelColor = vec3<f32>(0.0);

    for (var s_i = 0u; s_i < SQUAREROOT_SAMPLES_PER_PIXEL; s_i++) {
        for (var s_j = 0u; s_j < SQUAREROOT_SAMPLES_PER_PIXEL; s_j++) {
            let sample = s_i * SQUAREROOT_SAMPLES_PER_PIXEL + s_j;
            var seed = (id.x + id.y * textureSize.x + sample * 10007u) * u32(time.value * 99787.0);
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
    var lastNormal = direction;

    for (var bounce = 0u; bounce < maxBounces; bounce++) {

        let triangleHit = intersectTriangles(origin, direction);
        let sphereHit = intersectSpheres(origin, direction);

        let hasTriangle = triangleHit.count > 0u;
        let hasSphere = sphereHit.hit;

        // Nenhuma interseção: contribuição do ambiente.
        if (!hasTriangle && !hasSphere) {
            if (bounce == 0) {
                radiance += throughput * skyColor(direction) * skyData.sunIntensity;
                break;
            }

            let sunTriangleHit = intersectTriangles(origin, skyData.sunDirection);
            let sunSphereHit = intersectSpheres(origin, skyData.sunDirection);

            let sunHasTriangle = sunTriangleHit.count > 0u;
            let sunHasSphere = sunSphereHit.hit;

            let inShadow = sunHasTriangle || sunHasSphere;

            if (inShadow) {
                radiance += throughput * skyColor(direction) * skyData.sunIntensity;
            } else {
                radiance += (vec3<f32>(1.0) * skyData.sunIntensity);
            }

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
    // skyColor *= sunIntensity;

    return skyColor;
}