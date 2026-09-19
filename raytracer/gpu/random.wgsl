fn random(seed: ptr<function, u32>) -> f32 {
    var x = *seed;

    x ^= x >> 16u;
    x *= 0x7feb352du;
    x ^= x >> 15u;
    x *= 0x846ca68bu;
    x ^= x >> 16u;

    *seed = x;

    return f32(x) / 4294967295.0;
}

fn randomRange(
    seed: ptr<function, u32>,
    min: f32,
    max: f32
) -> f32 {
    return min + random(seed) * (max - min);
}

fn randomUnitVector(seed: ptr<function, u32>) -> vec3<f32> {
    let z = random(seed) * 2.0 - 1.0;
    let phi = random(seed) * 2.0 * 3.14159265;

    let r = sqrt(1.0 - z * z);

    return vec3<f32>(
        r * cos(phi),
        r * sin(phi),
        z
    );
}

fn randomHemisphere(
    normal: vec3<f32>,
    seed: ptr<function, u32>
) -> vec3<f32> {

    var direction = randomUnitVector(seed);

    if (dot(direction, normal) < 0.0) {
        direction = -direction;
    }

    return direction;
}