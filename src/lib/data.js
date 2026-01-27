import { writable } from 'svelte/store';

export const data = {
    mains: {}, // {id: {id, lat, lng, neighbors: []}}
    loc: {},   // {id: {id, pos: [lat, lng], prop: {prod, dem, store, priority, type, hourlyProd: [], hourlyDem: []}, neighbours: []}}
    ledger: writable([]),
    map: null,
    L: null,
    active: writable(null),
    time: writable({
        month: 0, // 0-11
        day: 1,
        hour: 12
    }),
    config: writable({
        transmissionLoss: 0.0005,
        renewableBonus: 1.5,
        maxSteps: 5,
        theme: 'light',
        mode: 'inspect', // inspect, visual, heatmap
    }),
    featureGroup: null,
    pathGroup: null,
    activeIndex: writable(-1)
};

export const activeData = data.active;
export const config = data.config;
export const ledger = data.ledger;
export const time = data.time;
export const activeIndex = data.activeIndex;