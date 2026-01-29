import { data } from "./data.js";
import { draw } from "./draw.js";
import { simulation } from "./simulation.js";

let Light;
let Dark;
let renderer;

export const init = {
    async run() {
        if (typeof window === "undefined") return;
        try {
            const L = await import("leaflet");
            data.L = L.default || L;
            if (typeof window !== "undefined") {
                window.L = data.L;
                await import("leaflet.heat");
            }

            // Adjusted start view: Zoom 6 and centered more broadly
            data.map = data.L.map("map", {
                center: [24.0, 54.0], // Broad UAE center
                zoom: 6,
                zoomControl: false
            });

            Light = data.L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(data.map);
            Dark = data.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

            await this.load();
            this.createGrid(); // Use the provided sublines logic

            renderer = new draw();
            renderer.run();

        }
        catch (e) {
            console.error("Init failed:", e);
        }
    },

    async load() {
        try {
            const locRes = await fetch("/locations.geojson");
            const locData = await locRes.json();

            locData.features.forEach((f, i) => {
                const id = `loc_${i}`;
                const hourlyProd = f.properties.prod_hourly || Array(24).fill(0);
                const hourlyDem = f.properties.dem_hourly || Array(24).fill(0);

                // If sub_type is power, use source_type as the primary type
                // Otherwise use sub_type (hospital, police, etc.)
                let type = f.properties.sub_type || 'power';
                if (type === 'power' && f.properties.source_type) {
                    type = f.properties.source_type;
                }

                data.loc[id] = {
                    id: id,
                    pos: [f.properties.lat, f.properties.lng],
                    prop: {
                        name: f.properties.name,
                        prod: 0, // Set later
                        dem: 0,  // Set later
                        external: 0,  //later
                        hourlyProd: hourlyProd,
                        hourlyDem: hourlyDem,
                        store: f.properties.store || 0,
                        priority: f.properties.priority || 5,
                        type: type,
                        source_type: f.properties.source_type
                    },
                    neighbours: []
                };

                // Apply simulation logic to get realistic profiles
                const initialMonth = 0; // January
                const profiles = simulation.getHourlyProfiles(data.loc[id], initialMonth);
                data.loc[id].prop.hourlyProd = profiles.prod;
                data.loc[id].prop.hourlyDem = profiles.dem;
                data.loc[id].prop.prod = profiles.prod[12];
                data.loc[id].prop.dem = profiles.dem[12];
            });

            const mainsRes = await fetch("/data.json");
            const mainsData = await mainsRes.json();
            data.mains = mainsData.mains;

        } catch (e) {
            console.error("Load failed:", e);
        }
    },

    // Connect all locations to main junctions
    createGrid() {
        const locs = Object.values(data.loc);

        // Clear existing neighbours
        locs.forEach(loc => {
            loc.neighbours = [];
        });

        // Connect all locations to closest main junctions
        locs.forEach(loc => {
            let closestMain = null;
            let minDistance = Infinity;

            // Find closest main junction
            Object.values(data.mains).forEach(main => {
                const distance = Math.sqrt(Math.pow(loc.pos[0] - main.lat, 2) + Math.pow(loc.pos[1] - main.lng, 2));
                if (distance < minDistance) {
                    minDistance = distance;
                    closestMain = main;
                }
            });

            // Connect to closest main junction
            if (closestMain) {
                loc.neighbours.push(closestMain.id);

                // Bidirectional: connect main back to loc for pathfinding
                if (!closestMain.neighbors) closestMain.neighbors = [];
                if (!closestMain.neighbors.includes(loc.id)) {
                    closestMain.neighbors.push(loc.id);
                }
            }
        });

        // Check for nodes not connected to grid
        const unconnectedNodes = locs.filter(loc => loc.neighbours.length === 0);
        if (unconnectedNodes.length > 0) {
            console.log(`[GRID CHECK] ${unconnectedNodes.length} nodes are not connected to the grid:`);
            unconnectedNodes.forEach(node => {
                console.log(`  - Node ${node.id} (${node.prop.name || 'Unnamed'}): pos=[${node.pos[0]}, ${node.pos[1]}]`);
            });
        } else {
            console.log("[GRID CHECK] All nodes are connected to the grid.");
        }
    },

    setTheme(theme) {
        if (theme === 'dark') {
            data.map.removeLayer(Light);
            Dark.addTo(data.map);
        } else {
            data.map.removeLayer(Dark);
            Light.addTo(data.map);
        }
    },

    refresh() {
        if (renderer) renderer.run();
    }
};