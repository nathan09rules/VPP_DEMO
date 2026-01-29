import { data, activeData, config, ledger } from "./data.js";
import { get } from "svelte/store";

let heatLayer = null;

const typeMap = {
    solar: { code: "S", color: "#FFD700", renewable: true },
    wind: { code: "W", color: "#00BFFF", renewable: true },
    hydro: { code: "H", color: "#4169E1", renewable: true },
    nuclear: { code: "N", color: "#ADFF2F", renewable: true },
    biomass: { code: "B", color: "#32CD32", renewable: true },
    geothermal: { code: "G", color: "#F4A460", renewable: true },
    coal: { code: "C", color: "#8B4513", renewable: false },
    gas: { code: "G", color: "#FFA500", renewable: false },
    oil: { code: "O", color: "#FF4500", renewable: false },
    hospital: { code: "H+", color: "#FF0000", renewable: false },
    police: { code: "P", color: "#1E90FF", renewable: false },
    university: { code: "U", color: "#9370DB", renewable: false },
    bank: { code: "B", color: "#2E8B57", renewable: false },
    power_plant: { code: "P", color: "#FFA500", renewable: false },
    power: { code: "P", color: "#FFA500", renewable: false },
};

export class draw {
    constructor() {
        if (!data.map) return;
        if (!data.featureGroup) data.featureGroup = data.L.featureGroup().addTo(data.map);
        if (!data.pathGroup) data.pathGroup = data.L.featureGroup().addTo(data.map);

        this.featureGroup = data.featureGroup;
        this.pathGroup = data.pathGroup;
    }


    run() {
        if (!this.featureGroup) return;
        this.clearAll(); // This clears both featureGroup and pathGroup
        this.drawBorders();
        this.drawLocations();
        this.drawLedger();
    }

    async drawBorders() {
        try {
            const res = await fetch("/borders.geojson");
            const geojson = await res.json();

            // Only draw borders in dark mode
            if (get(config).theme === 'dark') {
                data.L.geoJSON(geojson, {
                    style: {
                        color: '#555',
                        weight: 2,
                        fillOpacity: 0.1,
                        interactive: false
                    }
                }).addTo(this.featureGroup);
            }

        } catch (e) {
            console.error("Borders failed:", e);
        }
    }

    drawLocations() {
        const currentMode = get(config).mode;

        // Draw main junctions first (so they appear on top)
        this.drawMains(currentMode);

        // Draw location nodes and their connections
        const nodes = Object.values(data.loc);
        const activeIdx = get(data.activeIndex);
        const curLedger = get(ledger);

        // Calculate dynamic external flow for each node up to the active index
        const extFlows = {};
        const limit = activeIdx === -1 ? curLedger.length : (activeIdx === -2 ? 0 : activeIdx + 1);

        for (let i = 0; i < limit; i++) {
            const step = curLedger[i];
            if (!step) continue;
            extFlows[step.endid] = (extFlows[step.endid] || 0) + step.endenergy;
            extFlows[step.startid] = (extFlows[step.startid] || 0) - step.startenergy;
        }

        if (currentMode === 'heatmap') {
            const maxVal = 2000;
            const heatData = nodes.map(loc => {
                const currentExt = extFlows[loc.id] || 0;
                const finalNet = (loc.prop.prod - loc.prop.dem) + currentExt;
                // Map Range [-2000, 2000] to [0.0, 1.0]
                // 0.5 is neutral. Only show significant deviations.
                const norm = (finalNet / (maxVal * 2)) + 0.5;
                const clamped = Math.max(0, Math.min(1, norm));
                return [loc.pos[0], loc.pos[1], clamped];
            });

            // @ts-ignore
            if (window.L && window.L.heatLayer) {
                // @ts-ignore
                window.L.heatLayer(heatData, {
                    radius: 60, // Sightly smaller for better precision
                    blur: 25,
                    maxZoom: 10,
                    gradient: {
                        0.0: '#ff4444', // Deficit (Red)
                        0.4: '#ff8888',
                        0.5: 'rgba(255, 255, 255, 0)', // Balanced (Transparent)
                        0.6: '#8888ff',
                        1.0: '#4444ff'  // Surplus (Blue)
                    }
                }).addTo(this.featureGroup);
            }
        }

        nodes.forEach(loc => {
            const net = loc.prop.prod - loc.prop.dem;
            const typeInfo = typeMap[loc.prop.type] || typeMap.power;
            const theme = get(config).theme;

            let color = "#666";
            const currentExt = extFlows[loc.id] || 0;
            const finalNet = (loc.prop.prod - loc.prop.dem) + currentExt;

            if (currentMode === 'heatmap') {
                color = finalNet > 0 ? "#4444ff" : "#ff4444";
            } else if (currentMode === 'visual') {
                color = typeInfo.color;
            } else {
                const isRenewable = typeInfo.renewable;
                if (finalNet > 0.1) color = isRenewable ? "#2ecc71" : "#e74c3c";
                else if (finalNet < -0.1) color = "#ca794eff";
                else color = "#666"; // Balanced
            }

            const radius = theme === 'dark' ? 4 : 6;

            const marker = data.L.circleMarker(loc.pos, {
                radius: currentMode === 'heatmap' ? 4 : radius,
                fillColor: color,
                color: "#fff",
                weight: currentMode === 'heatmap' ? 1 : 2,
                opacity: 1,
                fillOpacity: 0.9,
                pane: 'markerPane'
            });

            marker.bindTooltip(loc.prop.name || "Unknown Location");

            marker.on('click', (e) => {
                data.L.DomEvent.stopPropagation(e);
                activeData.set(loc);
            });

            marker.addTo(this.featureGroup);

            // Always draw connections to main junctions for better topological understanding
            loc.neighbours.forEach(nId => {
                const other = data.mains[nId];
                if (other) {
                    data.L.polyline([loc.pos, [other.lat, other.lng]], {
                        color: theme === 'dark' ? '#555' : '#333',
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '4, 4',
                        interactive: false
                    }).addTo(this.featureGroup);
                }
            });

            // Secondary connections
            if (currentMode !== 'heatmap') {
                this.connectToMains(loc);
            }
        });
    }

