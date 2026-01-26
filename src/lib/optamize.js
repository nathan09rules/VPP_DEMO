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
        const path = this.findPath(targetId, sourceId);

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
        // Very simple pathfinding: start -> end
        // In a real grid we'd do BFS/Dijkstra
        return [endId, startId];
    }

    static getDist(p1, p2) {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    }
}
