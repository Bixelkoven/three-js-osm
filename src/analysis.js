import { element } from "three/tsl";
import { getAnalysisMaterial } from "./textures";

export const MAX_ANALYSIS_RULES = 6;
export const ANALYSIS_COLORS = [
    // red
    [
        "#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444",  "#f87171", "#fca5a5"
    ],
    // blue
    [
        "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"
    ],
    // green
    [
        "#14532d", "#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac"
    ],
    // cyan
    [
        "#164e63",  "#155e75", "#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9"
    ],
    // magenta
    [
        "#701a75", "#86198f", "#a21caf", "#c026d3",  "#d946ef", "#e879f9", "#f0abfc"
    ],
    // yellow
    [
        "#713f12", "#854d0e", "#a16207", "#ca8a04", "#eab308", "#facc15", "#fde047"
    ]
];
export const ANALYSIS_SOLID_COLORS = [
    "#dc2626",
    "#2563eb",
    "#16a34a",
    "#0891b2",
    "#c026d3",
    "#ca8a04" 
];

function hasTag(tags, key) {
    return Object.prototype.hasOwnProperty.call(tags ?? {}, key);
}

function getTagValues(obj, key) {
    const values = [];
    const ownTags = obj.userData.tags ?? {};
    if (hasTag(ownTags, key)) {
        values.push(String(ownTags[key]));
    }
    const associatedElements = obj.userData.associatedOsmElements ?? [];
    associatedElements.forEach(element => {const tags = element.tags ?? {};
    if (hasTag(tags, key)) {
        values.push(String(tags[key]));
    }});
    return [...new Set(values)];
}

function matchRule(obj, rule) {
    const values = getTagValues (obj, rule.key);
    if (values.length === 0){
        return null;
    }
    if (rule.operator === "exists") {
        const sortedValues = [...values].sort();
        return {
            matched: true,
            values: sortedValues,
            colorValue: sortedValues.join("|")
        }
    }
    if (rule.operator === "equals"){
        const matchingValue = values.find(value => value === rule.value);
        if(matchingValue !== undefined) {
            return {
                matched: true,
                values: [matchingValue],
                colorValue: matchingValue
            };
        }
    }
    return null;
}

function hashString(value) {
    let hash = 0;
    for (let i=0; i<value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getRuleColor(rule, tagValue) {
    if (rule.colorMode === "solid"){
        return ANALYSIS_SOLID_COLORS[rule.familyIndex];
    }
    const family = ANALYSIS_COLORS[rule.familyIndex];
    const hash = hashString(`${rule.key}:${tagValue}`);
    return family[hash % family.length];
}

function getFirstMatchingRule(obj, rules) {
    for (const rule of rules) {
        if (!rule.enabled) {
            continue;
        }
        const result = matchRule(obj, rule);
        if (result) {
            return {
                rule,
                ...result
            }
        }
    }
    return null;
}

export function applyAnalysisRules(buildingGroup, rules){
    if (!buildingGroup){
        return { totalBuildings: 0, ruleStats: []};
    }
    const meshes = [];
    buildingGroup.traverse(obj => {
        if ( obj.isMesh && obj.userData?.source === "osm" && obj.userData?.type === "building") {
            meshes.push(obj);
        }
    });
    const buildings = meshes.filter(obj => obj.userData.buildingType === "building");
    const totalBuildings = buildings.length;
    const ruleStats = rules.map(rule => ({
        id: rule.id, matches: 0, partMatches: 0, values: new Map()
    }));
    meshes.forEach(obj => {
        rules.forEach((rule, index) => {
            if (!rule.enabled) {
                return;
            }
            const result = matchRule(obj, rule);
            if (!result) {
                return;
            }
            const stats = ruleStats[index];
            if (obj.userData.buildingType === "building") {
                stats.matches++;
            } else if (obj.userData.buildingType === "building-part") {
                stats.partMatches++;
            }
            result.values.forEach(value => {
                const current = stats.values.get(value) ?? 0;
                stats.values.set(value, current + 1);
            })
        });
    });
    const buildingById = new Map();
    buildings.forEach(obj => {
        buildingById.set(obj.userData.osmId, obj);
    });
    meshes.forEach(obj => {
        let result = getFirstMatchingRule(obj, rules);
        if (!result && obj.userData.buildingType === "building-part" && obj.userData.parentBuildingId !== null) {
            const parent = buildingById.get(obj.userData.parentBuildingId);
            if (parent) {
                result = getFirstMatchingRule(parent, rules);
            }
        }
        if (!result) {
            obj.material = getAnalysisMaterial();
            return;
        }
        const color = getRuleColor(result.rule, result.colorValue);
        obj.material = getAnalysisMaterial(color);
    });
    const finalStats = ruleStats.map((stats, index) => {
        const rule = rules[index];
        return {
            ...stats,
            percentage: totalBuildings > 0 ? (
                stats.matches / totalBuildings * 100
            ) : 0,
            key: rule.key,
            value: rule.value,
            operator: rule.operator,
            enabled: rule.enabled
        };
    });
    return { 
        totalBuildings, ruleStats: finalStats
    };
}