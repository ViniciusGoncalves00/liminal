fn intersectRayTriangle(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, triangle: Triangle, hitNormal: ptr<function, vec3<f32>>) -> f32 {       
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
            
    *hitNormal = normalize(cross(edge1, edge2));
            
    return t;
}

fn rayIntersectionsWithAABB(rayOrigin: vec3<f32>, rayDirection: vec3<f32>, aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> u32 {
    var intersectionsCount = 0u;

    let intersectionNXPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 1,  0,  0));
    let intersectionNXNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>(-1,  0,  0));
    let intersectionNYPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 0,  1,  0));
    let intersectionNYNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>( 0, -1,  0));
    let intersectionNZPositive = rayIntersectsPlane(rayOrigin, rayDirection, aabbMax, vec3<f32>( 0,  0,  1));
    let intersectionNZNegative = rayIntersectsPlane(rayOrigin, rayDirection, aabbMin, vec3<f32>( 0,  0, -1));

    //X normals, ignores X
    if (insideInterval(aabbMin.y, aabbMax.y, intersectionNXPositive.y) && insideInterval(aabbMin.z, aabbMax.z, intersectionNXPositive.z)) {
        intersectionsCount++;
    }
    if (insideInterval(aabbMin.y, aabbMax.y, intersectionNXNegative.y) && insideInterval(aabbMin.z, aabbMax.z, intersectionNXNegative.z)) {
        intersectionsCount++;
    }

    //Y faces, ignores Y
    if (insideInterval(aabbMin.z, aabbMax.z, intersectionNYPositive.z) && insideInterval(aabbMin.x, aabbMax.x, intersectionNYPositive.x)) {
        intersectionsCount++;
    }
    if (insideInterval(aabbMin.z, aabbMax.z, intersectionNYNegative.z) && insideInterval(aabbMin.x, aabbMax.x, intersectionNYNegative.x)) {
        intersectionsCount++;
    }

    //Z faces, ignores Z
    if (insideInterval(aabbMin.x, aabbMax.x, intersectionNZPositive.x) && insideInterval(aabbMin.y, aabbMax.y, intersectionNZPositive.y)) {
        intersectionsCount++;
    }
    if (insideInterval(aabbMin.x, aabbMax.x, intersectionNZNegative.x) && insideInterval(aabbMin.y, aabbMax.y, intersectionNZNegative.y)) {
        intersectionsCount++;
    }

    return intersectionsCount;
}

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