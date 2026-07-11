import * as THREE from 'three';

export class ObjectFactory {
    public static ray(points: THREE.Vector3[]): THREE.Line {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Line(geometry, material);
        return line;
    }

    public static createCameraGrid(
        camera: THREE.PerspectiveCamera,
        columns: number,
        rows: number
    ): THREE.LineSegments {

        const distance = camera.near + 0.01;
        const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
        const width = height * camera.aspect;
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= columns; i++) {
            const x = -width / 2 + (width * i) / columns;

            points.push(new THREE.Vector3(x, -height / 2, 0));
            points.push(new THREE.Vector3(x,  height / 2, 0));
        }

        for (let i = 0; i <= rows; i++) {
            const y = -height / 2 + (height * i) / rows;

            points.push(new THREE.Vector3(-width / 2, y, 0));
            points.push(new THREE.Vector3( width / 2, y, 0));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({color: 0xffffff});
        const grid = new THREE.LineSegments(geometry, material);
        grid.position.z = -distance;

        return grid;
    }
}