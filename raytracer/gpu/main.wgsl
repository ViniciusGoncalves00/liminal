@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<storage, read> triangles : array<Triangle>;
@group(0) @binding(2) var<storage, read> materials : array<Material>;
@group(0) @binding(3) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> time: Time;
@group(0) @binding(5) var<storage, read> bvh : array<BVHNode>;

struct BVHNode {
    min : vec4<f32>,
    max : vec4<f32>,
    data : vec4<u32>,
    padding : vec4<u32>,
};

@compute @workgroup_size(8, 8)
fn main( @builtin(global_invocation_id) id : vec3<u32>) {
    let textureSize = textureDimensions(outputTexture);

    if (id.x >= textureSize.x ||id.y >= textureSize.y) {
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

        var MAX_BOUNCES = 8u;
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
        
        var lastBounce = 0u;
        var lightStrength = 0.0;

        for (var bounce = 0u; bounce < MAX_BOUNCES; bounce++) {
            lastBounce = bounce;
            let intersection = closestIntersection(origin, direction);

            let hittedNothing = intersection.distance >= 1e30;

            if (hittedNothing) {
                let intensity = abs(direction.y);

                let darkBlue = vec3<f32>(0.10, 0.25, 0.50);
                let lightBlue = vec3<f32>(0.25, 0.55, 0.85);

                let skyColor = mix(lightBlue, darkBlue, intensity);
                rayColor += skyColor / (f32(bounce) + 1.0);
                lightStrength = rgbToHsv(skyColor)[2];
                break;
            }

            let material = materials[intersection.materialId];

            let lightSourceIntensity = material.properties[2];
            let hittedLightSource = lightSourceIntensity > 0.0;

            if (hittedLightSource) {
                rayColor += material.baseColor.rgb * lightSourceIntensity;
                lightStrength = lightSourceIntensity;
                break;
            }

            rayColor += material.baseColor.rgb / (f32(bounce) + 1.0) * rgbToHsv(material.baseColor.rgb)[2];

            origin = intersection.point + intersection.normal * 0.01;

            let randomDirection = randomHemisphere(intersection.normal, &seed);
            let randomLambertianDirection = intersection.normal + randomDirection;
            let reflectedDirection = reflect(direction, intersection.normal);
            let materialRoughness = material.properties[0];

            direction = normalize(mix(reflectedDirection, randomLambertianDirection, materialRoughness));
        }

        pixelColor += rayColor * lightStrength / f32(lastBounce + 1u);
    }

    pixelColor = pixelColor / f32(samplesPerPixel);

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

// fn closestIntersection(origin: vec3<f32>, direction: vec3<f32>) -> Intersection {
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

fn closestIntersection(origin: vec3<f32>, direction: vec3<f32>) -> Intersection {
    var closestDistance = 1e30;
    var hitMaterialId = 0u;
    var hitNormal = vec3<f32>(0.0);

    var hitTriangle: Triangle;

    let triangleCount = arrayLength(&triangles);

    var stack : array<u32, 64>;
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
    
        if (node.data.w > 0u) {
            for (
        var i = 0u;
        i < node.data.w;
        i++
    ) {

        let triangle =
            triangles[
                node.data.z + i
            ];

        var triangleNormal = vec3<f32>(0.0);

        let currentDistance = intersectRayTriangle(
            origin,
            direction,
            triangle,
            &triangleNormal
        );

        if (
            currentDistance > 0.0 &&
            currentDistance < closestDistance
        ) {
            closestDistance = currentDistance;
            hitMaterialId = triangle.materialId;
            hitNormal = triangleNormal;
            hitTriangle = triangle;
        }
    }
    
        } else {
        
            // internal node
    
            stack[stackSize] =
                node.data.x;
    
            stackSize++;
    
            stack[stackSize] =
                node.data.y;
    
            stackSize++;
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