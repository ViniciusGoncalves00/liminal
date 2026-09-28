import "./style.css";
import * as THREE from 'three';
import { SceneLayer, SceneManager } from "./sceneManager";
import { ObjectFactory } from "./objectFactory";

const editorView = document.getElementById('editor-view') as HTMLCanvasElement;
const gameView = document.getElementById('game-view') as HTMLCanvasElement;

const sceneManager = new SceneManager(editorView, gameView);

const cube = new THREE.Mesh( new THREE.BoxGeometry(2.0, 2.0, 2.0), new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.8, metalness: 0.5, emissiveIntensity: 0.0 } ));
cube.position.set(0.0 , 1.43, 0.0);
cube.rotateY(Math.PI / 6);
// sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);

const cube2 = new THREE.Mesh( new THREE.BoxGeometry(2.0, 1.0, 1.0), new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0.2, metalness: 0.5, emissiveIntensity: 1.0 } ));
cube2.position.set(0.0, 1.85, 0.0);
sceneManager.addObject(cube2, SceneLayer.Game, SceneLayer.Editor);

const cube3 = new THREE.Mesh( new THREE.BoxGeometry(4.8, 1.0, 1.0), new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0.98, metalness: 0.5, emissiveIntensity: 0.0 } ));
cube3.position.set(0.0, -1.0, 0.0);
sceneManager.addObject(cube3, SceneLayer.Game, SceneLayer.Editor);

const sphere = new THREE.Mesh( new THREE.SphereGeometry(1.0, 6, 6), new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0.0, metalness: 0.5, emissiveIntensity: 0.0 } ));
// sceneManager.addObject(sphere, SceneLayer.Game, SceneLayer.Editor);

const baseGeometry = new THREE.BoxGeometry( 5, 0.1, 5 );
const floor = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.8, metalness: 0.5, emissiveIntensity: 0.0 } ) );
floor.position.set(0, -2.5, 0);

sceneManager.addObject(floor, SceneLayer.Game, SceneLayer.Editor);

const ceiling = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 1.0, metalness: 0.5, emissiveIntensity: 0.0 } ) );
ceiling.position.set(0, 2.5, 0);

sceneManager.addObject(ceiling, SceneLayer.Game, SceneLayer.Editor);

const right = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xff0000, roughness: 0.5, metalness: 0.5, emissiveIntensity: 0.0 } ) );
right.position.set(2.5, 0, 0);
right.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(right, SceneLayer.Game, SceneLayer.Editor);

const left = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0x00ff00, roughness: 0.02, metalness: 0.5, emissiveIntensity: 0.0 } ) );
left.position.set(-2.5, 0, 0);
left.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(left, SceneLayer.Game, SceneLayer.Editor);

const back = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 1.0, metalness: 0.5, emissiveIntensity: 0.0 } ) );
back.position.set(0, 0, -2.5);
back.rotateX(THREE.MathUtils.degToRad(90));

sceneManager.addObject(back, SceneLayer.Game, SceneLayer.Editor);

const plafon = new THREE.Mesh( new THREE.BoxGeometry( 3, 0.01, 3 ), new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 } ) );
plafon.position.set(0, 2.4, 0);

// sceneManager.addObject(plafon, SceneLayer.Game, SceneLayer.Editor);

const front = new THREE.Mesh( new THREE.BoxGeometry( 5, 0.1, 5 ), new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.5, metalness: 0.5, emissiveIntensity: 0.0 } ) );
front.position.set(0, 0, 2.5);
front.rotateX(THREE.MathUtils.degToRad(90));

// sceneManager.addObject(front, SceneLayer.Game, SceneLayer.Editor);

let lastTime = 0;
const loop = (time: number) => {
    requestAnimationFrame(loop);
    sceneManager.animate();

    const t = time * 0.001;
    const deltaTime = (time - lastTime) * 0.001;
    lastTime = time;
    cube3.position.y = Math.sin(t) - 0.95;
    // cube.position.x = Math.cos(t);
    // cube.position.z = Math.sin(t);
    cube2.rotation.y += deltaTime;
}

loop(0);