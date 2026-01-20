// prvobitni bbox
const osmArea = {
    n: 44.8225,
    s: 44.8135,  
    w: 20.3988,
    e: 20.4115,
};

const overpassAPI = "https://overpass-api.de/api/interpreter";
// ako api ne radi kako treba:
// const overpassAPI = "https://overpass.private.coffee/api/interpreter";

const overpassQuery = `[out:json][timeout:60];
(
  nwr["building"]({{s}},{{w}},{{n}},{{e}});
  nwr["building:part"]({{s}},{{w}},{{n}},{{e}});
);
out geom;`; // 'out geom' je definisan od strane OSM Query-a

export async function fetchOSM(maxRetry = 10) {
    for (let fetchTry = 1; fetchTry <= maxRetry; fetchTry++) {
        try {
            const query = overpassQuery
                .replace(/{{s}}/g, osmArea.s)
                .replace(/{{w}}/g, osmArea.w)
                .replace(/{{n}}/g, osmArea.n)
                .replace(/{{e}}/g, osmArea.e);

            const response = await fetch(overpassAPI, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ data: query }),
            });

            if (!response.ok) {
                if (response.status === 504 && fetchTry < maxRetry) {
                    console.log(`ERROR 504 - OSM server je verovatno zauzet(fetch br. ${fetchTry} od ${maxRetry}), novi fetch za ${fetchTry * 2}s...`);
                    await new Promise(resolve => setTimeout(resolve, fetchTry));
                    continue;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const osmResponse = await response.json();
            console.log(`Fetch uspešan (${fetchTry === 1 ? 'iz prve' : 'nakon ponavljanja'})`);
            return osmResponse.elements || [];
        } catch (error) {
            if (fetchTry === maxRetry) {
                console.error(`Fetch neuspešan nakon ${maxRetry} pokušaja:`, error);
                return [];
            }
            console.log(`Pokušaj br. ${fetchTry} propao, ponovni pokušaj...`);
            await new Promise(resolve => setTimeout(resolve, fetchTry * 2000));
        }
    }
    return [];
}