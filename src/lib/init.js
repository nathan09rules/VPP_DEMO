import { data } from "./data.js";
import { draw } from "./draw.js";

let Light;
let Dark;
let renderer;

export const init = {
    async run() {
        if (typeof window === "undefined") return;
        try {
            const L = await import("leaflet");
            data.L = L.default || L;

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
                data.loc[id] = {
                    id: id,
                    pos: [f.properties.lat, f.properties.lng],
                    prop: {
                        name: f.properties.name,
                        prod: f.properties.prod || 0,
                        dem: f.properties.dem || 0,
                        store: f.properties.store || 0,
                        priority: f.properties.priority || 5,
                        type: f.properties.sub_type || 'power'
                    },
                    neighbours: []
                };
            });

            const mainsRes = await fetch("/data.json");
            const mainsData = await mainsRes.json();
            data.mains = mainsData.mains;

        } catch (e) {
            console.error("Load failed:", e);
        }
    },

    // Improved grid logic - creates a clean grid without loops
    createGrid() {
        const locs = Object.values(data.loc);

        // Clear existing neighbours
        locs.forEach(loc => {
            loc.neighbours = [];
        });

        // Create a grid-like structure to avoid loops
        // Sort locations by position to create a logical grid
        const sortedByLat = [...locs].sort((a, b) => a.pos[0] - b.pos[0]);
        const sortedByLng = [...locs].sort((a, b) => a.pos[1] - b.pos[1]);

        // Connect each location to its nearest neighbors in a grid pattern
        locs.forEach(loc => {
            const candidates = [];

            // Find nearest neighbors without creating loops
            sortedByLat.forEach(other => {
                if (other.id === loc.id) return;

                // Calculate distance
                const distance = Math.sqrt(Math.pow(loc.pos[0] - other.pos[0], 2) + Math.pow(loc.pos[1] - other.pos[1], 2));

                // Only add if it doesn't create a loop (simple check)
                if (!loc.neighbours.includes(other.id) && !other.neighbours.includes(loc.id)) {
                    candidates.push({ id: other.id, distance, node: other });
                }
            });

            // Sort by distance and take top 2-3 (reduced from 3 to minimize loops)
            candidates.sort((a, b) => a.distance - b.distance);
            const connections = candidates.slice(0, 2).map(c => c.id); // Reduced to 2 connections max

            // Add connections
            loc.neighbours.push(...connections);

            // Add reciprocal connections
            connections.forEach(connId => {
                const connNode = data.loc[connId];
                if (connNode && !connNode.neighbours.includes(loc.id)) {
                    connNode.neighbours.push(loc.id);
                }
            });
        });

        // Post-process to remove any remaining loops
        this.removeLoops();
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
