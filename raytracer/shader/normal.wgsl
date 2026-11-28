@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<storage, read> triangles: array<Triangle>;

@group(0) @binding(2)
var outputTexture: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3)
var<storage, read> bvh: array<BVHNode>;

@group(0) @binding(4)
var<storage, read> spheres: array<Sphere>;

@group(0) @binding(5)
var depthTexture: texture_storage_2d<r32float, write>;


@compute @workgroup_size(8, 8)
fn main(
    @builtin(global_invocation_id) id: vec3<u32>
) {
    let textureSize = textureDimensions(outputTexture);

    if (id.x >= textureSize.x || id.y >= textureSize.y) {
        return;
    }

    // ============================================================
    // Primary ray
    // ============================================================

    let TEXTURE_SIZE = vec2<f32>(
        f32(textureSize.x),
        f32(textureSize.y)
    );

    let pixel = vec2<f32>(id.xy) + vec2<f32>(0.5);

    let scale = camera.params.x;
    let aspect = camera.params.y;

    var uv = pixel / TEXTURE_SIZE;

    uv = uv * 2.0 - 1.0;
    uv.y = -uv.y;
    uv.x *= aspect;
    uv *= scale;

    let origin = camera.position.xyz;

    let direction = normalize(
        camera.forward.xyz +
        uv.x * camera.right.xyz +
        uv.y * camera.up.xyz
    );

    // ============================================================
    // First intersection
    // ============================================================

    let triangleHit = intersectTriangles(origin, direction);
    let sphereHit = intersectSpheres(origin, direction);

    let hasTriangle = triangleHit.count > 0u;
    let hasSphere = sphereHit.hit;

    let pixelCoord = vec2<i32>(id.xy);

    // ============================================================
    // Sky
    // ============================================================

    if (!hasTriangle && !hasSphere) {
        textureStore(
            outputTexture,
            pixelCoord,
            vec4<f32>(0.0)
        );

        textureStore(
            depthTexture,
            pixelCoord,
            vec4<f32>(0.0)
        );

        return;
    }

    // ============================================================
    // Nearest intersection
    // ============================================================

    var normal: vec3<f32>;
    var hitDistance: f32;

    if (hasSphere && (
        !hasTriangle ||
        sphereHit.distance < triangleHit.intersections[0].distance
    )) {
        normal = sphereHit.normal;
        hitDistance = sphereHit.distance;

    } else {
        let hit = triangleHit.intersections[0];
        let triangle = triangles[hit.triangleIndex];

        normal = triangle.normal;
        hitDistance = hit.distance;
    }

    // ============================================================
    // Orient normal towards camera
    // ============================================================

    if (dot(direction, normal) > 0.0) {
        normal = -normal;
    }

    normal = normalize(normal);

    // ============================================================
    // Linear camera-space depth
    // ============================================================

    let hitPosition = origin + direction * hitDistance;

    let cameraForward = normalize(camera.forward.xyz);

    let depth = dot(
        hitPosition - origin,
        cameraForward
    );

    // ============================================================
    // Output
    // ============================================================

    textureStore(
        outputTexture,
        pixelCoord,
        vec4<f32>(normal, 1.0)
    );

    textureStore(
        depthTexture,
        pixelCoord,
        vec4<f32>(depth, 0.0, 0.0, 1.0)
    );
}