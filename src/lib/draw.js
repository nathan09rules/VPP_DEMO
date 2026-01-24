import { data } from "./data.js";

const typeMap = {
    solar: { code: "S", color: "#FFD700", renewable: true },
    wind: { code: "W", color: "#00BFFF", renewable: true },
    hydro: { code: "H", color: "#4169E1", renewable: true },
    nuclear: { code: "N", color: "#ADFF2F", renewable: true },
    biomass: { code: "B", color: "#32CD32", renewable: true },
    geothermal: { code: "G", color: "#F4A460", renewable: true },
    coal: { code: "C", color: "#8B4513", renewable: false },
    gas: { code: "G", color: "#FFA500", renewable: false },
    oil: { code: "O", color: "#FF4500", renewable: false },
    hospital: { code: "H+", color: "#FF0000", renewable: false },
    police: { code: "P", color: "#1E90FF", renewable: false },
    university: { code: "U", color: "#9370DB", renewable: false },
    bank: { code: "B", color: "#2E8B57", renewable: false },
    power_plant: { code: "P", color: "#FFA500", renewable: false },
    power: { code: "P", color: "#FFA500", renewable: false },
};

export class draw {
    run() { //runs only on load
        this.border();
        this.mains(data.mains, data.loc);
        this.locations(data.loc);
    }

    border() {
        const border = "./border.geojson";
        //draw the borders onto the map

    }

    locations(loc) {
        //draw a circleMarker for each location in loc 

        //each marker should on click set data.active to the loactions properties
        //colour each marker based on net energy and type using typeMap
        //each marker should on hover show the name of the location
    }

    mains(mains, loc) {
        //mains are purely positional nodes and just connect two regions you 

        //fetch the data from data.json
        const url = "./data.json";

        //draw the mains onto the map using data.mains

        //once drawn mains now we will darw sublines

        //draw sublines as in the lines to the neighbours of loc
    }

    path(index) { // the index of the ledger
        //draw a path using index
        //draw a green path if loc[endid].prop.type is renewable
        //else draw a red path
    }

    clear() {//IDK just clear the map of all the markers and stuff

    }


}