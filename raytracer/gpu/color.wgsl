fn hsvToRgb(hsv: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), hsv.y);
}

fn rgbToHsv(rgb: vec3<f32>) -> vec3<f32> {
    let r = rgb.r;
    let g = rgb.g;
    let b = rgb.b;

    let maxValue = max(r, max(g, b));
    let minValue = min(r, min(g, b));
    let delta = maxValue - minValue;

    var h = 0.0;
    var s = 0.0;
    let v = maxValue;

    if (maxValue > 0.0) {
        s = delta / maxValue;
    }

    if (delta > 0.0) {
        if (maxValue == r) {
            h = (g - b) / delta;

            if (h < 0.0) {
                h += 6.0;
            }

            h /= 6.0;
        } else if (maxValue == g) {
            h = ((b - r) / delta + 2.0) / 6.0;
        } else {
            h = ((r - g) / delta + 4.0) / 6.0;
        }
    }

    return vec3<f32>(h, s, v);
}