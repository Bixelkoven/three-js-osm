import * as THREE from 'three';
import {Pane} from 'tweakpane';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import "./style.css";
import { addBuildingsToGroup } from './buildings.js';
import { texturePromiseAll, getBuildingMaterial } from './textures.js';
import { initTweakpane } from './tweakpane.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { texture } from 'three/tsl';

// DOM element
const container = document.getElementById("app");

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x87ceeb)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
container.appendChild(renderer.domElement);

// scena
const scene = new THREE.Scene();

// kamera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    5000,
);
camera.position.set(
    0,
    0,
    0,
);
camera.lookAt(0, 0, 0);

// orbit kontrole
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

// klik / raycaster
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const onBuildingClick = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const buildingGroup = scene.getObjectByName('allBuildings');
    if (!buildingGroup) return;

    const intersects = raycaster.intersectObject(buildingGroup, true);

    if(intersects.length > 0) {
        const obj = intersects[0].object;
        let building = obj;

        while (building && !building.userData?.tags && !building.name?.includes('genex')) {
            building = building.parent;
        }

        if (building?.userData?.tags) {
            let content = 'OSM podaci:<br>';
            Object.entries(building.userData.tags).forEach(([key, value]) => {
                content += `<br>${key} = ${value}`;
            });
            popupContent.innerHTML = content;
        } else if (building?.name?.includes('genex')) {
            popupContent.innerHTML = `Na 35. spratu Zapadne kapije Beograda (popularne Genex kule), 
            prilikom projektovanja zgrade zamišljen je kružni rotirajući restoran. Ideja je nastala po uzoru na sličan sistem za rotaciju u Minhenu, 
            međutim prema rečima arhitekte Mihajla Mitrovića tokom izgradnje je izostajao ključan element mehanizma, te rotacija restorana nikad nije sprovedena. <br><br>
            Ipak, u pokretu ili ne, ovaj ugostiteljski objekat je pružao predivan pogled na Beograd sa visine od 135 metara. 
            Zbog ekonomskih problema restoran je prestao sa radom 1999. godine.<br><br>Na ovoj veb sceni prikazano je kako bi ta rotacija restorana otprilike izgledala, 
            u nadi da će ideja oživeti u budućnosti.<br><br>Interni naziv modula: ${building.name}`;
        }
        popup.style.display = 'block';
    }
}
renderer.domElement.addEventListener('pointerdown', onBuildingClick);

const popup = document.getElementById('buildingPopup');
const popupContent = document.getElementById('popupContent');
window.closeBuildingPopup = () => {
    popup.style.display = 'none';
};

// osvetljenje
const ambiLight = new THREE.AmbientLight(0xffffff, 0.5);

const hemiLight = new THREE.HemisphereLight( 0x0000ff, 0x00ff00, 1 ); 

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(1000, 1000, 500);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 3000
sunLight.shadow.camera.left = -1000
sunLight.shadow.camera.right = 1000
sunLight.shadow.camera.top = 1000
sunLight.shadow.camera.bottom = -1000
sunLight.shadow.bias = 0.0001;

scene.add(sunLight.target);
scene.add(ambiLight, hemiLight, sunLight);

// Skybox
const skybox = new HDRLoader();
skybox.load('/envmaps/kloofendal_48d_partly_cloudy_puresky_4k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
    console.log('Skybox učitan');
});

// povrs, ravan, podloga
const groundSize = 1200;
const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f0b });
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
ground.receiveShadow = true;
ground.castShadow = false;
ground.name = 'ground';

scene.add(ground);

// SEVER I ISTOK LINIJE

// inicijalizacija zgrada
async function initBuildings(){
    await texturePromiseAll();
    console.log(`Sve teksture učitane u main`);

    const buildingGroup = await addBuildingsToGroup(scene);

    if (buildingGroup.children.length > 0) {
        buildingGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(buildingGroup);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        console.log(`Sve zgrade se nalaze u okviru sa centromna poziciji 
            (${center.x.toFixed(0)}, ${center.z.toFixed(0)}) veličina = ${size.x.toFixed(0)} x ${size.z.toFixed(0)} m`);

        const maxDimension = Math.max(size.x, size.z, 1000);
        const fovRad = camera.fov * Math.PI / 180;
        const distance = (maxDimension / 2) / Math.tan(fovRad / 2) * 1.5;

        camera.position.set(center.x, distance, center.z);
        camera.lookAt(center.x, center.y, center.z);

        // controls.target.copy(center);
        // controls.maxDistance = distance;
        controls.update();
    }
}
initBuildings().catch(console.error);

// resizer
function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);


// animacijska petlja
renderer.setAnimationLoop(() => {
    controls.update();
    // updateLabels();
    scene.traverse(obj => {
        if (obj.userData?.rotate) obj.rotation.y += 0.002;
    });
    renderer.render(scene, camera);
});

// Tweakpane
const pane = initTweakpane(scene, camera, renderer, controls, ambiLight, hemiLight, sunLight, initBuildings);