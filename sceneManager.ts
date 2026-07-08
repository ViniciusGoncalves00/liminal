import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const SceneLayer = {
    Game: 0,
    Editor: 1,
    GameOnly: 2,
};

export type SceneLayer = typeof SceneLayer[keyof typeof SceneLayer];

export class SceneManager {
    private readonly editorView: HTMLCanvasElement;
    private readonly gameView: HTMLCanvasElement;

    private readonly scene: THREE.Scene;

    private readonly editorRenderer: THREE.WebGLRenderer;
    private readonly gameRenderer: THREE.WebGLRenderer;

    private readonly editorCamera: THREE.PerspectiveCamera;
    private readonly gameCamera: THREE.PerspectiveCamera;

    private readonly editorControls: OrbitControls;

    public constructor(
        editorElement?: HTMLCanvasElement,
        gameElement?: HTMLCanvasElement,
        scene: THREE.Scene = new THREE.Scene()
    ) {
        this.editorView = editorElement ?? this.createCanvas('editor-view');
        this.gameView = gameElement ?? this.createCanvas('game-view');

        this.scene = scene;

        this.editorRenderer = new THREE.WebGLRenderer({
            canvas: this.editorView
        });

        this.gameRenderer = new THREE.WebGLRenderer({
            canvas: this.gameView
        });

        this.resize();

        this.gameCamera = this.createGameCamera();
        this.editorCamera = this.createEditorCamera();

        //
        // Configure visible layers
        //

        // Game camera
        this.gameCamera.layers.enable(SceneLayer.Game);
        this.gameCamera.layers.disable(SceneLayer.Editor);
        this.gameCamera.layers.disable(SceneLayer.GameOnly);

        // Editor camera
        this.editorCamera.layers.enable(SceneLayer.Game);
        this.editorCamera.layers.enable(SceneLayer.Editor);
        this.editorCamera.layers.enable(SceneLayer.GameOnly);

        this.editorControls = new OrbitControls(
            this.editorCamera,
            this.editorRenderer.domElement
        );

        new OrbitControls(
            this.gameCamera,
            this.gameRenderer.domElement
        );

        this.createHelpers();

        window.addEventListener('resize', () => this.resize());
    }

    public animate(): void {
        this.editorControls.update();

        this.editorRenderer.render(this.scene, this.editorCamera);
        this.gameRenderer.render(this.scene, this.gameCamera);
    }

    /**
     * Adds an object to the scene.
     * By default it is visible in both editor and game.
     */
    public addObject(
        object: THREE.Object3D,
        ...layers: SceneLayer[]
    ): void {

        object.layers.disableAll();

        if (layers.length === 0) {
            object.layers.enable(SceneLayer.Game);
        } else {
            layers.forEach(layer => object.layers.enable(layer));
        }

        this.scene.add(object);
    }

    public removeObject(object: THREE.Object3D): void {
        this.scene.remove(object);
    }

    private createCanvas(id: string): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.id = id;
        document.body.appendChild(canvas);
        return canvas;
    }

    private resize(): void {
        const editorWidth = this.editorView.clientWidth;
        const editorHeight = this.editorView.clientHeight;

        const gameWidth = this.gameView.clientWidth;
        const gameHeight = this.gameView.clientHeight;

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
            this.gameView.clientWidth / this.gameView.clientHeight,
            0.1,
            10000
        );

        camera.position.set(0, 0, 3);
        camera.lookAt(0, 0, 0);

        return camera;
    }

    private createEditorCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            this.editorView.clientWidth / this.editorView.clientHeight,
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
    }
}