export class AccumulationPass {
    private frame = 0;

    public reset() {
        this.frame = 0;
    }

    public nextFrame() {
        this.frame++;
    }

    public get frameIndex() {
        return this.frame;
    }
}