// raytracer.wgsl

// ============================================================================
// OUTPUT
// ============================================================================

@group(0) @binding(0)
var outputTexture : texture_storage_2d<rgba8unorm, write>;

// ============================================================================
// TRIANGLES
// ============================================================================

struct Triangle {

    p0 : vec3<f32>,
    _0 : f32,

    p1 : vec3<f32>,
    _1 : f32,

    p2 : vec3<f32>,
    _2 : f32,

    normal : vec3<f32>,
    _3 : f32,
};

@group(0) @binding(2)
var<storage, read> triangles : array<Triangle>;

@group(0) @binding(3)
var<uniform> triangleCount : u32;

// ============================================================================
// RAY
// ============================================================================

struct Ray{
    origin : vec3<f32>,
    direction : vec3<f32>,
};

struct HitData{
    hit : bool,
    t : f32,
    point : vec3<f32>,
    normal : vec3<f32>,
};

// ============================================================================
// RANDOM
// ============================================================================

fn hash(v : vec2<u32>) -> f32{

    var x = v.x * 1973u + v.y * 9277u + 89173u;

    x = x * x * 60493u;

    return f32(x & 65535u) / 65535.0;
}

fn randomDirection(seed : vec2<u32>) -> vec3<f32>{
    let rx = hash(seed);
    let ry = hash(seed + vec2<u32>(17u,91u));
    let rz = hash(seed + vec2<u32>(63u,29u));

    return normalize(vec3<f32>(
        rx*2.0-1.0,
        ry*2.0-1.0,
        rz*2.0-1.0
    ));
}

// ============================================================================
// TRIANGLE INTERSECTION
// ============================================================================

fn intersectTriangle(ray : Ray, tri : Triangle) -> HitData{

    var hit : HitData;

    hit.hit = false;

    let edge1 = tri.p1 - tri.p0;
    let edge2 = tri.p2 - tri.p0;

    let pvec = cross(ray.direction, edge2);

    let det = dot(edge1, pvec);

    if(abs(det) < 0.000001){
        return hit;
    }

    let invDet = 1.0 / det;

    let tvec = ray.origin - tri.p0;

    let u = dot(tvec,pvec) * invDet;

    if(u < 0.0 || u > 1.0){

        return hit;
    }

    let qvec = cross(tvec,edge1);

    let v = dot(ray.direction,qvec) * invDet;

    if(v < 0.0 || u+v > 1.0){

        return hit;
    }

    let t = dot(edge2,qvec) * invDet;

    if(t < 0.001){

        return hit;
    }

    hit.hit = true;

    hit.t = t;

    hit.point = ray.origin + ray.direction*t;

    hit.normal = tri.normal;

    return hit;
}

// ============================================================================
// WORLD
// ============================================================================

fn worldHit(ray : Ray) -> HitData{

    var closest : HitData;

    closest.hit = false;

    closest.t = 1e30;

    for(var i=0u;i<triangleCount;i++){

        let hit = intersectTriangle(ray,triangles[i]);

        if(hit.hit && hit.t < closest.t){

            closest = hit;
        }
    }

    return closest;
}

// ============================================================================
// RAY COLOR
// ============================================================================

fn rayColor(ray0 : Ray, pixel : vec2<u32>) -> vec3<f32>{

    var ray = ray0;

    var attenuation = vec3<f32>(1.0);

    for(var bounce=0; bounce<5; bounce++){

        let hit = worldHit(ray);

        if(!hit.hit){

            let t = 0.5*(ray.direction.y+1.0);

            let sky = mix(

                vec3<f32>(1.0,0.75,0.5),

                vec3<f32>(0.5,0.75,1.0),

                t

            );

            return attenuation*sky;
        }

        attenuation*=0.5;

        ray.origin = hit.point;

        ray.direction = normalize(

            hit.normal +

            randomDirection(pixel+vec2<u32>(bounce*13u,bounce*29u))

        );
    }

    return vec3<f32>(0.0);
}

// ============================================================================
// MAIN
// ============================================================================

@compute
@workgroup_size(8,8)
fn main(

    @builtin(global_invocation_id)

    id : vec3<u32>

){

    if(id.x>=camera.width || id.y>=camera.height){

        return;
    }

    let uv = vec2<f32>(

        (f32(id.x)+0.5)/f32(camera.width),

        (f32(id.y)+0.5)/f32(camera.height)

    );

    let screen = vec2<f32>(

        uv.x*2.0-1.0,

        1.0-uv.y*2.0

    );

    var ray : Ray;

    ray.origin = camera.position;

    ray.direction = normalize(

        camera.forward +

        camera.right*screen.x*camera.halfWidth +

        camera.up*screen.y*camera.halfHeight

    );

    let color = rayColor(ray,id.xy);

    textureStore(

        outputTexture,

        vec2<i32>(id.xy),

        vec4<f32>(color,1.0)

    );
}