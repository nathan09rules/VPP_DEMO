export const data = {
    mains: {}, //for each index {id :id , pos:(lat , lng) , neigbours:[mainsid1 , mainsid2 , ...]} the mainsid means neigbours
    loc: {}, //for each index {id :id , pos:(lat , lng) , prop: {prod , dem , store, priority, type}, neigbours:[mainsid1 , mainsid2 , ...]}
    ledger: [], //for each index {startid , endid , startenergy , endenergy , path : [node1 , node2 , ...]}
    map,
    L,
    active,
    config: {

    }
};