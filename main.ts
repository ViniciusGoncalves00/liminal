import "./style.css";
import * as THREE from 'three';
import { SceneLayer, SceneManager } from "./sceneManager";
import { ObjectFactory } from "./objectFactory";

const editorView = document.getElementById('editor-view') as HTMLCanvasElement;
const gameView = document.getElementById('game-view') as HTMLCanvasElement;

const sceneManager = new SceneManager(editorView, gameView);

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial( { color: 0xff0000, roughness: 0.5, metalness: 0.5 } ));

sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);

const baseGeometry = new THREE.BoxGeometry( 5, 0.1, 5 );
const floor = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xddaa22, roughness: 0.0, metalness: 0.5 } ) );
floor.position.set(0, -2.5, 0);

sceneManager.addObject(floor, SceneLayer.Game, SceneLayer.Editor);

const ceiling = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 1.0, metalness: 0.5 } ) );
ceiling.position.set(0, 2.5, 0);

sceneManager.addObject(ceiling, SceneLayer.Game, SceneLayer.Editor);

const right = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.0, metalness: 0.5 } ) );
right.position.set(2.5, 0, 0);
right.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(right, SceneLayer.Game, SceneLayer.Editor);

const left = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.5, metalness: 0.5 } ) );
left.position.set(-2.5, 0, 0);
left.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(left, SceneLayer.Game, SceneLayer.Editor);

const back = new THREE.Mesh( baseGeometry, new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 1.0, metalness: 0.5 } ) );
back.position.set(0, 0, -2.5);
back.rotateX(THREE.MathUtils.degToRad(90));

sceneManager.addObject(back, SceneLayer.Game, SceneLayer.Editor);

// const plafon = new THREE.Mesh( new THREE.BoxGeometry( 1, 0.1, 1 ), new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 } ) );
// plafon.position.set(0, 2.0, 0);
// sceneManager.addObject(plafon, SceneLayer.Game, SceneLayer.Editor);

// const front = new THREE.Mesh( new THREE.BoxGeometry( 5, 0.1, 5 ), new THREE.MeshStandardMaterial( { color: 0xeeeeee, roughness: 0.5, metalness: 0.5 } ) );
// front.position.set(0, 0, 2.5);
// front.rotateX(THREE.MathUtils.degToRad(90));

// sceneManager.addObject(front, SceneLayer.Game, SceneLayer.Editor);


const loop = () => {
    requestAnimationFrame(loop);
    sceneManager.animate();
}

loop();