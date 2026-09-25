import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css"

let rectActive = null;
let bboxSelected = null;
let isLoading = false;
export function initSlippy(onAreaSelect, scLoaded) {
    const map = L.map("slippyMap").setView([44.815, 20.45], 13);
//  const map = L.map("slippyMap").setView([44, 21], 6);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'}
    ).addTo(map);

    map.pm.addControls({
        position: "topleft",
        drawText: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawMarker: false,
        drawPolyline: false,
        drawPolygon: false,
        drawRectangle: true,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
        rotateMode: false
    });

    const bboxButton = document.getElementById("bboxButton");
    function bboxReset() {
        bboxSelected = null;
        bboxButton.disabled = true;
        bboxButton.textContent = "Izaberite područje";
    }

    function bboxClear(){
        if (rectActive && map.hasLayer(rectActive)) {
            map.removeLayer(rectActive);
        }
        rectActive = null;
        bboxSelected = null;
        bboxButton.disabled = true;
        bboxButton.textContent = "Izaberite područje";
    }
    
    function rectRemove(){
        if (rectActive && map.hasLayer(rectActive)) {
            map.removeLayer(rectActive);
        }
        rectActive = null;
        bboxReset();
    }

    bboxButton.disabled = true;
    bboxButton.textContent = "Izaberite područje"

    map.on("pm:drawstart", event => {
        if (event.shape !== "Rectangle") {
            return;
        }
        rectRemove();
    });

    map.on("pm:create", event => {
        if (event.shape !== "Rectangle") {
            return;
        }
        if (
            rectActive && rectActive !== event.layer && map.hasLayer(rectActive)
        ) {
            map.removeLayer(rectActive);
        }

        rectActive = event.layer;
        const bounds = event.layer.getBounds();
        bboxSelected = {
            n: bounds.getNorth(),
            s: bounds.getSouth(),
            w: bounds.getWest(),
            e: bounds.getEast()
        };

        console.log("OSM bbox:", bboxSelected)
        if (isLoading) {
            bboxButton.disabled = true;
        bboxButton.textContent = "Učitavanje...";
        } else {
            bboxButton.disabled = false;
            bboxButton.textContent = "Potvrdi";
        }
    });

    map.on("pm:remove", event => {
        if (event.layer !== rectActive) {
            return;
        }
        rectActive = null;
        bboxReset();
    });

    bboxButton.addEventListener("click", async () => {
        if (!bboxSelected || isLoading) {
            return;
        }
        if (scLoaded()) {
            const conf = window.confirm("Postojeća scena će biti uklonjena. Da li želite da nastavite?")
            if (!conf) {
                return;
            }
        }

        const area2load = {
            ...bboxSelected
        };
        isLoading = true;
        bboxButton.disabled = true;
        bboxButton.textContent = "Učitavanje..."

        try {
            await onAreaSelect(area2load);
            bboxClear();
        } catch (error) {
            console.error(
                error
            );
        } finally {
            isLoading = false;
            if (bboxSelected) {
                bboxButton.disabled = false;
                bboxButton.textContent = "Potvrdi"
            } else { 
                bboxButton.disabled = true;
                bboxButton.textContent = "Izaberite područje"
            }
        }
    });
    return map;
}