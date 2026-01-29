export const simulation = {
    // Solar Zenith Angle approximation
    // phi: latitude in radians
    // month: 0-11
    // hour: 0-23
    getZenithAngle(lat, month, hour) {
        const phi = lat * Math.PI / 180;
        const delta = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + month * 30 + 15) / 365); // Declination
        const h = (hour - 12) * Math.PI / 12; // Hour angle
        const cosThetaZ = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h);
        return Math.acos(Math.max(-1, Math.min(1, cosThetaZ)));
    },

    calculateSolar(peak, lat, month, hour) {
        const thetaZ = this.getZenithAngle(lat, month, hour);
        const cosThetaZ = Math.cos(thetaZ);
        if (cosThetaZ <= 0) return 0;
        // P = Peak * 1.1 * IClrar * cos(thetaZ)
        // We use peak as a scaling factor for the max possible clear sky radiation
        return peak * 1.1 * cosThetaZ;
    },

    calculateWind(peak, month, hour) {
        // Wind is less dependent on time of day in a simple model, but lets add some variation
        // Monthly variation could be significant
        const monthlyFactor = 1 + 0.2 * Math.sin(2 * Math.PI * month / 12);
        const hourlyFactor = 0.8 + 0.4 * Math.random(); // simplified random wind
        return peak * monthlyFactor * hourlyFactor;
    },

    calculateHydro(peak, month) {
        // Hydro depends on flow rate, which varies seasonally
        const monthlyFactor = 0.7 + 0.5 * Math.sin(2 * Math.PI * month / 12);
        return peak * monthlyFactor;
    },

    calculateThermal(peak, type) {
        // Nuclear: 0.9, coal/gas: 0.4-0.7
        let cf = 0.7;
        if (type === 'nuclear') cf = 0.9;
        if (type === 'biomass') cf = 0.6;
        return peak * cf;
    },

    getHourlyProfiles(node, month) {
        const lat = node.pos[0];
        const peakProd = Math.max(...node.prop.hourlyProd);
        const peakDem = Math.max(...node.prop.hourlyDem);
        const type = node.prop.type;

        const newProd = [];
        const newDem = [];

        for (let h = 0; h < 24; h++) {
            let p = 0;
            if (peakProd > 0) {
                if (type === 'solar') {
                    p = this.calculateSolar(peakProd, lat, month, h);
                } else if (type === 'wind') {
                    p = this.calculateWind(peakProd, month, h);
                } else if (type === 'hydro') {
                    p = this.calculateHydro(peakProd, month);
                } else {
                    p = this.calculateThermal(peakProd, type);
                }
            }
            newProd.push(Math.round(p));

            // Demand also varies by month (e.g. AC in summer)
            const seasonFactor = 1 + 0.3 * Math.sin(2 * Math.PI * (month - 6) / 12); // peak in summer (July)
            newDem.push(Math.round(node.prop.hourlyDem[h] * seasonFactor));
        }

        return { prod: newProd, dem: newDem };
    }
};
