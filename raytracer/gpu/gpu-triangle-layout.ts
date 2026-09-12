export const GPU_TRIANGLE_LAYOUT = {
    floatCount: 20,
    byteSize: 20 * Float32Array.BYTES_PER_ELEMENT,
} as const;

export const GPU_TRIANGLE_SHADER = `
    struct Triangle {
        p0 : vec4<f32>,
        p1 : vec4<f32>,
        p2 : vec4<f32>,
        
        materialId : u32,
        _pad0 : u32,
        _pad1 : u32,
        _pad2 : u32,
    };
`;