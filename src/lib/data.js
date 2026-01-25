import { writable } from 'svelte/store';

export const data = {
    mains: {}, // {id: {id, lat, lng, neighbors: []}}
    loc: {},   // {id: {id, pos: [lat, lng], prop: {prod, dem, store, priority, type}, neighbours: []}}
    ledger: writable([]),
    map: null,
    L: null,
    active: writable(null),
    config: writable({
        transmissionLoss: 0.0005,
        renewableBonus: 1.5,
        maxSteps: 5,
        theme: 'light',
        mode: 'inspect' // inspect, visual, heatmap
    })
};

export const activeData = data.active;
export const config = data.config;
export const ledger = data.ledger;