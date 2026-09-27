import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import "./style.css";
import { createBuildingsGroup } from './buildings.js';
import { texturePromiseAll } from './textures.js';
import { initTweakpane } from './tweakpane.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { initSlippy } from './slippyMap.js';
import { applyVisualMode, VISUAL_MODES } from './visual.js';
import { applyAnalysisRules, MAX_ANALYSIS_RULES } from './analysis.js';
import { fetchNodesByTag } from './osmData.js';
import { associateNodesToBuildings } from './osmAssoc.js';

const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setClearColor(0x87ceeb)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const sceneLoading = document.getElementById("loadingScreen");
const sceneLoadingText = document.getElementById("loadingText");
const sceneLoadingSpin = document.getElementById("loadingSpin");
const sceneLoadingButton = document.getElementById("loadingButton");
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight,  1, 5000);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};

controls.enableDamping = true;
controls.dampingFactor = 0.02;
controls.screenSpacePanning = false;
controls.minDistance = 20;
controls.maxDistance = 3000;
controls.maxPolarAngle = Math.PI / 2;
controls.update();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const onBuildingClick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const buildingGroup = scene.getObjectByName('allBuildings');

    if (!buildingGroup) return;
    const intersects = raycaster.intersectObject(buildingGroup, true);
    if(intersects.length === 0) return;

    let building = intersects[0].object;

    while (building && !building.userData?.tags) {
        building = building.parent;
    }

    if (!building?.userData?.tags) return;
    let content = 'OSM podaci:<br>';
    Object.entries(building.userData.tags).forEach(([key, value]) => {
        content += `<br>${key} = ${value}`;
    });

    popupContent.innerHTML = content;
    popup.style.display = 'block';
}

renderer.domElement.addEventListener('pointerdown', onBuildingClick);
const popup = document.getElementById('buildingPopup');
const popupContent = document.getElementById('popupContent');
window.closeBuildingPopup = () => {
    popup.style.display = 'none';
};

const ambiLight = new THREE.AmbientLight(0xffffff, 0.5);
const hemiLight = new THREE.HemisphereLight( 0x0000ff, 0x00ff00, 1 ); 
const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(1000, 1000, 500);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 3000
sunLight.shadow.camera.left = -1000
sunLight.shadow.camera.right = 1000
sunLight.shadow.camera.top = 1000
sunLight.shadow.camera.bottom = -1000
sunLight.shadow.bias = 0.0001;
scene.add(sunLight.target);
scene.add(ambiLight, hemiLight, sunLight);
const skybox = new HDRLoader();

skybox.load('/envmaps/kloofendal_48d_partly_cloudy_puresky_4k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
    console.log('Skybox učitan');
});

const groundSize = 20000;
const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f0b });
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
ground.receiveShadow = true;
ground.castShadow = false;
ground.name = 'ground';
scene.add(ground);

function showSceneLoading(){
    sceneLoadingText.textContent = "Preuzimanje OSM podataka";
    sceneLoadingSpin.classList.remove("hidden");
    sceneLoadingButton.classList.add("hidden");
    sceneLoading.classList.remove("hidden");
}

function hideSceneLoading(){
    sceneLoading.classList.add("hidden")
}

function sceneLoadingErr(){
    sceneLoadingText.textContent = "Neuspešno preuzimanje podataka"
    sceneLoadingSpin.classList.add("hidden");
    sceneLoadingButton.classList.remove("hidden");
    sceneLoading.classList.remove("hidden");
}

sceneLoadingButton.addEventListener("click", hideSceneLoading);

let buildingGroup = null;
let textureLoaded = null;
let loadedSceneBbox = null;
let visualMode = VISUAL_MODES.TEXT;
let analysisRules = [];
let nextAnalysisRuleId = 1;
let analysisStats = { totalBuildings: 0, ruleStats: []};

function refreshAnalysis(){
    if (!buildingGroup) {
        return analysisStats;
    }
    if (visualMode !== VISUAL_MODES.AN) {
        return analysisStats;
    }
    analysisStats = applyAnalysisRules(buildingGroup, analysisRules);
    return analysisStats;
}

function setVisualMode(mode) {
    visualMode = mode;
    if (!buildingGroup) {
        return;
    }
    applyVisualMode(buildingGroup, visualMode);
    
    if (visualMode === VISUAL_MODES.AN) {
        refreshAnalysis();
    }
}

