import * as THREE from "three";
import { parseBuildings, latLonToLocal, bboxCentre } from "./osmParse";
import { getBuildingMaterial } from "./textures";

function getHeight(tags) {
    const height = parseFloat(tags?.height);
    if (Number.isFinite(height) && height > 0) {
        return height;
    }
    const levels = parseFloat(tags?.['building:levels']);
    if (Number.isFinite(levels) && levels > 0) {
        return levels * 3;
    }

    return 6;
}

function getMinHeight(tags) {
    const minHeight = parseFloat(tags?.min_height);
    if (Number.isFinite(minHeight) && minHeight > 0) {
        return minHeight;
    }
    const minLevels = parseFloat(tags?.['building:min_level']);
    if (Number.isFinite(minLevels) && minLevels > 0) {
        return minLevels * 3;
    }

    return 0;
}

function getFootprintBounds(footprint) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    footprint.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    });

    return {minX, maxX, minZ, maxZ
    };
}

export function createBuildingMesh(element, mapCentre) {
    const osmGeometry = element.geometry;
    if (!osmGeometry || osmGeometry.length < 3) return null;
    const localFootprint = osmGeometry.map(node => latLonToLocal(node.lat, node.lon, mapCentre));
    const shape = new THREE.Shape();
    localFootprint.forEach((point, i) => {
        if (i === 0) {
            shape.moveTo(point.x, point.z);
        } else {
            shape.lineTo(point.x, point.z);
        }
    });

    // osmGeometry.forEach((node, i) => {
    //     const { x, z } = latLonToLocal(node.lat, node.lon, mapCentre);
    //     i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z);
    // });

    const firstNode = localFootprint[0];
    const lastNode = localFootprint[localFootprint.length-1];

    if (Math.hypot(
        firstNode.x - lastNode.x,
        firstNode.z - lastNode.z) > 0.01
    ) {
        shape.lineTo(firstNode.x, firstNode.z);
    }
    const height = getHeight(element.tags);
    const minHeight = getMinHeight(element.tags);
    const extHeight = Math.max(height - minHeight, 0.1);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: extHeight, bevelEnabled: false})
    geometry.rotateX(-Math.PI / 2);
    const texturedMaterial = getBuildingMaterial(element.tags);
    const mesh = new THREE.Mesh(geometry, texturedMaterial);
    mesh.position.y = minHeight;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tags = element.tags;
    mesh.userData.osmId = element.id;
    mesh.userData.osmType = element.type;
    mesh.userData.source = "osm";
    mesh.userData.texturedMaterial = texturedMaterial;
    mesh.userData.type = "building";
    mesh.userData.buildingType = element.buildingType;
    mesh.userData.parentBuildingId = element.parentBuildingId;
    mesh.userData.footprint = localFootprint;
    mesh.userData.footprintBounds = getFootprintBounds(localFootprint);
    mesh.userData.associatedOsmElements = [];
    return mesh;
}

export async function createBuildingsGroup(osmArea) {
    const buildings = await parseBuildings(osmArea);
    const centre = bboxCentre(osmArea);
    const buildingGroup = new THREE.Group();
    buildingGroup.userData.osmArea = {...osmArea};
    buildingGroup.userData.mapCentre = {...centre};
    buildingGroup.userData.unassociatedOsmElements = []
    buildingGroup.name = "allBuildings";
    buildings.forEach(building => {
        const mesh = createBuildingMesh(building, centre);
        if (!mesh) return;
        buildingGroup.add(mesh);
    });

    console.log(`Uvezeno ${buildingGroup.children.length} zgrada`);
    return buildingGroup;
}