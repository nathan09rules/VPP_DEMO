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

        // Pass 1: Renewables
        deficitIds.forEach(targetId => {
            const currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod;
            if (currentDeficit > 0.1) {
                this.transferEnergy(targetId, currentDeficit, true, surplusNodes, ledger, lossPerStep);
            }
        });

        // Pass 2: Non-Renewables
        deficitIds.forEach(targetId => {
            const currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod;
            if (currentDeficit > 0.1) {
                this.transferEnergy(targetId, currentDeficit, false, surplusNodes, ledger, lossPerStep);
            }
        });

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
        console.log(`Path coordinates:`, path.map(id => data.loc[id].pos));

        // Update local prod/dem to reflect transfer (simulation)
        // Note: In a real app we might not want to mutate original data directly without a clone
        // but for the demo we'll just track it in the ledger.

        ledger.push({
            startid: sourceId,
            endid: targetId,
            startenergy: supply,
            endenergy: supply * (1 - (path.length * lossFactor)),
            path: path.map(id => data.loc[id].pos)
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
        if (startId === endId) return [startId];

        const queue = [[startId]];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];
            const currentNode = data.loc[currentId];

            // Check all neighbors
            for (const neighborId of currentNode.neighbours) {
                if (neighborId === endId) {
                    return [...path, neighborId];
                }

                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push([...path, neighborId]);
                }
            }
        }

        // If no path found through local network, try extended BFS (10 steps)
        // This allows finding longer network paths before falling back to direct
        const startNode = data.loc[startId];
        const endNode = data.loc[endId];

        // If both nodes have neighbors, try extended BFS through the network
        if (startNode.neighbours.length > 0 || endNode.neighbours.length > 0) {
            // Extended BFS with 10-step limit to find longer network paths
            const extendedQueue = [[startId]];
            const extendedVisited = new Set([startId]);
            let steps = 0;

            while (extendedQueue.length > 0 && steps < 10) {
                const extendedPath = extendedQueue.shift();
                const currentExtendedId = extendedPath[extendedPath.length - 1];
                const currentExtendedNode = data.loc[currentExtendedId];

                for (const extendedNeighborId of currentExtendedNode.neighbours) {
                    if (extendedNeighborId === endId) {
                        return [...extendedPath, extendedNeighborId];
                    }

                    if (!extendedVisited.has(extendedNeighborId)) {
                        extendedVisited.add(extendedNeighborId);
                        extendedQueue.push([...extendedPath, extendedNeighborId]);
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
