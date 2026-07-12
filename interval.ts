export class Interval {
    public readonly min: number;
    public readonly max: number;

    public constructor(min: number = -Infinity, max: number = Infinity) {
        this.min = min;
        this.max = max;
    }

    public size(): number {
        return this.max - this.min;
    }

    public contains(t: number): boolean {
        return this.min <= t && t <= this.max;
    }

    public surrounds(t: number): boolean {
        return this.min < t && t < this.max;
    }

    public clamp(t: number): number {
        if (t < this.min) return this.min;
        if (t > this.max) return this.max;
        return t;
    }
}