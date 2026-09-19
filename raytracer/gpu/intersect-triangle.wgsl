fn intersectTriangle(origin: vec3<f32>, direction: vec3<f32>, triangle: Triangle, hitNormal: ptr<function, vec3<f32>>) -> f32 {       
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