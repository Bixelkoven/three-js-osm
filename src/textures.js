import * as THREE from 'three';
import Chance from 'chance';
import { metalness, roughness, texture } from 'three/tsl';

// postavke tekstura
const textureSelectionProperties = {
    concrete: { roughness: 0.8, metalness: 0.0},
    plaster: { roughness: 0.8, metalness: 0.0},
    brick: { roughness: 0.9, metalness: 0.0},
    glass: { roughness: 0.1, metalness: 0.9},
    genexConcrete: { roughness: 0.95, metalness: 0.0},
    genexRoof: { roughness: 0.8, metalness: 0.0},
    genexWindow: { roughness: 0.1, metalness: 0.9}
};

// maps
const materialCache = new Map();
const textureCache = new Map();
const pbrSet = new Map();

// prihvaćeni OSM tagovi za nijanse boja
const acceptedColours = new Set([
    'white','black','gray','grey','red','green','blue','yellow','cyan','magenta',
    'silver','maroon','olive','lime','aqua','teal','navy','fuchsia','purple',
    'orange','brown','pink','beige','ivory','gold','tan','salmon','khaki',
    'coral','plum','orchid','turquoise','violet','indigo','azure'
]);

// fajlovi
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
    },
    genexConcrete: {
        basecolor: '/textures/genex_concrete_color.png',        // PNG fajl
        normal: '/textures/genex_concrete_normal.png',          // PNG fajl
        roughness: '/textures/genex_concrete_roughness.png',    // PNG fajl
        height: '/textures/genex_concrete_height.png',          // PNG fajl
        ao: '/textures/genex_concrete_AO.png',                  // PNG fajl
        metalness: '/textures/genex_concrete_metalness.png'     // PNG fajl
    },
    genexRoof: {
        basecolor: '/textures/genex_roof_color.jpg',    
        normal: '/textures/genex_roof_normal.jpg',      
        roughness: '/textures/genex_roof_roughness.jpg',    
        height: '/textures/genex_roof_height.jpg',      
        ao: '/textures/genex_roof_AO.jpg',              
        metalness: '/textures/genex_roof_metalness.jpg' 
    },
    genexWindow: {
        basecolor: '/textures/genex_window_color.jpg',    
        normal: '/textures/genex_window_normal.jpg',      
        roughness: '/textures/genex_window_roughness.jpg',    
        height: '/textures/genex_window_height.jpg',      
        ao: '/textures/genex_window_AO.jpg',              
        metalness: '/textures/genex_window_metalness.jpg' 
    }
};

const textureLoader = new THREE.TextureLoader();

// pokušaji učitavanja tekstura
const texturePromise = {};
Object.entries(texturePaths).forEach(([type, paths]) => {
    texturePromise[type] = Promise.all(Object.entries(paths).map(([key, path]) =>
        new Promise((resolve) => {
            if (textureCache.has(path)) {
                resolve([key, textureCache.get(path)]);
                return;
            }
            textureLoader.load(path, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                if (key === 'normal') {
                    texture.colorSpace = THREE.NoColorSpace;
                }
                texture.flipY = false;

                if (path.includes('genex_roof')){
                    texture.repeat = new THREE.Vector2(4, 0.1);
                    texture.offset = new THREE.Vector2(0, 0);
                } else if (path.includes('genex_concrete') || path.includes('genex_window')) {
                    texture.repeat = new THREE.Vector2(1, 0.1);
                    texture.offset = new THREE.Vector2(0, 0);
                } else {
                    texture.repeat = new THREE.Vector2(0.15, 0.15);
                    texture.offset = new THREE.Vector2(0.2, 0.2);
                }

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

// regex provera value-a za OSM tagove boja
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
    // prioriteti OSM tagova
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

    // randomizovanje ako nema taga za materijal
    const chance = new Chance();

    if (!materialType) {
        materialType = chance.weighted(
            ['concrete', 'plaster', 'brick', 'glass'],
            [24, 14, 4, 4]
        );
    }

    // ako nema taga iskoristi postavke za concrete
    const texturePreset = textureSelectionProperties[materialType] || textureSelectionProperties.concrete;

    // nijansa boje ako ima colour=* tagove
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

    // ako nema tag za boju, random nijansa u zavisnosti od materijala
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

    // mesh-ovi
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

    // texturePaths -> texturePromis -> textureSet
    // svi fajlovi tekstura/mapa

    // textureSelectionProperties(materialType) -> texturePreset
    // brojcane vrednosti

    let material;
    if (materialType === 'glass') {
        material = new THREE.MeshPhysicalMaterial({
            // nijansa nad teksturom
            // color: new THREE.Color(colourValue),
            // glavna tekstura (alpha)
            map: textureSet.basecolor,
            // normal
            normalMap: textureSet.normal,
            normalScale: new THREE.Vector2(1,1),
            // roughness
            roughnessMap: textureSet.roughness,
            roughness: texturePreset.roughness,
            // metalness
            metalnessMap: textureSet.metalness,
            metalness: texturePreset.metalness,
            // height
            displacementMap: textureSet.height,
            displacementScale: 0.1,
            // AO
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0,
            //
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
            displacementMap: textureSet.height,
            displacementScale: 0.05,
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0
        });
    }

    material.needsUpdate = true;
    materialCache.set(cacheKey, material);
    return material;
}

// mesh za genex
export function getGenexMaterial(type, colorOverride = null){
    const texturePreset = textureSelectionProperties[type] || textureSelectionProperties.concrete;
    const cacheKey = `genex_${type}`;
    if (materialCache.has(cacheKey)) {
        return materialCache.get(cacheKey);
    }

    const textureSet = pbrSet.get(type);
    if (!textureSet) {
        console.warn(`Teksture Genex modula za ${type} nisu dostavljene`);
        return new THREE.MeshStandardMaterial({color: colorOverride || 0xcccccc});
    }

    let material;
    if (type === 'genexWindow') {
        material = new THREE.MeshPhysicalMaterial({
            color: colorOverride || 0xdddddd,
            map: textureSet.basecolor,
            normalMap: textureSet.normal,
            normalScale: new THREE.Vector2(1, 1),
            roughnessMap: textureSet.roughness,
            roughness: texturePreset.roughness,
            metalnessMap: textureSet.metalness,
            metalness: texturePreset.metalness,
            displacementMap: textureSet.height,
            displacementScale: 0.02,
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0,
            envMapIntensity: 1.5,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            reflectivity: 1.0,
            transmission: 0.1
        });
    } else {
        material = new THREE.MeshStandardMaterial({
            color: colorOverride || 0xffffff,
            map: textureSet.basecolor,
            normalMap: textureSet.normal,
            normalScale: new THREE.Vector2(1,1),
            roughnessMap: textureSet.roughness,
            roughness: texturePreset.roughness,
            metalness: texturePreset.metalness,
            displacementMap: textureSet.height,
            displacementScale: 0.05,
            aoMap: textureSet.ao,
            aoMapIntensity: 1.0
    }   );
    }
    material.needsUpdate = true;
    materialCache.set(cacheKey, material);
    return material;
}