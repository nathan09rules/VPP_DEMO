<script>
    import global from "$lib/assets/global.css";
    import { onMount } from "svelte";
    import { get } from "svelte/store";

    import { init } from "$lib/init.js";
    import { map } from "$lib/draw.js";
    import { optamize } from "$lib/optamize.js";
    import { data } from "$lib/data.js";

    onMount(() => {
        init.run();
        map.run();
        optamize.run();
    });
</script>

<div id="map"></div>
<!-- map -->

<div class="sidebar">
    <button>D</button>
    <!-- Dark/Light mode -->
    <button>S</button>
    <!-- Settings -->
    <button>M</button>
    <!-- Modes -->
</div>

<div id="modes"></div>

<div class="inspect">
    <div class="row">
        <span class="label">Name:</span>
        <span id="name"></span>
    </div>
    <!--if !Advanedmode-->
    <div class="row">
        <span class="label">Net:</span>
        <span id="net"></span>
    </div>
    <div class="row">
        <span class="label">Store:</span>
        <span id="store"></span>
    </div>
    <!--else-->
    <!--CHANGE ALL VARIABLE NAME AND STUFF THIS IS PREVIOUS FAILED IMPLEMENATATION-->
    <div class="inspect-row">
        <label for="prod">Production:</label><input
            id="prod"
            type="number"
            bind:value={$activeData.prod}
            on:change={() => {}}
        />
    </div>
    <div class="inspect-row">
        <label for="dem">Demand:</label><input
            id="dem"
            type="number"
            bind:value={$activeData.dem}
            on:change={() => {}}
        />
    </div>
    <div class="inspect-row">
        <label for="store">Store:</label><input
            id="store"
            type="number"
            bind:value={$activeData.store}
            on:change={() => {}}
        />
    </div>
    <div class="inspect-row">
        <label for="priority">Priority:</label><input
            id="priority"
            type="number"
            bind:value={$activeData.priority}
            on:change={() => {}}
        />
    </div>
    <div class="inspect-row">
        <span class="label">Latitude:</span>
        <span>{$activeData.lat}</span>
    </div>
    <div class="inspect-row">
        <span class="label">Longitude:</span>
        <span>{$activeData.lng}</span>
    </div>
    <!--ENDIf-->
</div>

<div class="settings">
    <button>CONFIG</button>
    <!-- Settings  we will deal with later-->
    <button>DATA</button>
    <button>ADVANCED</button>
    <button>RESET</button>
    <button>OPTIMIZE</button>
</div>

<div class="timeline">
    <button>BACK</button>
    <button>PLAY</button>
    <button>FORWARD</button>
</div>
