import { data, ledger as ledgerStore } from "./data.js";
import { get } from "svelte/store";

export class optimize {
    static run() {
        const result = this.optimizeRegions();
        ledgerStore.set(result.ledger);
        return result;
    }

    static optimizeRegions() {
        const locs = data.loc;
        if (!locs) return { ledger: [] };

        const ledger = [];
        const lossPerStep = 0.005; // 0.5% loss per "connection"

        // Sort deficits by priority
        let deficitIds = Object.keys(locs)
            .filter(id => (locs[id].prop.dem - locs[id].prop.prod) > 0.1)
            .sort((a, b) => (locs[b].prop.priority || 5) - (locs[a].prop.priority || 5));

        // Get surplus sources
        const surplusNodes = Object.keys(locs).filter(id => (locs[id].prop.prod - locs[id].prop.dem) > 0.1);

        console.log('Deficit nodes:', deficitIds);
        console.log('Surplus nodes:', surplusNodes);

        // Pass 1: Renewables
        deficitIds.forEach(targetId => {
            const currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod;
            if (currentDeficit > 0.1) {
                console.log(`Processing deficit node ${targetId} with deficit ${currentDeficit}`);
                this.transferEnergy(targetId, currentDeficit, true, surplusNodes, ledger, lossPerStep);
            }
        });

        // Pass 2: Non-Renewables
        deficitIds.forEach(targetId => {
            const currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod;
            if (currentDeficit > 0.1) {
                console.log(`Processing deficit node ${targetId} with deficit ${currentDeficit} (non-renewable)`);
                this.transferEnergy(targetId, currentDeficit, false, surplusNodes, ledger, lossPerStep);
            }
        });

        console.log('Final ledger:', ledger);
        return { ledger };
    }

    static transferEnergy(targetId, amount, onlyRenewable, surplusNodes, ledger, lossFactor) {
        const target = data.loc[targetId];

        // Simple BFS to find closest source in the grid
        const sourceId = this.nearestSource(targetId, onlyRenewable, surplusNodes);
        if (!sourceId) return;

        const source = data.loc[sourceId];
        const supply = Math.min(amount, source.prop.prod - source.prop.dem);

        if (supply <= 0) return;

        // Path is just start and end for this demo, or we can use the neighbors
        // Let's create a simple path using neighbors if they exist
        const path = this.findPath(sourceId, targetId);

        // Debug: Log the path to see what's happening
        console.log(`Path from ${sourceId} to ${targetId}:`, path);

        ledger.push({
            startid: sourceId,
            endid: targetId,
            startenergy: supply,
            endenergy: supply * (1 - (path.length * lossFactor)),
            path: path.map(id => {
                const node = data.loc[id] || data.mains[id];
                if (!node) return [0, 0];
                if (node.pos) return node.pos;
                return [node.lat, node.lng];
            })
        });
    }

    static nearestSource(startId, onlyRenewable, surplusNodes) {
        let bestSource = null;
        let minDist = Infinity;

        surplusNodes.forEach(sId => {
            const s = data.loc[sId];
            const isRenewable = ['solar', 'wind', 'hydro', 'geothermal', 'biomass'].includes(s.prop.source_type);

            if (onlyRenewable && !isRenewable) return;
            if (!onlyRenewable && isRenewable && s.prop.source_type !== 'thermal' && s.prop.source_type !== 'nuclear') return;

            const dist = this.getDist(data.loc[startId].pos, s.pos);
            if (dist < minDist) {
                minDist = dist;
                bestSource = sId;
            }
        });

        return bestSource;
    }

    static findPath(startId, endId) {
        // BFS pathfinding through the grid network
        if (startId == endId) return [startId];

        const queue = [[startId]];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];
            const currentNode = data.loc[currentId] || data.mains[currentId];
            if (!currentNode) continue;

            const neighbors = currentNode.neighbours || currentNode.neighbors || [];
            for (const neighborId of neighbors) {
                if (neighborId == endId) {
                    return [...path, neighborId];
                }

                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push([...path, neighborId]);
                }
            }
        }

        // If no path found through local network, try extended BFS (15 steps)
        const startNode = data.loc[startId];
        if (startNode && (startNode.neighbours.length > 0 || (startNode.neighbors && startNode.neighbors.length > 0))) {
            const extendedQueue = [[startId]];
            const extendedVisited = new Set([startId]);
            let steps = 0;

            while (extendedQueue.length > 0 && steps < 15) {
                const extendedPath = extendedQueue.shift();
                const currentId = extendedPath[extendedPath.length - 1];
                const node = data.loc[currentId] || data.mains[currentId];
                if (!node) continue;

                const neighbors = node.neighbours || node.neighbors || [];
                for (const neighborId of neighbors) {
                    if (neighborId == endId) {
                        return [...extendedPath, neighborId];
                    }
                    if (!extendedVisited.has(neighborId)) {
                        extendedVisited.add(neighborId);
                        extendedQueue.push([...extendedPath, neighborId]);
                    }
                }
                steps++;
            }
        }

        // Final fallback: direct path
        return [startId, endId];
    }

    static getDist(p1, p2) {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    }
}
