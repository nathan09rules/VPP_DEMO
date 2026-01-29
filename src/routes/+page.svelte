<script>
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import {
        data,
        activeData,
        config,
        ledger,
        time,
        activeIndex,
    } from "$lib/data.js";
    import { init } from "$lib/init.js";
    import { optimize } from "$lib/optamize.js";
    import { draw } from "$lib/draw.js";
    import { simulation } from "$lib/simulation.js";
    import "../lib/assets/global.css";

    // Components
    import Legend from "$lib/components/Legend.svelte";
    import Clock from "$lib/components/Clock.svelte";
    import MapControls from "$lib/components/MapControls.svelte";
    import InspectPanel from "$lib/components/InspectPanel.svelte";
    import Dashboard from "$lib/components/Dashboard.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import AddNodeModal from "$lib/components/AddNodeModal.svelte";

    let theme = $state("light");
    let isAdvanced = $state(true);
    let isDashboardOpen = $state(false);
    let animationSession = $state(0);
    let innerWidth = $state(0);

    const modes = ["inspect", "visual", "heatmap"];
    let modeIndex = 0;

    let isEditMode = $state(false);
    let newNodeCoords = $state(null);
    let showAddNodeModal = $state(false);
    let newNodeData = $state({
        name: "",
        type: "solar",
        priority: 5,
        store: 0,
        prod: 100,
    });

    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    onMount(async () => {
        await init.run();
        optimize.run();
    });

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        init.setTheme(theme);
    }

    function setMode(newMode) {
        config.update((c) => ({ ...c, mode: newMode }));
        init.refresh();
    }

    function cycleMode() {
        modeIndex = (modeIndex + 1) % modes.length;
        setMode(modes[modeIndex]);
    }

    let optimizationResult = $state({ ledger: [], totalUnmet: 0 });

    function updateTime(type, val) {
        time.update((t) => {
            const next = { ...t, [type]: val };
            if (type === "month") {
                Object.values(data.loc).forEach((node) => {
                    const profiles = simulation.getHourlyProfiles(
                        node,
                        next.month,
                    );
                    node.prop.hourlyProd = profiles.prod;
                    node.prop.hourlyDem = profiles.dem;
                });
            }
            Object.values(data.loc).forEach((node) => {
                node.prop.prod = node.prop.hourlyProd[next.hour];
                node.prop.dem = node.prop.hourlyDem[next.hour];
            });
            if (get(activeData)) {
                lastProd = get(activeData).prop.prod;
                lastDem = get(activeData).prop.dem;
            }
            return next;
        });
        optimizationResult = optimize.run();
        init.refresh();
        if ($activeData) activeData.update((a) => ({ ...a }));
    }

    function toggleDashboard() {
        isDashboardOpen = !isDashboardOpen;
    }
    function closeDashboard() {
        isDashboardOpen = false;
    }

    async function runOptimization() {
        animationSession++;
        const currentSession = animationSession;
        optimizationResult = optimize.run();
        init.refresh();
        const currentLedger = get(ledger);
        if (currentLedger.length > 0) {
            activeIndex.set(-1);
            init.refresh();
            currentLedger.forEach((step, index) => {
                setTimeout(() => {
                    if (currentSession !== animationSession) return;
                    if (data.map && data.L) {
                        const renderer = new draw();
                        renderer.path(index);
                        activeIndex.set(index);
                    }
                }, 100 * index);
            });
        }
    }

    let currentExternal = $derived.by(() => {
        if (!$activeData) return 0;
        const curLedger = $ledger;
        if (curLedger.length === 0) return 0;
        let total = 0;
        const limit =
            $activeIndex === -1
                ? curLedger.length
                : $activeIndex === -2
                  ? 0
                  : $activeIndex + 1;
        for (let i = 0; i < limit; i++) {
            const step = curLedger[i];
            if (!step) continue;
            if (step.endid === $activeData.id) total += step.endenergy;
            if (step.startid === $activeData.id) total -= step.startenergy;
        }
        return total;
    });

    async function previousStep() {
        if ($activeIndex > 0) {
            activeIndex.set($activeIndex - 1);
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.path($activeIndex);
            }
        } else {
            activeIndex.set(-1);
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.drawLedger();
            }
        }
    }

    async function nextStep() {
        const currentLedger = get(ledger);
        if ($activeIndex < currentLedger.length - 1) {
            activeIndex.set($activeIndex + 1);
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.path($activeIndex);
            }
        }
    }

    let lastActiveId = $state(null);
    let lastProd = $state(0);
    let lastDem = $state(0);

    $effect(() => {
        if (!$activeData) {
            lastActiveId = null;
            return;
        }
        if ($activeData.id !== lastActiveId) {
            lastActiveId = $activeData.id;
            lastProd = $activeData.prop.prod;
            lastDem = $activeData.prop.dem;
            activeIndex.set(-2);
            init.refresh();
            return;
        }
        if (
            $activeData.prop.prod !== lastProd ||
            $activeData.prop.dem !== lastDem
        ) {
            lastProd = $activeData.prop.prod;
            lastDem = $activeData.prop.dem;
            optimizationResult = optimize.run();
            init.refresh();
        }
    });

    function toggleEditMode() {
        isEditMode = !isEditMode;
        if (isEditMode) {
            data.map.on("click", onMapClick);
            data.map.getContainer().style.cursor = "crosshair";
        } else {
            data.map.off("click", onMapClick);
            data.map.getContainer().style.cursor = "";
            showAddNodeModal = false;
        }
    }

    function onMapClick(e) {
        newNodeCoords = [e.latlng.lat, e.latlng.lng];
        showAddNodeModal = true;
        newNodeData.name = `New Node ${Object.keys(data.loc).length + 1}`;
    }

    function addNode() {
        const id = `loc_${Object.keys(data.loc).length}_added`;
        const val = newNodeData.prod;
        data.loc[id] = {
            id: id,
            pos: newNodeCoords,
            prop: {
                name: newNodeData.name,
                prod: val,
                dem: val,
                hourlyProd: Array(24).fill(val),
                hourlyDem: Array(24).fill(val),
                store: newNodeData.store,
                priority: newNodeData.priority,
                type: newNodeData.type,
            },
            neighbours: [],
        };
        data.loc[id].prop.hourlyProd[$time.hour] = newNodeData.prod;
        data.loc[id].prop.hourlyDem[$time.hour] = newNodeData.dem;
        init.createGrid();
        optimize.run();
        init.refresh();
        showAddNodeModal = false;
        newNodeCoords = null;
    }
