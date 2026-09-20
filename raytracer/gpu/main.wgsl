@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<storage, read> triangles : array<Triangle>;
@group(0) @binding(2) var<storage, read> materials : array<Material>;
@group(0) @binding(3) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> time: Time;

@compute @workgroup_size(8, 8)
fn main( @builtin(global_invocation_id) id : vec3<u32>) {
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

    const samplesPerPixel = 16u;

    var bounces = 16u;
    var lastBounce = 0u;
    var bounceWentToSky = false;
    var reachedLight = false;
    var materialLightIntensity = 0.0;

    var pixelColor = vec3<f32>(0.0);

    for (var sample = 0u; sample < samplesPerPixel; sample++) {
        var seed = id.x + id.y * textureSize.x + sample * 1973u;
        origin = camera.position.xyz;
        var rayColor = vec3<f32>(0.0);
        
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
            lastBounce = bounce;

            let intersection = closestIntersection(origin, direction);

            if (intersection.distance >= 1e30) {
                let intensity = abs(direction.y);

                let darkBlue = vec3<f32>(0.02, 0.05, 0.15);
                let lightBlue = vec3<f32>(0.25, 0.55, 0.85);

                rayColor += mix(lightBlue, darkBlue, intensity);

                bounceWentToSky = true;
                break;
            } else {
                let material = materials[intersection.materialId];
                let lightIntensity = material.properties[2];

                if (lightIntensity > 1.0) {
                    reachedLight = true;
                    materialLightIntensity = lightIntensity;
                    rayColor *= lightIntensity;
                    break;
                } else {
                    rayColor += material.baseColor.rgb;
                }

                origin = intersection.point + intersection.normal * 0.01;
                var randomDirection = randomHemisphere(intersection.normal, &seed);
                var reflectedDirection = reflect(direction, intersection.normal);
                var materialRoughness = material.properties[0];
                direction = normalize(mix(reflectedDirection, randomDirection, materialRoughness));
            }
        }
        rayColor /= (f32(lastBounce) + 1.0);
        pixelColor += rayColor;
    }

    // if (reachedLight) {
    //     let colorIntensity = materialLightIntensity / f32(lastBounce + 1u);
    //     pixelColor = pixelColor / f32(samplesPerPixel) * colorIntensity;
    // } else if (bounceWentToSky) {
    //     pixelColor = pixelColor / f32(samplesPerPixel);
    // } else {
    //     pixelColor = vec3<f32>();
    // }

    pixelColor /= f32(samplesPerPixel);

    textureStore(
        outputTexture,
        vec2<i32>(id.xy),
        vec4<f32>(pixelColor, 1.0)
    );
}

struct Intersection {
    point: vec3<f32>,
    distance: f32,

    normal: vec3<f32>,
    materialId: u32,
};

fn closestIntersection(origin: vec3<f32>, direction: vec3<f32>) -> Intersection {
    var closestDistance = 1e30;
    var hitMaterialId = 0u;
    var hitNormal = vec3<f32>(0.0);

    var hitTriangle: Triangle;

    let triangleCount = arrayLength(&triangles);

    for (var i = 0u; i < triangleCount; i++) {
        let triangle = triangles[i];

        var triangleNormal = vec3<f32>(0.0);

        let currentDistance = intersectTriangle(
            origin,
            direction,
            triangle,
            &triangleNormal
        );

        if (currentDistance > 0.0 && currentDistance < closestDistance) {
            closestDistance = currentDistance;
            hitMaterialId = triangle.materialId;
            hitNormal = triangleNormal;
            hitTriangle = triangle;
        }
    }

    let point = origin + direction * closestDistance;

    // if distance is still -1.0, it means we didn't hit anything, so we can return a default intersection
    return Intersection(
        point,
        closestDistance,
        hitNormal,
        hitMaterialId
    );
}