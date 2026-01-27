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
            const locRes = await fetch("/loactions.geojson");
            const locData = await locRes.json();

            locData.features.forEach((f, i) => {
                const id = `loc_${i}`;
                const hourlyProd = f.properties.prod_hourly || Array(24).fill(0);
                const hourlyDem = f.properties.dem_hourly || Array(24).fill(0);

                data.loc[id] = {
                    id: id,
                    pos: [f.properties.lat, f.properties.lng],
                    prop: {
                        name: f.properties.name,
                        prod: 0, // Set later
                        dem: 0,  // Set later
                        hourlyProd: hourlyProd,
                        hourlyDem: hourlyDem,
                        store: f.properties.store || 0,
                        priority: f.properties.priority || 5,
                        type: f.properties.sub_type || 'power',
                        source_type: f.properties.source_type || 'thermal'
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

        // Connect all locations to main junctions
        locs.forEach(loc => {
            loc.neighbours = [];
            Object.keys(data.mains).forEach(mainId => {
                loc.neighbours.push(mainId);
            });
        });
    },

    // Connect all locations to nearest main junctions
    connectAllToNearestMains(locs) {
        // Clear any existing connections first
        locs.forEach(loc => {
            loc.neighbours = loc.neighbours.filter(id => data.mains[id]);
        });

        // Connect each location to its single nearest main junction
        try {
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
                if (closestMain && !loc.neighbours.includes(closestMain.id)) {
                    loc.neighbours.push(closestMain.id);
                }
            });
        } catch (e) {
            console.error("Connect all to nearest mains failed:", e);
        }
    },

    // Add additional local connections for network redundancy
    addLocalConnections(locs) {
        locs.forEach(loc => {
            // Find nearest neighbors for local connectivity
            const candidates = [];

            locs.forEach(other => {
                if (other.id === loc.id) return;
                if (loc.neighbours.includes(other.id)) return; // Already connected

                const distance = Math.sqrt(Math.pow(loc.pos[0] - other.pos[0], 2) + Math.pow(loc.pos[1] - other.pos[1], 2));

                // Only consider reasonably close neighbors
                if (distance < 0.8) {
                    candidates.push({ id: other.id, distance, node: other });
                }
            });

            // Sort by distance and add up to 2 additional connections
            candidates.sort((a, b) => a.distance - b.distance);
            const newConnections = candidates.slice(0, 2).map(c => c.id);

            newConnections.forEach(connId => {
                if (!loc.neighbours.includes(connId)) {
                    loc.neighbours.push(connId);
                    const connNode = data.loc[connId];
                    if (connNode && !connNode.neighbours.includes(loc.id)) {
                        connNode.neighbours.push(loc.id);
                    }
                }
            });
        });
    },

    // Helper function to remove loops from the network
    removeLoops() {
        const locs = Object.values(data.loc);

        locs.forEach(loc => {
            // Check for redundant connections that create loops
            const toRemove = [];

            for (let i = 0; i < loc.neighbours.length; i++) {
                for (let j = i + 1; j < loc.neighbours.length; j++) {
                    const n1 = data.loc[loc.neighbours[i]];
                    const n2 = data.loc[loc.neighbours[j]];

                    if (!n1 || !n2) continue;

                    // If n1 and n2 are also connected, we have a triangle (loop)
                    if (n1.neighbours.includes(n2.id) && n2.neighbours.includes(n1.id)) {
                        // Remove the longest connection to break the loop
                        const dist1 = Math.sqrt(Math.pow(loc.pos[0] - n1.pos[0], 2) + Math.pow(loc.pos[1] - n1.pos[1], 2));
                        const dist2 = Math.sqrt(Math.pow(loc.pos[0] - n2.pos[0], 2) + Math.pow(loc.pos[1] - n2.pos[1], 2));

                        if (dist1 > dist2) {
                            toRemove.push(loc.neighbours[i]);
                        } else {
                            toRemove.push(loc.neighbours[j]);
                        }
                    }
                }
            }

            // Remove redundant connections
            toRemove.forEach(id => {
                const index = loc.neighbours.indexOf(id);
                if (index > -1) {
                    loc.neighbours.splice(index, 1);
                }

                // Remove reciprocal connection
                const other = data.loc[id];
                if (other) {
                    const otherIndex = other.neighbours.indexOf(loc.id);
                    if (otherIndex > -1) {
                        other.neighbours.splice(otherIndex, 1);
                    }
                }
            });
        });
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
