import { data } from "./data.js";

export class optamize {
    run() {
        //THIS IS PURELY COMPUTATIONAL OPTAMIZATION

        //steps:
        //sort each loc by priority
        //then desending from priority SORT by is loc.prod - loc.dem < 0 then put in deficit else surplus
        //for each loc run index = optamize(loc)
        //push index into ledger array

        //finally data.ledger = ledger
    }

    optamize(loc) {
        //Here we will try to find the best path to suply the deficit
        //Do a BFS of 5 steps 
        //if you find a souce with enough energy to supply then stop and consume
        //else find the closest renewable and non renewable source 
        //if closest renewable * 1.5 < closest non renewable then use renewable
        //else use non renewable
        //Now we know start and end pos

        //Then we find the optimal path using neighbours
        //We do another 5 step BFS on the end node until we find a mains node we are connected to
        //WE do a DFS exclusive to mains neighbours which are other mains since little mains
        //Finally we do some math on the dist * wight * startenergy = endenergy

        //return {startid , endid , startenergy , endenergy , path : [node1 , node2 , ...]}
    }
}