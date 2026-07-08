import "./style.css";
import * as THREE from 'three';
import { SceneLayer, SceneManager } from "./sceneManager";

const editorView = document.getElementById('editor-view') as HTMLCanvasElement;
const gameView = document.getElementById('game-view') as HTMLCanvasElement;

const sceneManager = new SceneManager(editorView, gameView);

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );

sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);

const loop = () => {
    requestAnimationFrame(loop);
    sceneManager.animate();
}

loop();