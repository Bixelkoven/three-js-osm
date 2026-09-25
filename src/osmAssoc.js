import { latLonToLocal } from "./osmParse.js";

function pointInsideBounds(point, bounds) {
    return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.z >= bounds.minZ &&
        point.z <= bounds.maxZ
    );
}

export function pointInPolygon(point,  polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {
        const xi = polygon[i].x;
        const zi = polygon[i].z;
        const xj = polygon[j].x;
        const zj = polygon[j].z;
        const intersects = ((zi > point.z) !== (zj > point.z) ) && (
                point.x < ((xj - xi) * (point.z - zi) ) / (zj - zi) + xi);

        if (intersects) {inside = !inside;}
    }
    return inside;
}

function hasAssociatedElement(building, osmType, osmId
) { return (building.userData.associatedOsmElements?.some(
        element =>element.osmType === osmType && element.osmId === osmId ) ?? false
    );
}

export function associateNodesToBuildings(buildingGroup, nodes) {
    const mapCentre = buildingGroup.userData.mapCentre;
    if (!mapCentre) {
        throw new Error(
            "Nedostaje mapCentre za trenutnu scenu."
        );
    }
    const buildings = [];
    buildingGroup.traverse(obj => {
        if (
            obj.isMesh &&
            obj.userData?.source === "osm" &&
            obj.userData?.type === "building" &&
            obj.userData?.buildingType ===
                "building"
            ) {buildings.push(obj);}
    });
    let associatedCount = 0;
    let unassociatedCount = 0;
    for (const node of nodes) { if (node.type !== "node" || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) {
            continue;
        }
        const point = latLonToLocal(node.lat, node.lon, mapCentre);
        let matchingBuilding = null;
        for (const building of buildings) {
            const bounds = building.userData.footprintBounds;
            const footprint = building.userData.footprint;
            if (!bounds || !footprint) {
                continue;
            }
            if (!pointInsideBounds(point, bounds)) {
                continue;
            }
            if (pointInPolygon(point, footprint)) {
                matchingBuilding = building;
                break;
            }
        }
        const elementData = {
            osmType: "node",
            osmId: node.id,
            tags: node.tags ?? {},
            lat: node.lat,
            lon: node.lon
        };

        if (matchingBuilding) {
            if (!hasAssociatedElement(matchingBuilding, "node", node.id)
            ) {
                matchingBuilding.userData.associatedOsmElements.push(elementData);
            }
            associatedCount++;
        } else {
            const alreadyStored =
                buildingGroup.userData.unassociatedOsmElements.some(
                    element => element.osmType === "node" && element.osmId === node.id );

            if (!alreadyStored) {
                buildingGroup.userData.unassociatedOsmElements.push(elementData);
            }
            unassociatedCount++;
        }
    }
    return {associatedCount, unassociatedCount};
}