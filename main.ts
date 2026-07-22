import "./style.css";
import * as THREE from 'three';
import { SceneLayer, SceneManager } from "./sceneManager";
import { ObjectFactory } from "./objectFactory";

const editorView = document.getElementById('editor-view') as HTMLCanvasElement;
const gameView = document.getElementById('game-view') as HTMLCanvasElement;

const sceneManager = new SceneManager(editorView, gameView);

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshPhysicalMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );

sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);

const baseGeometry = new THREE.BoxGeometry( 3, 0.1, 3 );
const floor = new THREE.Mesh( baseGeometry, material );
floor.position.set(0, -1.5, 0);

sceneManager.addObject(floor, SceneLayer.Game, SceneLayer.Editor);

const roof = new THREE.Mesh( baseGeometry, material );
roof.position.set(0, 1.5, 0);

sceneManager.addObject(roof, SceneLayer.Game, SceneLayer.Editor);

const right = new THREE.Mesh( baseGeometry, material );
right.position.set(1.5, 0, 0);
right.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(right, SceneLayer.Game, SceneLayer.Editor);

const left = new THREE.Mesh( baseGeometry, material );
left.position.set(-1.5, 0, 0);
left.rotateZ(THREE.MathUtils.degToRad(90));

sceneManager.addObject(left, SceneLayer.Game, SceneLayer.Editor);

const loop = () => {
    requestAnimationFrame(loop);
    sceneManager.animate();
}

loop();