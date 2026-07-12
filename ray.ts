// import * as THREE from 'three';

// export class Ray {
//     public readonly origin: THREE.Vector3;
//     public readonly direction: THREE.Vector3;

//     public constructor(origin?: THREE.Vector3, direction?: THREE.Vector3
//     ) {
//         this.origin = origin?.clone() ?? new THREE.Vector3();
//         this.direction = direction?.clone().normalize() ?? new THREE.Vector3();
//     }

//     public at(t: number): THREE.Vector3 {
//         return this.origin.clone().add(this.direction.clone().multiplyScalar(t));
//     }

//     public set(origin: THREE.Vector3, direction: THREE.Vector3): void {
//         this.origin.copy(origin);
//         this.direction.copy(direction).normalize();
//     }

//     public setOrigin(origin: THREE.Vector3): void {
//         this.origin.copy(origin);
//     }

//     public setDirection(direction: THREE.Vector3): void {
//         this.direction.copy(direction).normalize();
//     }
// }