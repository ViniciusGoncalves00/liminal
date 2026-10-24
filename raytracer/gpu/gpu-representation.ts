export interface GPURepresentation {
    set(...params: any): this;
    write(array: ArrayBuffer, byteOffset: number): number;
}