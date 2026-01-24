import { data } from "./data.js";
import { draw } from "./draw.js";

let Light;
let Dark;

export class init {

    run() {
        try {
            await import("leaflet/dist/leaflet.css");

            data.map //insitalise the map using leaflet
            data.L //do the L stuff and add the data , i dont knwo if neccesary so dont add if not

            this.load(); // loads all data into data
            this.check();

        }
        catch (e) {
            console.log(e);
        }
    }

    load() {
        const url = "./loactions.geojson";

        //Fetch url data and init into data

        //Save this on load
        Light = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);
        Dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
    }

    check() {
        //sublines take ref from draw.js
        //sublines connect loc to the mains based on
        //closestneighbour_dist * 2.5 < closestmains_dist then connect to closestneighbour
        //else connect to closestmains
        //store all this data in loc.neigbours if not already there    
    }
}