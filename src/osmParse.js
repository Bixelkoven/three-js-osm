import * as THREE from "three";
import { fetchOSM } from './osmData.js';

const osmLat = 44.81806;
const osmLon = 20.40520;
const earthR = 6378137; // radius planete
const degToRad = THREE.MathUtils.degToRad;
const metersPerLat = 2 * Math.PI * earthR / 360;
const metersPerLon = Math.cos(degToRad(osmLat)) * metersPerLat;

export function latLonToLocal(lat, lon) {
    return {
        x: (lon - osmLon) * metersPerLon,
        z: (lat - osmLat) * metersPerLat
    };
}

export async function parseBuildings() {
    const parsedBuildings = await fetchOSM();
    return parsedBuildings.filter(
        el => el.type === 'way' &&
        (el.tags?.building || el.tags['building:part']) &&
        el.geometry);
}