import { get } from "svelte/store";
import { data, ledger } from "./data.js";

export function getGraphPath(dataPoints, width, height, maxVal) {
    if (!dataPoints || dataPoints.length === 0) return "";
    const step = width / (dataPoints.length - 1);
    const scale = height / (maxVal || Math.max(...dataPoints, 1));
    return dataPoints
        .map(
            (d, i) =>
                `${i === 0 ? "M" : "L"} ${i * step} ${height - d * scale}`,
        )
        .join(" ");
}

export function getTotalEnergy() {
    const currentLedger = get(ledger);
    return currentLedger.reduce(
        (total, step) => total + step.startenergy,
        0,
    );
}

export function getRenewableEnergy() {
    const currentLedger = get(ledger);
    const renewableTypes = [
        "solar",
        "wind",
        "hydro",
        "geothermal",
        "biomass",
    ];
    return currentLedger.reduce((total, step) => {
        const sourceNode = data.loc[step.startid];
        if (sourceNode) {
            if (renewableTypes.includes(sourceNode.prop.source_type)) {
                return total + step.startenergy;
            }
        }
        return total;
    }, 0);
}

export function getNonRenewableEnergy() {
    const currentLedger = get(ledger);
    const nonRenewableTypes = ["coal", "gas", "oil", "nuclear", "thermal"];
    return currentLedger.reduce((total, step) => {
        const sourceNode = data.loc[step.startid];
        if (sourceNode) {
            if (nonRenewableTypes.includes(sourceNode.prop.source_type)) {
                return total + step.startenergy;
            }
        }
        return total;
    }, 0);
}
