import * as THREE from 'three';
import { Utils } from './utils';

export class VectorUtils {
    public static randomVector(): THREE.Vector3 {
        return new THREE.Vector3(Math.random(), Math.random(), Math.random());
    }

    public static randomUnitVectorInInterval(min: number = -1, max: number = 1): THREE.Vector3 {
        const randomVector = new THREE.Vector3();

        while (true) {
            this.randomVectorInInterval(min, max, randomVector);
            const lengthSquared = randomVector.lengthSq(); 
            if (1e-8 < lengthSquared && lengthSquared <= 1) return randomVector.divideScalar(Math.sqrt(lengthSquared));
        }
    }
    
    public static randomVectorInInterval(min: number, max: number, vector?: THREE.Vector3): THREE.Vector3 {
        const x = Utils.randomInInterval(min, max);
        const y = Utils.randomInInterval(min, max);
        const z = Utils.randomInInterval(min, max);

        return vector ? vector.set(x, y, z) : new THREE.Vector3(x, y, z);
    }

    public static randomOnSurface(normal: THREE.Vector3): THREE.Vector3 {
        const random = this.randomUnitVectorInInterval();
        return random.dot(normal) > 0 ? random : random.multiplyScalar(-1);
    }
}