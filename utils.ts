export class Utils {
    public static randomInInterval(min: number, max: number): number {
        return  min + (max - min) * Math.random();
    }

    public static linearSpaceToGammaSpace(value: number): number {
        return value > 0 ? Math.sqrt(value) : 0;
    }
}