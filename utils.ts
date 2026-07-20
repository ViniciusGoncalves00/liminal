export class Utils {
    public static randomInInterval(min: number, max: number): number {
        return  min + (max - min) * Math.random();
    }
}