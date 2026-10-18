import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RayTracingRenderer } from './raytracer/raytracing-renderer';
import { GPUScene } from './raytracer/gpu/gpu-scene';
import { GPUCamera } from './raytracer/gpu/gpu-camera';
import { Ambient } from './raytracer/ambient';

export const SceneLayer = {
    Game: 0,
    Editor: 1,
};

export type SceneLayer = typeof SceneLayer[keyof typeof SceneLayer];

export class SceneManager {
    private editorCanvas: HTMLCanvasElement;
    private gameCanvas: HTMLCanvasElement;

    private threeScene: THREE.Scene;
    public gpuScene: GPUScene;

    private editorRenderer: THREE.WebGLRenderer;
    public gameRenderer: RayTracingRenderer;

    public editorCamera: THREE.PerspectiveCamera;
    public gameCamera: THREE.PerspectiveCamera;
    public gpuCamera: GPUCamera;

    private editorControls: OrbitControls;
    private gameControls: OrbitControls;

    public ambient: Ambient = new Ambient();

    public constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, editorElement?: HTMLCanvasElement, gameElement?: HTMLCanvasElement) {
        this.editorCanvas = editorElement ?? this.createCanvas('editor-view');
        this.gameCanvas = gameElement ?? this.createCanvas('game-view');

        this.threeScene = new THREE.Scene();
        this.gpuScene = new GPUScene(device);
        this.setSunIntensity(1.1);
        this.setSunDirection(0, 1 ,0);
        this.setFogColor(0.8, 0.8, 0.8);
        this.setHorizonColor(0.25, 0.55, 0.85);
        this.setZenithColor(0.10, 0.25, 0.50);

        this.editorRenderer = new THREE.WebGLRenderer({canvas: this.editorCanvas})
        this.gameRenderer = new RayTracingRenderer(device, context, format, this.gameCanvas);

        this.resize();

        this.gameCamera = this.createGameCamera();
        this.editorCamera = this.createEditorCamera();
        this.gpuCamera = new GPUCamera(device);

        this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.1));
        this.threeScene.add(this.gameCamera);
        this.threeScene.add(this.editorCamera);

        this.editorCamera.layers.enable(SceneLayer.Game);
        this.editorCamera.layers.enable(SceneLayer.Editor);

        this.gameCamera.layers.enable(SceneLayer.Game);
        this.gameCamera.layers.disable(SceneLayer.Editor);

        this.editorControls = new OrbitControls(
            this.editorCamera,
            this.editorRenderer.domElement
        );
        
        this.gameControls = new OrbitControls(
            this.gameCamera,
            this.gameCanvas
        );

        new TransformControls(this.editorCamera, this.editorRenderer.domElement);

        this.createHelpers();

        window.addEventListener('resize', () => this.resize());
    }

    public animate(deltaTime: number): void {
        this.editorControls.update(deltaTime);
        this.gameControls.update(deltaTime);

        this.gpuScene.update(this.threeScene);
        this.gpuCamera.update(this.gameCamera, this.gameCanvas.width / this.gameCanvas.height);

        this.editorRenderer.render(this.threeScene, this.editorCamera);
        this.gameRenderer.render(this.gpuScene, this.gpuCamera);
    }

    /**
     * Adds an object to the scene.
     * By default it is visible in both editor and game.
     */
    public addObject(object: THREE.Object3D, ...layers: SceneLayer[]): void {
        object.layers.disableAll();

        if (layers.length === 0) {
            object.layers.enable(SceneLayer.Game);
            object.layers.enable(SceneLayer.Editor);
        } else {
            layers.forEach(layer => object.layers.enable(layer));
        }

        this.threeScene.add(object);
        this.gpuScene.update(this.threeScene);
    }

    public addChildObject(
        object: THREE.Object3D,
        parent: THREE.Object3D,
        ...layers: SceneLayer[]
    ): void {

        object.layers.disableAll();

        if (layers.length === 0)
            object.layers.enable(SceneLayer.Game);
        else
            layers.forEach(layer => object.layers.enable(layer));

        parent.add(object);
    }

    public removeObject(object: THREE.Object3D): void {
        this.threeScene.remove(object);
    }

    public setHorizonColor(r: number, g: number, b: number): void {
        this.ambient.setHorizonColor(r, g, b);
        this.gpuScene.gpuAmbient.setHorizonColor(r, g, b);
    }
    
    public setZenithColor(r: number, g: number, b: number): void {
        this.ambient.setZenithColor(r, g, b);
        this.gpuScene.gpuAmbient.setZenithColor(r, g, b);
    }

    public setFogColor(r: number, g: number, b: number): void {
        this.ambient.setFogColor(r, g, b);
        this.gpuScene.gpuAmbient.setFogColor(r, g, b);
    }
    
    public setSunDirection(x: number, y: number, z: number): void {
        this.threeScene.getObjectByName("sun")?.lookAt(x, y ,z);
        this.ambient.setSunDirection(x, y, z);
        this.gpuScene.gpuAmbient.setSunDirection(x, y, z);
    }

    public setSunIntensity(v: number): void {
        this.ambient.setSunIntensity(v);
        this.gpuScene.gpuAmbient.setSunIntensity(v);
    }

    private createCanvas(id: string): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.id = id;
        document.body.appendChild(canvas);
        return canvas;
    }

    private resize(): void {
        const editorWidth = this.editorCanvas.clientWidth;
        const editorHeight = this.editorCanvas.clientHeight;

        const gameWidth = this.gameCanvas.clientWidth;
        const gameHeight = this.gameCanvas.clientHeight;

        this.editorRenderer.setSize(editorWidth, editorHeight, false);
        this.gameRenderer.setSize(gameWidth, gameHeight, false);

        if (this.editorCamera) {
            this.editorCamera.aspect = editorWidth / editorHeight;
            this.editorCamera.updateProjectionMatrix();
        }

        if (this.gameCamera) {
            this.gameCamera.aspect = gameWidth / gameHeight;
            this.gameCamera.updateProjectionMatrix();
        }
    }

    private createGameCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            45,
            this.gameCanvas.clientWidth / this.gameCanvas.clientHeight,
            0.1,
            10000
        );

        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);

        return camera;
    }

    private createEditorCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            this.editorCanvas.clientWidth / this.editorCanvas.clientHeight,
            0.1,
            10000
        );

        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);

        return camera;
    }

    private createHelpers(): void {
        const grid = new THREE.GridHelper(20, 20);
        this.addObject(grid, SceneLayer.Editor);

        const axes = new THREE.AxesHelper(2);
        this.addObject(axes, SceneLayer.Editor);

        const gameCameraHelper = new THREE.CameraHelper(this.gameCamera);
        this.addObject(gameCameraHelper, SceneLayer.Editor);

        const light = new THREE.DirectionalLight();
        light.name = "sun";
        light.castShadow = true;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500;
        this.addObject(light, SceneLayer.Editor, SceneLayer.Game);

        const lightHelper = new THREE.DirectionalLightHelper(light, 5);
        this.addObject(lightHelper, SceneLayer.Editor);
    }
}