async function addAnalysisRule(key, value = ""){
    const cleanKey = key.trim();
    const cleanValue = value.trim();
    if (!cleanKey){
        return {
            success: false, message: "Key tag je obavezan"
        };
    }
    if (analysisRules.length >= MAX_ANALYSIS_RULES) {
        return {
            success: false, message: `Maksimalno ` + `${MAX_ANALYSIS_RULES} tagova`
        };
    }
    const duplicate = analysisRules.some(rule => rule.key === cleanKey && rule.value === cleanValue);
    if (duplicate) {
        return { success: false, message: "Tag je već unesen"};
    }
    const usedFamilies = new Set(analysisRules.map(
        rule => rule.familyIndex
    ));
    let familyIndex = 0;
    while (usedFamilies.has(familyIndex) && familyIndex < MAX_ANALYSIS_RULES){
        familyIndex++;
    }
    const rule = {
        id: nextAnalysisRuleId++,
        key: cleanKey,
        value: cleanValue,
        operator: cleanValue ? "equals" : "exists",
        enabled: true,
        familyIndex,
        colorMode: "solid"
    };
    analysisRules.push(rule);
    if (buildingGroup){
        try{
            const osmArea = buildingGroup.userData.osmArea;
            const nodes = await fetchNodesByTag(osmArea, cleanKey, cleanValue);
            const assoc = associateNodesToBuildings(buildingGroup, nodes);
            console.log(`Povezano sa zgradama: ` + `${assoc.associatedCount}`)
            console.log(`Izvan zgrada: ` + `${assoc.unassociatedCount}`)
        } catch (error) {
            console.warn("OSM nodes nisu dobijeni")
        }
    }

    const stats = refreshAnalysis();
    return {
        success: true, rule, stats
    };
}

function toggleAnalysisRule (ruleId, enabled) {
    const rule = analysisRules.find(
        rule => rule.id === ruleId
    );
    if (!rule) {
        return;
    }
    rule.enabled = enabled;
    return refreshAnalysis();
}

function setAnalysisRuleColorMode(ruleId, colorMode) {
    const rule = analysisRules.find(rule => rule.id === ruleId);
    if (!rule) {
        return;
    }
    rule.colorMode = colorMode;
    return refreshAnalysis();
}

function removeAnalysisRule (ruleId) {
    analysisRules = analysisRules.filter(
        rule => rule.id !== ruleId
    );
    return refreshAnalysis();
}

function resetAnalysis(){
    analysisRules = [];
    analysisStats = {
        totalBuildings: 0, ruleStats: []
    };
    if (buildingGroup && visualMode === VISUAL_MODES.AN){
        applyVisualMode(buildingGroup, VISUAL_MODES.AN);
    }
}

async function initBuildings(osmArea){
    showSceneLoading();
    try {
        if (!textureLoaded) {
            await texturePromiseAll();
            textureLoaded = true;
            console.log(`Teksture učitane`)
        }
        const newBuildingGroup = await createBuildingsGroup(osmArea);
        applyVisualMode(newBuildingGroup, visualMode);

        if (visualMode === VISUAL_MODES.AN){
            analysisStats = applyAnalysisRules(newBuildingGroup, analysisRules)
        }

        if (buildingGroup) {
        scene.remove(buildingGroup);
        buildingGroup.traverse(object => {
            if (object.geometry) {object.geometry.dispose();
            }
        });
    }
    buildingGroup = newBuildingGroup;
    loadedSceneBbox = {...osmArea};
    scene.add(buildingGroup);

    if (buildingGroup.children.length > 0) {
        buildingGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(buildingGroup);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        console.log(`Bbox centar:  
        (${center.x.toFixed(0)}, ${center.z.toFixed(0)}) veličina = ${size.x.toFixed(0)} x ${size.z.toFixed(0)} m`);
        const maxDimension = Math.max(size.x, size.z, 1000);
        const fovRad = camera.fov * Math.PI / 180;
        const distance = (maxDimension / 2) / Math.tan(fovRad / 2) * 1.5;
        camera.position.set(center.x, distance, center.z);
        camera.lookAt(center.x, center.y, center.z);
        controls.target.copy(center);
        camera.lookAt(center);
        controls.update();
    }
    hideSceneLoading();
} catch (error) {
        console.error("Greška: ", error);
        sceneLoadingErr();
        throw error;
    }
}

initSlippy((osmArea) => {
    console.log("Novi bbox:", osmArea);
    return initBuildings(osmArea);
},
() => {
    return buildingGroup !== null && buildingGroup.children.length > 0;
})

function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);

renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});

initTweakpane(setVisualMode, {
    addRule: addAnalysisRule,
    toggleRule: toggleAnalysisRule,
    removeRule: removeAnalysisRule,
    setColorMode: setAnalysisRuleColorMode,
    reset: resetAnalysis,
    getRules: () => analysisRules,
    getStats: () => analysisStats
});