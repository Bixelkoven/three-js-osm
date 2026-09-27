import * as THREE from 'three';
import Chance from 'chance';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';

const textureSelectionProperties = {
    concrete: { roughness: 0.8, metalness: 0.0},
    plaster: { roughness: 0.8, metalness: 0.0},
    brick: { roughness: 0.9, metalness: 0.0},
    glass: { roughness: 0.1, metalness: 0.9}
};

const materialCache = new Map();
const textureCache = new Map();
const pbrSet = new Map();
const analysisMaterialCache = new Map();
let defBdgMaterial = null;
const acceptedColours = new Set([
    'white','black','gray','grey','red','green','blue','yellow','cyan','magenta',
    'silver','maroon','olive','lime','aqua','teal','navy','fuchsia','purple',
    'orange','brown','pink','beige','ivory','gold','tan','salmon','khaki',
    'coral','plum','orchid','turquoise','violet','indigo','azure'
]);

const texturePaths = {
    concrete: {
        basecolor: '/textures/concrete_window_color.jpg',
        normal: '/textures/concrete_window_normal.jpg',
        roughness: '/textures/concrete_window_roughness.jpg',
        height: '/textures/concrete_window_height.jpg',
        ao: '/textures/concrete_window_AO.jpg',
        metalness: '/textures/concrete_window_metalness.jpg'
    },
    plaster: {
        basecolor: '/textures/plaster_window_color.jpg',
        normal: '/textures/plaster_window_normal.jpg',
        roughness: '/textures/plaster_window_roughness.jpg',
        height: '/textures/plaster_window_height.jpg',
        ao: '/textures/plaster_window_AO.jpg',
        metalness: '/textures/plaster_window_metalness.jpg'
    },
    brick: {
        basecolor: '/textures/brick_window_color.jpg',
        normal: '/textures/brick_window_normal.jpg',
        roughness: '/textures/brick_window_roughness.jpg',
        height: '/textures/brick_window_height.jpg',
        ao: '/textures/brick_window_AO.jpg',
        metalness: '/textures/brick_window_metalness.jpg'
    },
    glass: { 
        basecolor: '/textures/glass_window_color.jpg',
        normal: '/textures/glass_window_normal.png',            // PNG fajl
        roughness: '/textures/glass_window_roughness.jpg',
        height: '/textures/glass_window_height.png',            // PNG fajl
        ao: '/textures/glass_window_AO.jpg',
        metalness: '/textures/glass_window_metalness.jpg'
    }
};

const textureLoader = new THREE.TextureLoader();
const texturePromise = {};
Object.entries(texturePaths).forEach(([type, paths]) => {
    texturePromise[type] = Promise.all(Object.entries(paths).map(([key, path]) =>
        new Promise((resolve) => {
            if (textureCache.has(path)) {
                resolve([key, textureCache.get(path)]);
                return;
            }
            textureLoader.load(path, (texture) => {
                if (key === 'basecolor') {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    texture.colorSpace = THREE.NoColorSpace
                }
                texture.flipY = false;

                texture.repeat = new THREE.Vector2(0.15, 0.15);
                texture.offset = new THREE.Vector2(0.2, 0.2);

                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                textureCache.set(path, texture);
                resolve([key, texture]);
            }, undefined, (error) => {
                console.warn(`Neuspešan load za ${path}:`, error);
                resolve([key, null]);
            });
        })
    )).then(set => {
        const textureSet = Object.fromEntries(set);
        pbrSet.set(type, textureSet);
        console.log(`Učitane teksture za ${type}`);
    });
});

export const texturePromiseAll = () => Promise.all(Object.values(texturePromise));

function checkColourTagValues(colourValueRaw) {
    if (typeof colourValueRaw !== 'string') return null;
    const value = colourValueRaw.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        return value.toLowerCase();
    }

    if (acceptedColours.has(value)) {
        return value;
    }
    return null;
}

