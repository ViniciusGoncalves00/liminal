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

// const ray = ObjectFactory.ray([
//     sceneManager.gameCamera.position.clone(),
//     sceneManager.gameCamera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10).add(sceneManager.gameCamera.position),
// ])

// sceneManager.addObject(ray, SceneLayer.Editor);
// sceneManager.gameCamera.add(ray);

const loop = () => {
    requestAnimationFrame(loop);
    sceneManager.animate();
}

loop();