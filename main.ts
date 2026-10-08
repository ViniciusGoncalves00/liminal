import "./style.css";
import * as THREE from 'three';
import { SceneLayer, SceneManager } from "./sceneManager";
import { ObjectFactory } from "./objectFactory";

const editorView = document.getElementById('editor-view') as HTMLCanvasElement;
const gameView = document.getElementById('game-view') as HTMLCanvasElement;
const fps = document.getElementById('fps') as HTMLDivElement;

const sceneManager = new SceneManager(editorView, gameView);

createRoom();
createSphere();
// createAOCubes();
// createManyCubes();
// createManyLights();

let lastTime = 0;
const loop = (time: number) => {
    requestAnimationFrame(loop);

    const deltaTime = 1000 / (time - lastTime);
    sceneManager.animate(deltaTime);
    
    fps.innerText = deltaTime.toFixed(0) + " FPS";

    lastTime = time;
}

loop(0);

function createRoom() {
    const baseGeometry = new THREE.BoxGeometry( 5, 0.1, 5 );
    const floor = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    floor.position.set(0, -2.5, 0);

    sceneManager.addObject(floor, SceneLayer.Game, SceneLayer.Editor);

    const ceiling = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0x222222, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    ceiling.position.set(0, 2.5, 0);

    sceneManager.addObject(ceiling, SceneLayer.Game, SceneLayer.Editor);

    const right = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xff0000, roughness: 0.5, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    right.position.set(2.5, 0, 0);
    right.rotateZ(THREE.MathUtils.degToRad(90));

    sceneManager.addObject(right, SceneLayer.Game, SceneLayer.Editor);

    const left = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0x00ff00, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    left.position.set(-2.5, 0, 0);
    left.rotateZ(THREE.MathUtils.degToRad(90));

    sceneManager.addObject(left, SceneLayer.Game, SceneLayer.Editor);

    const back = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    back.position.set(0, 0, -2.5);
    back.rotateX(THREE.MathUtils.degToRad(90));

    sceneManager.addObject(back, SceneLayer.Game, SceneLayer.Editor);

    const front = new THREE.Mesh( new THREE.BoxGeometry( 5, 0.1, 5 ), new THREE.MeshPhysicalMaterial( { color: 0xeeeeee, roughness: 0.5, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    front.position.set(0, 0, 2.5);
    front.rotateX(THREE.MathUtils.degToRad(90));

    // sceneManager.addObject(front, SceneLayer.Game, SceneLayer.Editor);
}

function createAOCubes() {
    const lightCube = new THREE.Mesh( new THREE.BoxGeometry(1.0, 1.0, 1.0), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.2, metalness: 0.0, emissiveIntensity: 1.0, ior: 0.0 } ));
    lightCube.position.set(0.0, 1.0, 0.0);
    sceneManager.addObject(lightCube, SceneLayer.Game, SceneLayer.Editor);

    const cube = new THREE.Mesh( new THREE.BoxGeometry(4.8, 1.0, 1.0), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.5, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
    cube.position.set(0.0, -1.0, 0.0);
    sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);
}

function createSphere() {
    const sphere = new THREE.Mesh( new THREE.SphereGeometry(1.0, 64, 64), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
    sceneManager.addObject(sphere, SceneLayer.Game, SceneLayer.Editor);
}

function createManyCubes() {
    for (let x = -4; x < 4; x++) {
        for (let y = -4; y < 4; y++) {
            for (let z = -4; z < 4; z++) {
                const odd = (x + y + z) % 2 !== 0 ? 1.0 : 0.0;
                const cube = new THREE.Mesh( new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshPhysicalMaterial( { color: 0xeeeeee, roughness: 0.8, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
                cube.position.set(x / 2 + 0.25, y / 2 + 0.25, z / 2 + 0.25);
                sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);
            }
        }
    }
}

function createManyLights() {
    for (let x = -1; x < 2; x++) {
        for (let z = -1; z < 2; z++) {
            const plafon = new THREE.Mesh( new THREE.BoxGeometry(1.0, 0.01, 1.0), new THREE.MeshPhysicalMaterial( { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 } ) );
            plafon.position.set(x * 1.5, 2.445, z * 1.5);
            sceneManager.addObject(plafon, SceneLayer.Game, SceneLayer.Editor);
        }
    }
}