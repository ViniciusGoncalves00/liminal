export const GPU_CAMERA_LAYOUT = {
    floatCount: 20,
    byteSize: 20 * Float32Array.BYTES_PER_ELEMENT,
} as const;

export const GPU_CAMERA_SHADER = `
    struct Camera {
        position : vec4<f32>,
        forward  : vec4<f32>,
        right    : vec4<f32>,
        up       : vec4<f32>,
        params   : vec4<f32>,
    };
`;