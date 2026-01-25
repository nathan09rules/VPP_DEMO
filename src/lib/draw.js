import { data, activeData, config, ledger } from "./data.js";
import { get } from "svelte/store";

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
        this.featureGroup = data.L.featureGroup().addTo(data.map);
        this.pathGroup = data.L.featureGroup().addTo(data.map);
    }

    run() {
        if (!this.featureGroup) return;
        this.clearAll();
        this.drawLocations();
        this.drawLedger();
    }

    drawLocations() {
        const currentMode = get(config).mode;

        // Draw main junctions first (so they appear on top)
        this.drawMains(currentMode);

        // Draw location nodes and their connections
        Object.values(data.loc).forEach(loc => {
            const net = loc.prop.prod - loc.prop.dem;
            const typeInfo = typeMap[loc.prop.type] || typeMap.power;

            let color = "#666";
            if (currentMode === 'visual') {
                color = typeInfo.color;
            } else if (currentMode === 'heatmap') {
                // Mock heatmap logic: based on net energy
                if (net > 500) color = "#00ff00";
                else if (net > 0) color = "#aaff00";
                else if (net > -500) color = "#ffaa00";
                else color = "#ff0000";
            } else {
                // Default inspect mode coloring
                if (net > 0) color = typeInfo.renewable ? "#00ff00" : "#ffa500";
                if (net < 0) color = "#ff0000";
            }

            // Fixed smaller size for all nodes
            const marker = data.L.circleMarker(loc.pos, {
                radius: 6,
                fillColor: color,
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
                pane: 'markerPane'
            });

            marker.bindTooltip(loc.prop.name || "Unknown Location");

            // Ensure click events work
            marker.on('mousedown', (e) => {
                data.L.DomEvent.stopPropagation(e);
            });

            marker.on('click', (e) => {
                data.L.DomEvent.stopPropagation(e);
                activeData.set({
                    ...loc.prop,
                    lat: loc.pos[0],
                    lng: loc.pos[1],
                    id: loc.id
                });
            });

            marker.addTo(this.featureGroup);

            // Draw sublines (neighbor connections from sublines logic) - Enhanced visibility
            loc.neighbours.forEach(nId => {
                const other = data.loc[nId];
                if (other) {
                    data.L.polyline([loc.pos, other.pos], {
                        color: "#333", // Darker color for better visibility
                        weight: 3,     // Thicker lines
                        opacity: 0.8,  // More opaque
                        dashArray: '4, 4', // Dashed style to distinguish from mains
                        interactive: false
                    }).addTo(this.featureGroup);
                }
            });

            // Draw connections from this location to mains
            this.connectToMains(loc);
        });
    }

    drawMains(currentMode) {
        // Draw main junction nodes
        Object.values(data.mains).forEach(main => {
            const mainMarker = data.L.circleMarker([main.lat, main.lng], {
                radius: 6, // Same size as locations, less dominant
                fillColor: currentMode === 'dark' ? '#ff6b6b' : '#cc0000', // Softer red for mains
                color: '#fff',
                weight: 1, // Thinner border
                opacity: 1,
                fillOpacity: 0.7, // Less opaque
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
                    prod: 0,
                    dem: 0,
                    store: 0,
                    priority: 1
                });
            });

            mainMarker.addTo(this.featureGroup);

            // Draw connections between main junctions
            main.neighbors?.forEach(neighborId => {
                const neighbor = data.mains[neighborId];
                if (neighbor) {
                    data.L.polyline([[main.lat, main.lng], [neighbor.lat, neighbor.lng]], {
                        color: currentMode === 'dark' ? '#ff6b6b' : '#cc0000', // Softer red for main connections
                        weight: 2, // Thinner than before
                        opacity: 0.6, // Less dominant
                        interactive: false
                    }).addTo(this.featureGroup);
                }
            });
        });
    }

    connectToMains(loc) {
        // Find nearby mains and draw connections
        Object.values(data.mains).forEach(main => {
            const distance = Math.sqrt(Math.pow(loc.pos[0] - main.lat, 2) + Math.pow(loc.pos[1] - main.lng, 2));

            // Only draw connection if reasonably close (adjust threshold as needed)
            if (distance < 0.5) { // Adjust this threshold based on your data scale
                data.L.polyline([loc.pos, [main.lat, main.lng]], {
                    color: '#888', // Medium gray for location-to-main connections
                    weight: 1.5,
                    opacity: 0.5,
                    dashArray: '2, 4', // Different dash pattern
                    interactive: false
                }).addTo(this.featureGroup);
            }
        });
    }

    drawLedger() {
        this.pathGroup.clearLayers();
        const currentLedger = get(ledger);
        currentLedger.forEach(step => {
            this.path(step);
        });
    }

    path(stepOrIndex) {
        let step;

        // Handle both step object and index parameter
        if (typeof stepOrIndex === 'number') {
            const currentLedger = get(ledger);
            if (stepOrIndex >= 0 && stepOrIndex < currentLedger.length) {
                this.clearPaths();
                step = currentLedger[stepOrIndex];
            } else {
                return null;
            }
        } else {
            step = stepOrIndex;
        }

        console.log(step);
        const isRenewable = data.loc[step.startid]?.prop.type && typeMap[data.loc[step.startid].prop.type]?.renewable;
        const color = isRenewable ? "#2ecc71" : "#e74c3c";

        // Create a highly visible path with glow effect
        const path = data.L.polyline(step.path, {
            color: color,
            weight: 8,      // Very thick for maximum visibility
            opacity: 1.0,   // Fully opaque
            className: 'energy-path',
            interactive: false
        }).addTo(this.pathGroup);

        // Add a glow/outline effect for even better visibility
        const glowPath = data.L.polyline(step.path, {
            color: 'white',  // White glow around the path
            weight: 12,      // Larger weight for glow effect
            opacity: 0.6,    // Semi-transparent glow
            interactive: false
        }).addTo(this.pathGroup);

        // Bring the main path to front
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
