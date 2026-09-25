import { getDefaultBuildingMaterial, getAnalysisMaterial } from "./textures";

export const VISUAL_MODES = {
    TEXT: "textured",
    DEF: "default",
    AN: "analysis"
};
export function applyVisualMode(buildingGroup, mode){
    if(!buildingGroup){
        return;
    }
    buildingGroup.traverse(obj => {
        if (!obj.isMesh || obj.userData?.type !== "building") {
            return;
        }
        switch (mode) {
            case VISUAL_MODES.TEXT:
                obj.material = obj.userData.texturedMaterial;
                break;
            case VISUAL_MODES.DEF:
                obj.material = getDefaultBuildingMaterial();
                break;
            case VISUAL_MODES.AN:
                obj.material = getAnalysisMaterial();
                break;
            default: console.warn(`Nepoznat mod vizuelizacije: ${mode}`);
        }
    });
}