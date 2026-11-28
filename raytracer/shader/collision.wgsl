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

fn intersectRayTriangle(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, triangle: Triangle) -> f32 {       
    let edge1 = triangle.p1.xyz - triangle.p0.xyz;
    let edge2 = triangle.p2.xyz - triangle.p0.xyz;
            
    let pvec = cross(rayDirection, edge2);
            
    let det = dot(edge1, pvec);
            
    if (abs(det) < 0.000001) {
        return -1.0;
    }
            
    let invDet = 1.0 / det;
            
    let tvec = rayOrigin - triangle.p0.xyz;
            
    let u = dot(tvec, pvec) * invDet;
            
    if (u < 0.0 || u > 1.0) {
        return -1.0;
    }
            
    let qvec = cross(tvec, edge1);
            
    let v = dot(rayDirection, qvec) * invDet;
            
    if (v < 0.0 || u + v > 1.0) {
        return -1.0;
    }
            
    let t = dot(edge2, qvec) * invDet;
            
    if (t <= 0.0) {
        return -1.0;
    }
            
    return t;
}

fn intersectSphere(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, sphere: Sphere) -> f32 {
    let oc = rayOrigin - sphere.center;
    let radius = sphere.radius;

    let a = dot(rayDirection, rayDirection);
    let halfB = dot(oc, rayDirection);
    let c = dot(oc, oc) - radius * radius;

    let discriminant = halfB * halfB - a * c;

    if (discriminant < 0.0) {
        return -1.0;
    }

    let sqrtD = sqrt(discriminant);
    let t1 = (-halfB - sqrtD) / a;
    let t2 = (-halfB + sqrtD) / a;

    if (t1 > 0.001) {
        return t1;
    }

    if (t2 > 0.001) {
        return t2;
    }

    return -1.0;
}

// fn rayIntersectionsWithAABB(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> u32 {
//     var intersectionsCount = 0u;

//     let intersectionNXPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 1,  0,  0));
//     let intersectionNXNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>(-1,  0,  0));
//     let intersectionNYPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 0,  1,  0));
//     let intersectionNYNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>( 0, -1,  0));
//     let intersectionNZPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 0,  0,  1));
//     let intersectionNZNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>( 0,  0, -1));

//     //X normals, ignores X
//     if (insideInterval(aabbMin.y, aabbMax.y, intersectionNXPositive.y) && insideInterval(aabbMin.z, aabbMax.z, intersectionNXPositive.z)) {
//         intersectionsCount++;
//     }
//     if (insideInterval(aabbMin.y, aabbMax.y, intersectionNXNegative.y) && insideInterval(aabbMin.z, aabbMax.z, intersectionNXNegative.z)) {
//         intersectionsCount++;
//     }

//     //Y faces, ignores Y
//     if (insideInterval(aabbMin.z, aabbMax.z, intersectionNYPositive.z) && insideInterval(aabbMin.x, aabbMax.x, intersectionNYPositive.x)) {
//         intersectionsCount++;
//     }
//     if (insideInterval(aabbMin.z, aabbMax.z, intersectionNYNegative.z) && insideInterval(aabbMin.x, aabbMax.x, intersectionNYNegative.x)) {
//         intersectionsCount++;
//     }

//     //Z faces, ignores Z
//     if (insideInterval(aabbMin.x, aabbMax.x, intersectionNZPositive.x) && insideInterval(aabbMin.y, aabbMax.y, intersectionNZPositive.y)) {
//         intersectionsCount++;
//     }
//     if (insideInterval(aabbMin.x, aabbMax.x, intersectionNZNegative.x) && insideInterval(aabbMin.y, aabbMax.y, intersectionNZNegative.y)) {
//         intersectionsCount++;
//     }

//     return intersectionsCount;
// }

fn rayIntersectsPlane(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, planeOrigin: vec3<f32>, planeNormal: vec3<f32>) -> vec3<f32> {
    return vec3<f32>();
}

fn insideInterval(min: f32, max: f32, t: f32) -> bool {
    if (t < min) {
        return false;
    }
    if (t > max) {
        return false;
    }
    return true;
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

        if (!rayIntersectionsWithAABB(origin, direction, node.min.xyz, node.max.xyz)) {
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

fn rayIntersectionsWithAABB(
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