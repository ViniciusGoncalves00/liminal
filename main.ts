import "./style.css";
import * as THREE from 'three';
import GUI from 'lil-gui';
import { SceneLayer, SceneManager } from "./sceneManager";
import type { GPUAmbient } from "./raytracer/gpu/gpu-ambient";
import type { Ambient } from "./raytracer/ambient";

const fps = document.getElementById('fps') as HTMLDivElement;

class Main {
    public static sceneManager: SceneManager;

    private static GPU_ADAPTER: GPUAdapter;
    private static GPU_DEVICE: GPUDevice;
    private static WEBGPU_CONTEXT: GPUCanvasContext;
    private static GPU_TEXTURE_FORMAT: GPUTextureFormat;
    private static initialized: boolean = false;

    public static async init(): Promise<void> {
        if (this.initialized) {
            console.warn("Cannot initialize the app twice.");
            return;
        }

        if (!navigator.gpu) {
            throw new Error("GPU not available in this browser.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if(!adapter) {
            throw new Error("Adapter cannot be found.");
        }
        this.GPU_ADAPTER = adapter;
        
        const device = await adapter.requestDevice();
        if(!device) {
            throw new Error("Device cannot be found.");
        }
        this.GPU_DEVICE = device;
        this.GPU_DEVICE.addEventListener("uncapturederror", event => {
            console.error("My custom WebGPU error:", event.error);
        });

        const gameCanvas = document.getElementById('game-view') as HTMLCanvasElement;
        const context = gameCanvas.getContext("webgpu");
        if(!context) {
            throw new Error("WebGPU not supported.");
        }
        this.WEBGPU_CONTEXT = context;

        this.GPU_TEXTURE_FORMAT = navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            device: this.GPU_DEVICE,
            format: this.GPU_TEXTURE_FORMAT,
            alphaMode: "opaque"
        });

        const editorCanvas = document.getElementById('editor-view') as HTMLCanvasElement;
        this.sceneManager = new SceneManager(this.GPU_DEVICE, this.WEBGPU_CONTEXT, this.GPU_TEXTURE_FORMAT, editorCanvas, gameCanvas);

        this.initialized = true;
    }

    public static initUI(): void {
        const gui = createSkyGUI(this.sceneManager);
    }
}

await Main.init();
Main.initUI();

createRoom();
// createSphere();
createAOCubes();
// createManyCubes();
// createManyLights();

let lastTime = 0;
const loop = (time: number) => {
    requestAnimationFrame(loop);

    const deltaTime = (time - lastTime) / 1000;
    Main.sceneManager.animate(deltaTime);
    
    fps.innerText = deltaTime.toFixed(0) + " FPS";

    lastTime = time;
    // const sunDirection = new THREE.Vector3(Math.sin(time * 0.001), 1.0, Math.cos(time * 0.001)).normalize();
    // const sunDirection = new THREE.Vector3(1.0, Math.sin(time * 0.001), 1.0).normalize();
    // Main.sceneManager.gameRayTracerRenderer.gpuScene?.gpuAmbient.setSunDirection(sunDirection);
}

loop(0);

function createRoom() {
    const baseGeometry = new THREE.BoxGeometry( 5, 0.1, 5 );
    const floor = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    floor.position.set(0, -2.5, 0);

    Main.sceneManager.addObject(floor, SceneLayer.Game, SceneLayer.Editor);

    const ceiling = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0x000000, roughness: 0.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    ceiling.position.set(0, 2.5, 0);

    Main.sceneManager.addObject(ceiling, SceneLayer.Game, SceneLayer.Editor);

    const right = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xff0000, roughness: 0.5, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    right.position.set(2.5, 0, 0);
    right.rotateZ(THREE.MathUtils.degToRad(90));

    Main.sceneManager.addObject(right, SceneLayer.Game, SceneLayer.Editor);

    const left = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0x00ff00, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    left.position.set(-2.5, 0, 0);
    left.rotateZ(THREE.MathUtils.degToRad(90));

    Main.sceneManager.addObject(left, SceneLayer.Game, SceneLayer.Editor);

    const back = new THREE.Mesh( baseGeometry, new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 1.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    back.position.set(0, 0, -2.5);
    back.rotateX(THREE.MathUtils.degToRad(90));

    Main.sceneManager.addObject(back, SceneLayer.Game, SceneLayer.Editor);

    const front = new THREE.Mesh( new THREE.BoxGeometry( 5, 0.1, 5 ), new THREE.MeshPhysicalMaterial( { color: 0xeeeeee, roughness: 0.5, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ) );
    front.position.set(0, 0, 2.5);
    front.rotateX(THREE.MathUtils.degToRad(90));

    // Main.sceneManager.addObject(front, SceneLayer.Game, SceneLayer.Editor);
}

function createAOCubes() {
    const lightCube = new THREE.Mesh( new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.2, metalness: 0.0, emissiveIntensity: 1.0, ior: 0.0 } ));
    lightCube.position.set(0.0, 1.0, 0.0);
    Main.sceneManager.addObject(lightCube, SceneLayer.Game, SceneLayer.Editor);

    const cube = new THREE.Mesh( new THREE.BoxGeometry(4.8, 2.0, 2.0), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.01, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
    cube.position.set(0.0, -1.0, 0.0);
    Main.sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);
}