</script>

<svelte:head>
    <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<svelte:window
    on:resize={() => (innerWidth = window.innerWidth)}
    on:load={() => (innerWidth = window.innerWidth)}
/>

<div id="map"></div>

{#if optimizationResult.totalUnmet > 0.1 && $config.mode === "inspect"}
    <div
        style="position: fixed; top: 100px; left: 50%; transform: translateX(-50%); background: #ff4444e6; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; z-index: 5000; box-shadow: var(--shadow); backdrop-filter: blur(10px); border: 2px solid white; display: flex; align-items: center; gap: 12px;"
    >
        <span style="font-size: 1.2rem;">⚠️</span>
        <div style="display: flex; flex-direction: column;">
            <span>INSUFFICIENT ENERGY GENERATION</span>
            <span style="font-size: 0.8rem; opacity: 0.9;"
                >Deficit: {Math.round(optimizationResult.totalUnmet)} MW across the
                network.</span
            >
        </div>
    </div>
{/if}

<Clock {months} {updateTime} />

<div id="ui">
    <button
        type="button"
        class="mode-badge"
        onclick={cycleMode}
        style="cursor: pointer;"
        aria-label="Cycle Mode"
    >
        Mode: {$config.mode === "inspect"
            ? "inspect"
            : $config.mode.toUpperCase()}
    </button>

    <Legend {innerWidth} />

    <MapControls
        {isEditMode}
        {toggleEditMode}
        {theme}
        {toggleTheme}
        {toggleDashboard}
    />

    <InspectPanel {isAdvanced} {currentExternal} />

    <Dashboard
        {isDashboardOpen}
        {closeDashboard}
        {isAdvanced}
        toggleAdvanced={() => (isAdvanced = !isAdvanced)}
        {setMode}
        {runOptimization}
    />

    <Timeline {previousStep} {nextStep} {runOptimization} />
</div>

<AddNodeModal
    {showAddNodeModal}
    {newNodeData}
    {addNode}
    closeAddNodeModal={() => (showAddNodeModal = false)}
/>
