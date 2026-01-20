import * as THREE from "three";
import { parseBuildings } from "./osmParse";
import { latLonToLocal } from "./osmParse";
import { getBuildingMaterial, getGenexMaterial } from "./textures";
import { rotate } from "three/tsl";

// visine zgrada
function getHeight(tags) {
    if (tags.height) return parseFloat(tags.height);
    const levels = parseFloat(tags['building:levels']);
    if (levels) return levels * 3;
    return 6;
}

function getMinHeight(tags) {
    if (tags['min_height']) return parseFloat(tags['min_height']);
    const minLevels = parseFloat(tags['building:min_level']);
    if (minLevels) return minLevels * 3;
    return 0;
}

// kreiranje objekata zgrada
function building3D(element) {
    const osmGeometry = element.geometry;
    if (!osmGeometry || osmGeometry.length < 3) return null;

    const shape = new THREE.Shape();
    osmGeometry.forEach((node, i) => {
        const {x,z} = latLonToLocal(node.lat, node.lon);
        i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z);
    });

    // povezivanje zadnjeg i prvog cvora, zatvaranje poligona
    const firstNode = latLonToLocal(osmGeometry[0].lat, osmGeometry[0].lon);
    const lastNode = latLonToLocal(osmGeometry[osmGeometry.length - 1].lat, osmGeometry[osmGeometry.length - 1].lon);
    if (Math.hypot(firstNode.x - lastNode.x, firstNode.z - lastNode.z) > 0.01) {
        shape.lineTo(firstNode.x, firstNode.z);
    }

    // ekstruzija
    const height = getHeight(element.tags);
    const minHeight = getMinHeight(element.tags);
    const extHeight = Math.max(height - minHeight, 0.1);
    
    const extSettings = {
        depth: extHeight,
        bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extSettings)
    geometry.rotateX(-Math.PI / 2);

    const randomColor = new THREE.Color().setHSL(Math.random(), 1, 0.5);
    const material = getBuildingMaterial(element.tags);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = minHeight;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tags = element.tags;
    mesh.userData.buildingId = element.id;
    return mesh;
}

// genex
function createGenexTower(){
        const group = new THREE.Group();
        const center = latLonToLocal(44.8202403, 20.4049177);
        group.position.set(center.x, 0, -center.z);
        group.name = 'genexTower';

        const genexModules = [
        { name: 'genexRestaurantBase', materialType: 'genexConcrete', radTop: 4.5, radBot: 4.5, cylH: 4.0, yPos: 104, radSegments: 32, heightSegments: 8 },
        { name: 'genexRestaurantMain', materialType: 'genexWindow', radTop: 6.5, radBot: 6.5, cylH: 3.0, yPos: 107.5, radSegments: 32, heightSegments: 8 , rotate: true }, // rotirajuci deo
        { name: 'genexRestaurantRoofBase', materialType: 'genexConcrete', radTop: 7.0, radBot: 7.0, cylH: 1.0, yPos: 109.5, radSegments: 32, heightSegments: 8 },
        { name: 'genexRestaurantRoof', materialType: 'genexRoof', radTop: 4.5, radBot: 6.0, cylH: 2.0, yPos: 111, radSegments: 64, heightSegments: 64},
        { name: 'genexAntennaBase', materialType: 'genexConcrete', radTop: 4.5, radBot: 4.5, cylH: 3.0, yPos: 113.5, radSegments: 16, heightSegments: 8 },
        { name: 'genexAntenna', materialType: 'genexConcrete', radTop: 0.25, radBot: 0.25, cylH: 10.0, yPos: 119.5, radSegments: 8, heightSegments: 8 }
    ];

    genexModules.forEach(module => {
        const genexGeometry = new THREE.CylinderGeometry(
            module.radTop, module.radBot, module.cylH, module.radSegments, module.heightSegments, false
        );

        let genexMaterial;
        if (module.materialType === 'glass'){
            genexMaterial = getBuildingMaterial({'building:material': 'glass'});
        } else {
            genexMaterial = getGenexMaterial(module.materialType);
        }

        const genexCylinder = new THREE.Mesh(genexGeometry, genexMaterial);
        genexCylinder.position.y = module.yPos;
        genexCylinder.name = module.name;
        if (module.rotate) genexCylinder.userData = { rotate: true};
        
        group.add(genexCylinder);
    });
    return group;
}

// grupisanje zgrada
export async function addBuildingsToGroup(scene){
    const buildings = await parseBuildings();
    const buildingGroup = new THREE.Group();
    buildingGroup.name = "allBuildings";
    buildings.forEach(b => {
        const mesh = building3D(b);
        if (mesh) {
            mesh.name = `building_${b.id}`;
            buildingGroup.add(mesh);
        }
    });

    const genexTower = createGenexTower();
    genexTower.name = 'genexTower';
    buildingGroup.add(genexTower);

    scene.add(buildingGroup);
    console.log(`Dodato ${buildingGroup.children.length} zgrada + custom Genex moduli`);
    return buildingGroup;
}