export function getBuildingMaterial(tags) {
    const materialTagsOSM = ['building:material', 'material', 'wall:material', 'building:facade:material'];
    let materialType = null;
    for (const key of materialTagsOSM){
        if (tags[key]) {
            const materialTagsAcceptedValues = tags[key].toLowerCase();
            if(['brick', 'concrete', 'plaster', 'glass'].includes(materialTagsAcceptedValues)){
                materialType = materialTagsAcceptedValues;
                break;
            }
        }
    }

    const chance = new Chance();

    if (!materialType) {
        materialType = chance.weighted(
            ['concrete', 'plaster', 'brick', 'glass'],
            [24, 14, 4, 4]
        );
    }

    // ako nema taga iskoristi postavke za concrete
    const texturePreset = textureSelectionProperties[materialType] || textureSelectionProperties.concrete;

    const colourTagsOSM = ['building:colour', 'building:facade:colour', 'colour'];
    let colourValue = null;
    for (const key of colourTagsOSM){
        if (!tags[key]) continue;
        const colourChecked = checkColourTagValues(tags[key]);
        if (colourChecked) {
            colourValue = colourChecked;
            break;
        } else {
            console.warn(
                `Nevažeća boja u OSM tagu: "${tags[key]}", random nijansa upotrebljena`
            );
        }
    }

    if (!colourValue) {
        const coloursPerBdgMaterial = {
            concrete: ['#f0f0f0', '#c9c9c9', '#a0a0a0', '#777777', '#f5f5dc'],
            plaster: ['#f0f0f0', '#d0d0d0', '#fff6c2', '#ffffee'],
            brick: ['#862d2d', '#863b2d', '#a0522d', '#cd853f'],
            glass: ['#7cb1ff','#87ceeb', '#b0e0e6']
        };

        const coloursPerBdgMaterialWeights = {
            concrete: [24, 14, 6, 4, 2],
            plaster: [8, 6, 1, 2],
            brick: [4, 4, 3, 2],
            glass: [1, 3, 3]
        }

        const colours = coloursPerBdgMaterial[materialType] || coloursPerBdgMaterial.concrete;
        const weights = coloursPerBdgMaterialWeights[materialType] || coloursPerBdgMaterialWeights.concrete;
        const chance = new Chance();
        colourValue = chance.weighted(colours, weights)
    }

    const cacheKey = `${materialType}:${colourValue}`;
    if (materialCache.has(cacheKey)) {
        return materialCache.get(cacheKey);
    }

    const textureSet = pbrSet.get(materialType);
    if (!textureSet) {
        console.warn(`Teksture za ${materialType} nisu dostavljene, koristim običan materijal`);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colourValue),
            roughness: texturePreset.roughness,
            metalness: texturePreset.metalness
        });
        material.needsUpdate = true;
        materialCache.set(cacheKey, material);
        return material;
    }

    let material;
    if (materialType === 'glass') {
        material = new THREE.MeshPhysicalMaterial({
            map: textureSet.basecolor,
            normalMap: textureSet.normal,
            normalScale: new THREE.Vector2(1,1),
            roughnessMap: textureSet.roughness,
            roughness: texturePreset.roughness,
            metalnessMap: textureSet.metalness,
            metalness: texturePreset.metalness,
            // displacementMap: textureSet.height,
            // displacementScale: 0.1,
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
    } else {
        material = new THREE.MeshStandardMaterial({
            map: textureSet.basecolor,
            normalMap: textureSet.normal,
            normalScale: new THREE.Vector2(1,1),
            roughnessMap: textureSet.roughness,
            roughness: texturePreset.roughness,
            metalness: texturePreset.metalness,
            // displacementMap: textureSet.height,
            // displacementScale: 0.05,
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0
        });
    }

    material.needsUpdate = true;
    materialCache.set(cacheKey, material);
    return material;
}

export function getDefaultBuildingMaterial() {
    if (!defBdgMaterial) {
        defBdgMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.85,
            metalness: 0.0
        });
    }
    return defBdgMaterial;
}

export function getAnalysisMaterial(color = "#dddddd"){
    const key = color.toLowerCase();
    if (analysisMaterialCache.has(key)) {
        return analysisMaterialCache.get(key);
    }
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.85,
        metalness: 0.0
    });
    analysisMaterialCache.set(key, material);
    return material;
}
