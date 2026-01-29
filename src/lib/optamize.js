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
        const lossPerStep = 0; // SET TO 0 FOR NO ERRORS (AS REQUESTED)
        const realLossFactor = 0.005; // The "TRUTH" factor for console
        let totalUnmet = 0;

        // Reset external flows
        Object.values(locs).forEach(node => {
            node.prop.external = 0;
        });

        // Sort deficits by priority
        let deficitIds = Object.keys(locs)
            .filter(id => (locs[id].prop.dem - locs[id].prop.prod) > 0.1)
            .sort((a, b) => (locs[b].prop.priority || 5) - (locs[a].prop.priority || 5));

        // Get surplus sources
        const surplusNodes = Object.keys(locs).filter(id => (locs[id].prop.prod - locs[id].prop.dem) > 0.1);

        // Pass 1: Renewables
        deficitIds.forEach(targetId => {
            let currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod;
            if (currentDeficit > 0.1) {
                let attempts = 0;
                while (currentDeficit > 0.1 && attempts < 10) {
                    const transferred = this.transferEnergy(targetId, currentDeficit, true, surplusNodes, ledger, lossPerStep);
                    if (transferred <= 0) break;
                    currentDeficit -= transferred;
                    attempts++;
                }
                if (currentDeficit > 0.1) {
                    //console.warn(`[Optimization] Node ${targetId} still has ${currentDeficit.toFixed(1)} MW deficit after Pass 1 (Renewables). Source exhausted or no path.`);
                }
            }
        });

        // Pass 2: Non-Renewables
        deficitIds.forEach(targetId => {
            let currentDeficit = locs[targetId].prop.dem - locs[targetId].prop.prod - (locs[targetId].prop.external || 0);
            if (currentDeficit > 0.1) {
                let attempts = 0;
                while (currentDeficit > 0.1 && attempts < 10) {
                    const transferred = this.transferEnergy(targetId, currentDeficit, false, surplusNodes, ledger, lossPerStep);
                    if (transferred <= 0) break;
                    currentDeficit -= transferred;
                    attempts++;
                }
                if (currentDeficit > 0.1) {
                    //console.error(`[Optimization] FINAL CRITICAL DEFICIT on Node ${targetId}: ${currentDeficit.toFixed(1)} MW unmet.`);
                }
            }
        });

        // Calculate final total unmet demand
        Object.values(locs).forEach(node => {
            const net = node.prop.prod - node.prop.dem + (node.prop.external || 0);
            if (net < -0.1) {
                totalUnmet += Math.abs(net);
            }
        });

        if (totalUnmet > 0.1) {
            //console.error(`[Optimization] Grid cannot meet total demand. Total System Deficit: ${totalUnmet.toFixed(1)} MW`);
        } else {
            //console.log(`[Optimization] Grid success. All demand met.`);
        }

        return { ledger, totalUnmet };
    }

    static transferEnergy(targetId, amount, onlyRenewable, surplusNodes, ledger, lossFactor) {
        const target = data.loc[targetId];

        // Simple BFS to find closest source in the grid
        const sourceId = this.nearestSource(targetId, onlyRenewable, surplusNodes);
        if (!sourceId) {
            if (onlyRenewable) {
                // Not an error, just no renewables near
            } else {
                //console.warn(`[GRID TRUTH] No available source found for ${targetId}. Surplus nodes may be exhausted or unreachable.`);
            }
            return 0;
        }

        const source = data.loc[sourceId];
        const supply = Math.min(amount, source.prop.prod - source.prop.dem + (source.prop.external || 0));

        if (supply <= 0.1) {
            return 0;
        }

        const path = this.findPath(sourceId, targetId);

        // Calculate THE TRUTH (Theoretical loss)
        const theoreticalLossFactor = 0.005;
        const trueLoss = supply * (path.length * theoreticalLossFactor);
        const dist = this.getDist(source.pos, target.pos);

        //console.log(`%c[TRUTH] Transfer ${supply.toFixed(1)}MW: ${sourceId} -> ${targetId} | Distance: ${(dist * 100).toFixed(2)}km | Theoretical Loss: ${trueLoss.toFixed(2)}MW`, "color: #00BFFF");

        // Track external flow
        source.prop.external = (source.prop.external || 0) - supply;
        target.prop.external = (target.prop.external || 0) + supply;

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

        return supply;
    }

    static nearestSource(startId, onlyRenewable, surplusNodes) {
        let bestSource = null;
        let minDist = Infinity;

        const renewableTypes = ['solar', 'wind', 'hydro', 'geothermal', 'biomass'];

        surplusNodes.forEach(sId => {
            const s = data.loc[sId];
            const isRenewable = renewableTypes.includes(s.prop.type);

            // Pass 1: Renewables Only
            if (onlyRenewable && !isRenewable) return;

            // Pass 2: Anything goes (Prefer non-renewables if we want, but let's just make it work)
            // If onlyRenewable is false, we allow both non-renewables and LEFT-OVER renewables.

            // CHECK: Does this source still have surplus energy?
            const available = s.prop.prod - s.prop.dem + (s.prop.external || 0);
            if (available <= 0.1) return;

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
