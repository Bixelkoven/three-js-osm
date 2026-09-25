const overpassAPI = "https://overpass-api.de/api/interpreter";
// ako default api ima probleme:
// const overpassAPI = "https://overpass.private.coffee/api/interpreter";

const overpassQuery = `[out:json][timeout:60];
(
  way["building"]({{s}},{{w}},{{n}},{{e}});
  way["building:part"]({{s}},{{w}},{{n}},{{e}});
);
out geom;`;

async function queryExec(query, maxRetry = 3) {
    for (let fetchTry = 1; fetchTry <= maxRetry; fetchTry++){
        try {
            console.log(query);
            const response = await fetch(overpassAPI, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ data: query })
            });
            if(!response.ok){
                 throw new Error(`HTTP ${response.status}: ` + `${response.statusText}`);
            }
            const osmResponse = await response.json();
            console.log(`Fetch prošao (${fetchTry === 1 ? 'iz prve' : 'nakon ponavljanja'})`);
            return (osmResponse.elements || []);
        } catch (error){
            if (fetchTry === maxRetry) {
                console.error(`Max pokušaja (${maxRetry})`, error);
                throw error;
            }
            const retryDelay = fetchTry * 2000;
            console.log(`Fetch #${fetchTry} nije prošao, novi pokušaj za ${retryDelay / 1000}s`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

export async function fetchOSM(osmArea) {
    const query = overpassQuery
                .replace(/{{s}}/g, osmArea.s)
                .replace(/{{w}}/g, osmArea.w)
                .replace(/{{n}}/g, osmArea.n)
                .replace(/{{e}}/g, osmArea.e);
            return queryExec(query);
}

function escOverpassStr(value){
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function fetchNodesByTag(osmArea, key, value = "") {
    const safeKey = escOverpassStr(key);
    const safeValue = escOverpassStr(value);
    const tagFilter = value
            ? `["${safeKey}"="${safeValue}"]`
            : `["${safeKey}"]`;
    const query = `[out:json][timeout:60];
node${tagFilter}(${osmArea.s},${osmArea.w},${osmArea.n},${osmArea.e});
out;`;

    return queryExec(query);
}