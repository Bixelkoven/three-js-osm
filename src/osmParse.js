import * as THREE from "three";
import { fetchOSM } from "./osmData.js";

const mPerDegLat = 111111;
const earthR = 6378137;
const degToRad = THREE.MathUtils.degToRad;

export function bboxCentre(osmArea) {
    return {
        lat: (osmArea.n + osmArea.s) / 2,
        lon: (osmArea.w + osmArea.e) / 2
    };
}

export function latLonToLocal(lat, lon, mapCentre) {
    const latRad = mapCentre.lat * Math.PI / 180;
    const mPerLat = mPerDegLat;
    const mPerLon = mPerDegLat * Math.cos(latRad)
    return {
        x: (lon - mapCentre.lon) * mPerLon,
        z: (lat - mapCentre.lat) * mPerLat
    };
}

function getBounds(element) {
    const geometry = element.geometry;
    if (!geometry || geometry.length === 0) {
        return null;
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    geometry.forEach(node => {
        minLat = Math.min(minLat, node.lat);
        maxLat = Math.max(maxLat, node.lat);
        minLon = Math.min(minLon, node.lon);
        maxLon = Math.max(maxLon, node.lon);
    });
    return {
        minLat,
        maxLat,
        minLon,
        maxLon
    };
}

function boundsContain(outer, inner) {
    return (
        inner.minLat >= outer.minLat &&
        inner.maxLat <= outer.maxLat &&
        inner.minLon >= outer.minLon &&
        inner.maxLon <= outer.maxLon
    );
}

function findParentBuilding(part, buildingElements) {
    const partBounds = getBounds(part);
    if (!partBounds) {
        return null;
    }

    const parent = buildingElements.find(building => {
        const buildingBounds = getBounds(building);
        if (!buildingBounds) {
            return false;
        }
        return boundsContain(
            buildingBounds,
            partBounds
        );
    });

    return parent ?? null;
}

export async function parseBuildings(osmArea) {
    const parsedBuildings = await fetchOSM(osmArea);
    const buildings = parsedBuildings.filter(
        el =>
            el.type === "way" &&
            (el.tags?.building || el.tags?.["building:part"]) &&
            el.geometry
    );
    const buildingElements = buildings.filter(
        el => el.tags?.building
    );
    const buildingPartElements = buildings.filter(
        el => el.tags?.["building:part"]
    );
    console.log("Ukupno:", buildings.length);
    console.log("building:", buildingElements.length);
    console.log("building:part:", buildingPartElements.length);
    const both = buildings.filter(
        el => el.tags?.building && el.tags?.["building:part"]
    );
    console.log( "building & building:part:", both.length);

    let containedParts = 0;
    buildingPartElements.forEach(part => {
        const partBounds = getBounds(part);
        if (!partBounds) {
            return;
        }

        const belongsToBuilding =
            buildingElements.some(building => {
                const buildingBounds = getBounds(building);
                if (!buildingBounds) {
                    return false;
                }
                return boundsContain(
                    buildingBounds,
                    partBounds
                );
            });

        if (belongsToBuilding) {
            containedParts++;
        }
    });

    console.log ("Building parts contained inside a building:", containedParts);
    console.log("Building parts without containing building:", buildingPartElements.length - containedParts);

    const classifiedBuildings = buildings.map(element => {
        const hasBuildingTag =
            Boolean(element.tags?.building);
        const hasBuildingPartTag =
            Boolean(element.tags?.["building:part"]);
        if (hasBuildingTag) {
            return {
                ...element,
                buildingType: "building",
                hasBuildingPartTag,
                parentBuildingId: null
            };
        }
        if (hasBuildingPartTag) {
            const parentBuilding = findParentBuilding(element, buildingElements);
            return {
                ...element,
                buildingType: "building-part",
                hasBuildingPartTag: true,
                parentBuildingId:
                    parentBuilding?.id ?? null
            };
        }

        return {
            ...element,
            buildingType: "building",
            hasBuildingPartTag: false,
            parentBuildingId: null
        };
    });

    console.log("Classified buildings:", classifiedBuildings.length);
    console.log("Classified building parts:", classifiedBuildings.filter(
            el => el.buildingType === "building-part"
        ).length
    );
    console.log("Building parts with parent:", classifiedBuildings.filter(
            el =>
                el.buildingType === "building-part" &&
                el.parentBuildingId !== null
        ).length
    );
    console.log("Building parts without parent:", classifiedBuildings.filter(
            el =>
                el.buildingType === "building-part" &&
                el.parentBuildingId === null
        ).length
    );

    return classifiedBuildings;
}