    drawMains(mode) {
        const theme = get(config).theme;
        // Draw main junction nodes
        Object.values(data.mains).forEach(main => {
            const mainMarker = data.L.circleMarker([main.lat, main.lng], {
                radius: 6,
                fillColor: theme === 'dark' ? '#ff3333' : '#aa0000',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
                pane: 'markerPane'
            });

            mainMarker.bindTooltip(`Main Junction ${main.id}`);

            mainMarker.on('mousedown', (e) => {
                data.L.DomEvent.stopPropagation(e);
            });

            mainMarker.on('click', (e) => {
                data.L.DomEvent.stopPropagation(e);
                activeData.set({
                    id: main.id,
                    lat: main.lat,
                    lng: main.lng,
                    type: 'main',
                    name: `Main Junction ${main.id}`,
                    prop: {
                        prod: 0,
                        dem: 0,
                        store: 0,
                        priority: 1,
                        type: 'main',
                        source_type: 'infrastructure'
                    }
                });
            });

            mainMarker.addTo(this.featureGroup);

            // Draw connections between main junctions - Make them bold and "main" like
            main.neighbors?.forEach(neighborId => {
                const neighbor = data.mains[neighborId];
                if (neighbor) {
                    data.L.polyline([[main.lat, main.lng], [neighbor.lat, neighbor.lng]], {
                        color: theme === 'dark' ? '#ff3333' : '#aa0000',
                        weight: 2, // Thinner for mains
                        opacity: 0.8,
                        interactive: false
                    }).addTo(this.featureGroup);

                    // Add a subtle glow for mains
                    data.L.polyline([[main.lat, main.lng], [neighbor.lat, neighbor.lng]], {
                        color: theme === 'dark' ? '#ff3333' : '#aa0000',
                        weight: 4,
                        opacity: 0.2,
                        interactive: false
                    }).addTo(this.featureGroup);
                }
            });
        });
    }

    connectToMains(loc) {
        // Find nearby mains and draw connections
        const theme = get(config).theme;
        Object.values(data.mains).forEach(main => {
            const distance = Math.sqrt(Math.pow(loc.pos[0] - main.lat, 2) + Math.pow(loc.pos[1] - main.lng, 2));

            // Only draw connection if reasonably close
            if (distance < 0.8) { // Increased threshold slightly
                data.L.polyline([loc.pos, [main.lat, main.lng]], {
                    color: theme === 'dark' ? '#888' : '#444',
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '5, 5',
                    interactive: false
                }).addTo(this.featureGroup);
            }
        });
    }


    drawLedger() {
        const currentLedger = get(ledger);
        const activeIdx = get(data.activeIndex);
        const currentMode = get(config).mode;

        // If index is -2, it means explicit "hide paths" mode (e.g. initial inspect)
        // Also always hide paths in heatmap mode to keep map clean
        if (activeIdx === -2 || currentMode === 'heatmap') {
            this.pathGroup.clearLayers();
            return;
        }

        if (activeIdx === -1) {
            // Overview: Show all paths
            if (currentLedger.length > 0) {
                this.pathGroup.clearLayers();
                currentLedger.forEach(step => {
                    this.path(step);
                });
            }
        } else {
            // Single step: Only draw the active step
            this.path(activeIdx);
        }
    }

    path(stepOrIndex) {
        let step;
        const currentLedger = get(ledger);

        if (typeof stepOrIndex === 'number') {
            if (stepOrIndex >= 0 && stepOrIndex < currentLedger.length) {
                this.clearPaths();
                step = currentLedger[stepOrIndex];
            } else {
                return null;
            }
        } else {
            step = stepOrIndex;
        }

        if (!step || !step.path) return;

        // Find the node to check if it's renewable
        const node = data.loc[step.startid];
        const typeInfo = typeMap[node?.prop?.type] || typeMap.power;

        const isRenewable = typeInfo.renewable;

        const color = isRenewable ? "#2ecc71" : "#e74c3c"; // Green for renewable, Red for non-renewable

        const path = data.L.polyline(step.path, {
            color: color,
            weight: 6,
            opacity: 1.0,
            className: 'energy-path',
            interactive: false
        }).addTo(this.pathGroup);

        const glowPath = data.L.polyline(step.path, {
            color: 'white',
            weight: 10,
            opacity: 0.4,
            interactive: false
        }).addTo(this.pathGroup);

        path.bringToFront();
        return { path, glowPath };
    }

    // Method to clear only paths, not the entire layer
    clearPaths() {
        this.pathGroup.clearLayers();
    }

    clearAll() {
        this.featureGroup.clearLayers();
        this.pathGroup.clearLayers();
    }
}
