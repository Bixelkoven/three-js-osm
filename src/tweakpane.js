import { Pane } from "tweakpane";

export function initTweakpane(
    setVisualMode,
    analysisApi
) {
    const pane = new Pane({title: "OSM 3D"});
    const visualSettings = {mode: "textured"};
    pane.addBinding(visualSettings, "mode", {
                label: "Prikaz",
                options: {
                    Teksture: "textured",
                    Podrazumevano: "default",
                    Analiza: "analysis"
                }
            }
        ).on("change", event => {setVisualMode(event.value);
        });

    const analysisFolder = pane.addFolder({title: "Analiza objekata", expanded: true });
    const analysisInput = {key: "", value: ""};
    const keyBinding = analysisFolder.addBinding(analysisInput, "key", {label: "Ključ"});
    const valueBinding =  analysisFolder.addBinding(analysisInput, "value",  {label: "Vrednost"});
    const rulesFolder = analysisFolder.addFolder({title: "Aktivna pravila"});
    let ruleFolders = [];

    function clearRuleFolders() {
        ruleFolders.forEach(folder => {
            folder.dispose();
        });
        ruleFolders = [];
    }

    function rebuildAnalysisRuleList() {
        clearRuleFolders();
        const rules = analysisApi.getRules();
        const stats = analysisApi.getStats();
        rules.forEach(rule => {
            const ruleStats = stats.ruleStats.find(stat => stat.id === rule.id);
            const matches = ruleStats?.matches ?? 0;
            const total = stats.totalBuildings ?? 0;
            const percentage = ruleStats ? ruleStats.percentage.toFixed(1) : "0.0";
            const valueLabel = rule.operator === "exists" ? "*" : rule.value;
            const ruleFolder = rulesFolder.addFolder({
                    title: `${rule.key}=${valueLabel} ` + `(${matches}/${total}, ` + `${percentage}%)`
                });
            ruleFolders.push(ruleFolder);
            const ruleState = { enabled: rule.enabled, colorMode: rule.colorMode ?? "solid"};
            ruleFolder.addBinding(ruleState, "enabled", {label: "Aktivno"}).on("change", event => {
                        analysisApi.toggleRule(rule.id, event.value);
                        setTimeout(() => { rebuildAnalysisRuleList();
                        }, 0);
                    }
                );
            ruleFolder.addBinding(ruleState, "colorMode", {label:"Boje", options: {"Jednobojno": "solid", "Više nijansi boja": "shades"}}).on("change", event => {
                        analysisApi.setColorMode(rule.id, event.value);
                });
            ruleFolder.addButton({title: "Ukloni"}).on("click", () => {
                        analysisApi.removeRule(rule.id);
                        setTimeout(() => {rebuildAnalysisRuleList();
                        }, 0);
                    }
                );
        });
    }

    analysisFolder.addButton({title: "Dodaj tag" }).on("click",async () => {
                const result = await analysisApi.addRule(analysisInput.key, analysisInput.value);
                if (!result.success) {
                    console.warn(
                        result.message
                    );
                    return;
                }
                analysisInput.key = "";
                analysisInput.value = "";
                keyBinding.refresh();
                valueBinding.refresh();
                rebuildAnalysisRuleList();
            }
        );
    analysisFolder.addButton({title: "Resetuj tagove"}).on("click", () => {
                analysisApi.reset();
                rebuildAnalysisRuleList();
            }
        );
    return pane;
}