function createSphere() {
    const sphere = new THREE.Mesh( new THREE.SphereGeometry(1.0, 64, 64), new THREE.MeshPhysicalMaterial( { color: 0xffffff, roughness: 0.0, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
    Main.sceneManager.addObject(sphere, SceneLayer.Game, SceneLayer.Editor);
}

function createManyCubes() {
    for (let x = -4; x < 4; x++) {
        for (let y = -4; y < 4; y++) {
            for (let z = -4; z < 4; z++) {
                const odd = (x + y + z) % 2 !== 0 ? 1.0 : 0.0;
                const cube = new THREE.Mesh( new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshPhysicalMaterial( { color: 0xeeeeee, roughness: 0.8, metalness: 0.0, emissiveIntensity: 0.0, ior: 0.0 } ));
                cube.position.set(x / 2 + 0.25, y / 2 + 0.25, z / 2 + 0.25);
                Main.sceneManager.addObject(cube, SceneLayer.Game, SceneLayer.Editor);
            }
        }
    }
}

function createManyLights() {
    for (let x = -1; x < 2; x++) {
        for (let z = -1; z < 2; z++) {
            const plafon = new THREE.Mesh( new THREE.BoxGeometry(1.0, 0.01, 1.0), new THREE.MeshPhysicalMaterial( { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 } ) );
            plafon.position.set(x * 1.5, 2.445, z * 1.5);
            Main.sceneManager.addObject(plafon, SceneLayer.Game, SceneLayer.Editor);
        }
    }
}

export function createSkyGUI(sceneManager: SceneManager): GUI {
    const gui = new GUI({ title: "Sky Settings" });

    const horizon = new THREE.Color().setRGB(
        sceneManager.ambient.horizonColor.r,
        sceneManager.ambient.horizonColor.g,
        sceneManager.ambient.horizonColor.b
    );

    const zenith = new THREE.Color().setRGB(
        sceneManager.ambient.horizonColor.r,
        sceneManager.ambient.horizonColor.g,
        sceneManager.ambient.horizonColor.b
    );

    const params = {
        horizonColor: `#${horizon.getHexString()}`,
        zenithColor: `#${zenith.getHexString()}`,
        azimuth: 0,
        elevation: 90,
        sunIntensity: sceneManager.ambient.sunIntensity,
    };

    const skyFolder = gui.addFolder("Sky");

    skyFolder
        .addColor(params, "horizonColor")
        .name("Horizon Color")
        .onChange((value: string) => {
            const color = new THREE.Color(value);
            sceneManager.setHorizonColor(color.r, color.g, color.b);
        });

    skyFolder
        .addColor(params, "zenithColor")
        .name("Zenith Color")
        .onChange((value: string) => {
            const color = new THREE.Color(value);
            sceneManager.setZenithColor(color.r, color.g, color.b);
        });

    const sunFolder = gui.addFolder("Sun");

    const updateDirection = () => {
        const azimuth = THREE.MathUtils.degToRad(params.azimuth);
        const elevation = THREE.MathUtils.degToRad(params.elevation);

        const direction = new THREE.Vector3(
            Math.cos(elevation) * Math.sin(azimuth),
            Math.sin(elevation),
            Math.cos(elevation) * Math.cos(azimuth)
        ).normalize();

        sceneManager.setSunDirection(...direction.toArray());
    };

    sunFolder.add(params, "azimuth", 0, 360, 1)
        .name("Horizontal Rotation")
        .onChange(updateDirection);

    sunFolder.add(params, "elevation", -90, 90, 1)
        .name("Elevation")
        .onChange(updateDirection);

    sunFolder
        .add(params, "sunIntensity", 1, 10, 0.1)
        .name("Intensity")
        .onChange((value: number) => {
            sceneManager.setSunIntensity(value);
        });

    return gui;
}