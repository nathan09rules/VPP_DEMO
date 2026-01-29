<script>
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
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
        // Populate ledger on mount
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

    function getHeatmapLegend() {
        if ($config.mode !== "heatmap") return null;
        return {
            surplus: "Blue areas indicate energy surplus (production > demand)",
            deficit: "Red areas indicate energy deficit (demand > production)",
            intensity:
                "Color intensity represents the magnitude of surplus/deficit",
        };
    }

    let optimizationResult = $state({ ledger: [], totalUnmet: 0 });

    function updateTime(type, val) {
        time.update((t) => {
            const next = { ...t, [type]: val };

            // If month changed, we need to recalculate all profiles
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

            // Sync current hour's prod/dem
            Object.values(data.loc).forEach((node) => {
                node.prop.prod = node.prop.hourlyProd[next.hour];
                node.prop.dem = node.prop.hourlyDem[next.hour];
            });

            // Update fast tracking values so effect doesn't trigger "manual" optimization
            if (get(activeData)) {
                lastProd = get(activeData).prop.prod;
                lastDem = get(activeData).prop.dem;
            }

            return next;
        });

        // Run optimization to update math (ledger) but don't change view mode
        optimizationResult = optimize.run();

        // Refresh visualization
        init.refresh();

        // If we have an active node, trigger a refresh of its data
        if ($activeData) {
            activeData.update((a) => ({ ...a }));
        }
    }

    function getGraphPath(dataPoints, width, height, maxVal) {
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

    function toggleDashboard() {
        isDashboardOpen = !isDashboardOpen;
    }

    function closeDashboard() {
        isDashboardOpen = false;
    }

    async function runOptimization() {
        // Cancel any existing animation
        animationSession++;
        const currentSession = animationSession;

        // Run optimization to populate ledger
        optimizationResult = optimize.run();
        init.refresh();

        const currentLedger = get(ledger);
        if (currentLedger.length > 0) {
            activeIndex.set(-1);
            init.refresh();

            currentLedger.forEach((step, index) => {
                setTimeout(() => {
                    // Only continue if this is still the active session
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

    function getTotalEnergy() {
        const currentLedger = get(ledger);
        return currentLedger.reduce(
            (total, step) => total + step.startenergy,
            0,
        );
    }

    function getRenewableEnergy() {
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
                if (renewableTypes.includes(sourceNode.prop.type)) {
                    return total + step.startenergy;
                }
            }
            return total;
        }, 0);
    }

    function getNonRenewableEnergy() {
        const currentLedger = get(ledger);
        const nonRenewableTypes = ["coal", "gas", "oil", "nuclear", "thermal"];
        return currentLedger.reduce((total, step) => {
            const sourceNode = data.loc[step.startid];
            if (sourceNode) {
                if (nonRenewableTypes.includes(sourceNode.prop.type)) {
                    return total + step.startenergy;
                }
            }
            return total;
        }, 0);
    }

    let currentExternal = $derived.by(() => {
        if (!$activeData) return 0;
        // If we are in overview mode (-1 or -2) or looking at a specific step
        // We calculate the inspect for the active node based on the LEDGER steps up to the active index
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
            if (step.endid === $activeData.id) {
                total += step.endenergy;
            }
            if (step.startid === $activeData.id) {
                total -= step.startenergy;
            }
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
                renderer.drawLedger(); // Show all paths when at beginning
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

    // Auto-optimize only when user manually changes prod/dem values, not when clicking nodes
    let lastActiveId = $state(null);
    let lastProd = $state(0);
    let lastDem = $state(0);

    $effect(() => {
        if (!$activeData) {
            lastActiveId = null;
            return;
        }

        // If we just clicked/switched to a new node, don't re-optimize.
        // Also clear paths to focus on the node name/details as requested.
        if ($activeData.id !== lastActiveId) {
            lastActiveId = $activeData.id;
            lastProd = $activeData.prop.prod;
            lastDem = $activeData.prop.dem;

            activeIndex.set(-2); // Hidden mode
            init.refresh();
            return;
        }

        // If it's the same node but values were manually changed, then optimize
        if (
            $activeData.prop.prod !== lastProd ||
            $activeData.prop.dem !== lastDem
        ) {
            lastProd = $activeData.prop.prod;
            lastDem = $activeData.prop.dem;
            optimizationResult = optimize.run();
            // Refresh visualization with updated math but keep current view state
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

        // Ensure the current hour specifically matches the user's manual input
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

{#if $config.mode === "visual"}
    <div id="clock-container">
        <div class="clock-title">
            TIME CONTROL - {months[$time.month]}
            {$time.day}, {$time.hour}:00
        </div>
        <div class="clock-controls">
            <div class="control-group">
                <span>Month</span>
                <input
                    type="range"
                    min="0"
                    max="11"
                    value={$time.month}
                    oninput={(e) =>
                        updateTime("month", parseInt(e.target.value))}
                />
            </div>
            <div class="control-group">
                <span>Hour</span>
                <input
                    type="range"
                    min="0"
                    max="23"
                    value={$time.hour}
                    oninput={(e) =>
                        updateTime("hour", parseInt(e.target.value))}
                />
            </div>
        </div>
    </div>
{/if}

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

    <!-- Map Legend -->
    {#if !$activeData || innerWidth > 900}
        <div
            id="map-legend"
            style="
            position: fixed; 
            bottom: 90px; 
            right: 20px; 
            background: var(--glass-bg); 
            opacity: 0.8;
            border: 2px solid var(--border-color); 
            border-radius: 8px; 
            padding: 12px; 
            box-shadow: var(--shadow); 
            font-size: 0.75rem;
            pointer-events: auto;
            z-index: 100;
            min-width: 140px;
            backdrop-filter: blur(10px);
        "
        >
            <div
                style="font-weight: bold; margin-bottom: 8px; text-align: center; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;"
            >
                LEGEND: {$config.mode.toUpperCase()}
            </div>

            {#if $config.mode === "heatmap"}
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #4444ff; border-radius: 3px;"
                        ></div>
                        <span>Surplus (MW)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #ff4444; border-radius: 3px;"
                        ></div>
                        <span>Deficit (MW)</span>
                    </div>
                    <div
                        style="display: flex; align-items: center; gap: 8px; opacity: 0.7; font-size: 0.6rem; margin-top: 4px;"
                    >
                        <span>* Intensity varies with scale</span>
                    </div>
                </div>
            {:else if $config.mode === "visual"}
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #FFD700; border-radius: 50%;"
                        ></div>
                        <span>Power Plant</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #00BFFF; border-radius: 50%;"
                        ></div>
                        <span>Police Station</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #FF0000; border-radius: 50%;"
                        ></div>
                        <span>Hospital</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #2E8B57; border-radius: 50%;"
                        ></div>
                        <span>Financial</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #9370DB; border-radius: 50%;"
                        ></div>
                        <span>University</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; border: 2px dashed #666; height: 0; width: 14px;"
                        ></div>
                        <span>Sub-lines</span>
                    </div>
                </div>
            {:else}
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #2ecc71; border-radius: 50%;"
                        ></div>
                        <span>Renewable Surplus</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #e74c3c; border-radius: 50%;"
                        ></div>
                        <span>Non-Renewable Surplus</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #ca794eff; border-radius: 50%;"
                        ></div>
                        <span>Power Deficit</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #2ecc71; height: 2px;"
                        ></div>
                        <span>Renewable inspect</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div
                            style="width: 12px; height: 12px; background: #e74c3c; height: 2px;"
                        ></div>
                        <span>Non-Renewable inspect</span>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <div id="dev">
        <button
            class="toggle"
            class:active={isEditMode}
            onclick={toggleEditMode}
            title="Toggle Edit Mode"
        >
            <div class="in">{isEditMode ? "✓" : "+"}</div>
        </button>
        <button class="toggle" onclick={toggleTheme}>
            <div class="in">{theme === "light" ? "D" : "L"}</div>
        </button>
        <button class="toggle" onclick={toggleDashboard}>
            <div class="in">≡</div>
        </button>
    </div>

    {#if $activeData}
        <div id="inspect">
            <div
                style="display: flex; justify-content: space-between; align-items: center;"
            >
                <div style="display: flex; flex-direction: column;">
                    <h2 id="name" style="margin: 0;">
                        {$activeData.prop.name || "Location"}
                    </h2>
                    <span style="font-size: 0.8rem; opacity: 0.7;">
                        {[
                            "solar",
                            "wind",
                            "hydro",
                            "nuclear",
                            "gas",
                            "coal",
                            "oil",
                            "thermal",
                            "biomass",
                            "geothermal",
                        ].includes($activeData.prop.type)
                            ? "POWER PLANT"
                            : $activeData.prop.type.toUpperCase()}
                    </span>
                </div>
                <button
                    onclick={() => activeData.set(null)}
                    style="border: none; background: none; cursor: pointer; font-family: inherit;"
                    >[X]</button
                >
            </div>
            <div id="subinspect">
                {#if !isAdvanced}
                    <div class="inspect-row">
                        <span class="label">Net Energy:</span>
                        <span
                            >{(
                                $activeData.prop.prod - $activeData.prop.dem
                            ).toFixed(2)} MW</span
                        >
                    </div>
                {:else}
                    <div class="graph-container">
                        <svg
                            width="100%"
                            height="80"
                            viewBox="0 0 300 100"
                            preserveAspectRatio="none"
                        >
                            <!-- Background Grid -->
                            <line
                                x1="0"
                                y1="50"
                                x2="300"
                                y2="50"
                                stroke="var(--border-color)"
                                stroke-dasharray="2"
                                opacity="0.3"
                            />

                            <!-- Prod Line -->
                            <path
                                d={getGraphPath(
                                    $activeData.prop.hourlyProd,
                                    300,
                                    100,
                                    Math.max(
                                        ...$activeData.prop.hourlyProd,
                                        ...$activeData.prop.hourlyDem,
                                    ),
                                )}
                                fill="none"
                                stroke="#22c55e"
                                stroke-width="2"
                            />
                            <!-- Dem Line -->
                            <path
                                d={getGraphPath(
                                    $activeData.prop.hourlyDem,
                                    300,
                                    100,
                                    Math.max(
                                        ...$activeData.prop.hourlyProd,
                                        ...$activeData.prop.hourlyDem,
                                    ),
                                )}
                                fill="none"
                                stroke="#ef4444"
                                stroke-width="2"
                            />

                            <!-- Current Time Indicator -->
                            <line
                                x1={($time.hour / 23) * 300}
                                y1="0"
                                x2={($time.hour / 23) * 300}
                                y2="100"
                                stroke="var(--border-color)"
                                stroke-width="1"
                                stroke-dasharray="2,2"
                                opacity="0.5"
                            />

                            <!-- Prod Marker & Line -->
                            <line
                                x1="0"
                                y1={100 -
                                    $activeData.prop.prod *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                x2={($time.hour / 23) * 300}
                                y2={100 -
                                    $activeData.prop.prod *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                stroke="#22c55e"
                                stroke-width="0.5"
                                stroke-dasharray="2,2"
                                opacity="0.5"
                            />
                            <circle
                                cx={($time.hour / 23) * 300}
                                cy={100 -
                                    $activeData.prop.prod *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                r="4"
                                fill="#22c55e"
                                stroke="white"
                                stroke-width="1"
                            />

                            <!-- Dem Marker & Line -->
                            <line
                                x1="0"
                                y1={100 -
                                    $activeData.prop.dem *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                x2={($time.hour / 23) * 300}
                                y2={100 -
                                    $activeData.prop.dem *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                stroke="#ef4444"
                                stroke-width="0.5"
                                stroke-dasharray="2,2"
                                opacity="0.5"
                            />
                            <circle
                                cx={($time.hour / 23) * 300}
                                cy={100 -
                                    $activeData.prop.dem *
                                        (100 /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            ))}
                                r="4"
                                fill="#ef4444"
                                stroke="white"
                                stroke-width="1"
                            />

                            <!-- External inspect Indicator -->
                            {#if currentExternal !== 0}
                                <rect
                                    x={($time.hour / 23) * 300 - 5}
                                    y={currentExternal > 0
                                        ? 50 -
                                          Math.min(
                                              45,
                                              (currentExternal /
                                                  Math.max(
                                                      ...$activeData.prop
                                                          .hourlyProd,
                                                      ...$activeData.prop
                                                          .hourlyDem,
                                                      1,
                                                  )) *
                                                  50,
                                          )
                                        : 50}
                                    width="10"
                                    height={Math.abs(
                                        (currentExternal /
                                            Math.max(
                                                ...$activeData.prop.hourlyProd,
                                                ...$activeData.prop.hourlyDem,
                                                1,
                                            )) *
                                            50,
                                    )}
                                    fill={currentExternal > 0
                                        ? "#00BFFF"
                                        : "#FFD700"}
                                    opacity="0.8"
                                />
                            {/if}
                        </svg>
                        <div
                            style="display: flex; justify-content: space-between; font-size: 0.6rem; opacity: 0.6; margin-top: 5px;"
                        >
                            <span>00:00</span>
                            <span>12:00</span>
                            <span>23:00</span>
                        </div>
                        <div
                            style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.7rem; margin-top: 5px;"
                        >
                            <span style="color: #22c55e;"
                                >● PROD: {Math.round($activeData.prop.prod)} MW</span
                            >
                            <span style="color: #ef4444;"
                                >● DEM: {Math.round($activeData.prop.dem)} MW</span
                            >
                            {#if currentExternal !== 0}
                                <span style="color: #00BFFF;"
                                    >● GRID: {currentExternal > 0
                                        ? "+"
                                        : ""}{Math.round(currentExternal)} MW</span
                                >
                            {/if}
                        </div>
                    </div>

                    <div class="inspect-row">
                        <label for="prod">Base Prod:</label>
                        <input
                            id="prod"
                            type="number"
                            bind:value={$activeData.prop.prod}
                        />
                    </div>
                    <div class="inspect-row">
                        <label for="dem">Base Demand:</label>
                        <input
                            id="dem"
                            type="number"
                            bind:value={$activeData.prop.dem}
                        />
                    </div>
                    <div
                        class="inspect-row"
                        style="color: #00BFFF; font-weight: bold;"
                    >
                        <span>External Grid:</span>
                        <span>{Math.round(currentExternal)} MW</span>
                    </div>
                {/if}
                <div class="inspect-row">
                    <span class="label">Priority:</span>
                    <span>{$activeData.prop.priority}</span>
                </div>
                <div class="inspect-row">
                    <span class="label">Storage:</span>
                    <span>{$activeData.prop.store} MWh</span>
                </div>
            </div>
        </div>
    {/if}

    <!-- Clickable overlay to close dashboard - only covers non-map areas -->
    {#if isDashboardOpen}
        <button
            type="button"
            onclick={closeDashboard}
            style="position: fixed; top: 0; left: 0; right: 400px; bottom: 0; z-index: 1001; pointer-events: auto; background: transparent; border: none;"
            aria-label="Close Dashboard"
        ></button>
    {/if}

    <div id="dashboard" class:open={isDashboardOpen} style="z-index: 2000;">
        <div
            style="display: flex; justify-content: space-between; align-items: center;"
        >
            <h3>Regional Controls</h3>
            <button
                onclick={closeDashboard}
                style="border: none; background: none; cursor: pointer; font-size: 1.5rem;"
                >×</button
            >
        </div>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            onclick={() => {
                isAdvanced = !isAdvanced;
            }}
        >
            {isAdvanced ? "Switch to Simple" : "Switch to Advanced"}
        </button>

        <div
            style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;"
        >
            <button
                class="search-btn"
                style="position: static; transform: none; width: 100%; margin: 0; background: {$config.mode ===
                'inspect'
                    ? 'var(--border-color)'
                    : 'var(--primary-bg)'}; color: {$config.mode === 'inspect'
                    ? 'var(--primary-bg)'
                    : 'var(--primary-text)'};"
                onclick={() => setMode("inspect")}
            >
                NORMAL inspect MODE
            </button>
            <div style="display: flex; gap: 8px;">
                <button
                    class="search-btn"
                    style="position: static; transform: none; width: 50%; margin: 0; font-size: 0.7rem; background: {$config.mode ===
                    'visual'
                        ? 'var(--border-color)'
                        : 'var(--primary-bg)'}; color: {$config.mode ===
                    'visual'
                        ? 'var(--primary-bg)'
                        : 'var(--primary-text)'};"
                    onclick={() => setMode("visual")}
                >
                    THEMATIC
                </button>
                <button
                    class="search-btn"
                    style="position: static; transform: none; width: 50%; margin: 0; font-size: 0.7rem; background: {$config.mode ===
                    'heatmap'
                        ? 'var(--border-color)'
                        : 'var(--primary-bg)'}; color: {$config.mode ===
                    'heatmap'
                        ? 'var(--primary-bg)'
                        : 'var(--primary-text)'};"
                    onclick={() => setMode("heatmap")}
                >
                    HEATMAP
                </button>
            </div>
        </div>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            onclick={runOptimization}
        >
            RUN OPTIMIZATION
        </button>

        <div style="margin-top: 20px;">
            <h4>Active Ledger ({$ledger.length})</h4>
            <div style="max-height: 25vh; overflow-y: auto;">
                {#each $ledger as step}
                    <div
                        style="font-size: 0.7rem; border-bottom: 1px solid #ccc; padding: 8px 0;"
                    >
                        <span style="font-weight: bold;">{step.startid}</span> →
                        <span style="font-weight: bold;">{step.endid}</span>
                        <div style="opacity: 0.7;">
                            Supply: {step.startenergy.toFixed(1)} MW
                        </div>
                    </div>
                {:else}
                    <div style="opacity: 0.5; font-size: 0.8rem;">
                        No transfers recorded.
                    </div>
                {/each}
            </div>
        </div>

        {#if $ledger.length > 0}
            <div
                style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;"
            >
                <h4>Energy Summary</h4>
                <div style="gap: 10px; font-size: 0.8rem;">
                    <div>
                        <span style="font-weight: bold;">Total:</span>
                        <span style="float: right;"
                            >{getTotalEnergy().toFixed(1)} MW</span
                        >
                    </div>
                    <div>
                        <span style="font-weight: bold; color: #22c55e;"
                            >Renewable:</span
                        >
                        <span style="float: right;"
                            >{getRenewableEnergy().toFixed(1)} MW</span
                        >
                    </div>
                    <div>
                        <span style="font-weight: bold; color: #ef4444;"
                            >Non-Renewable:</span
                        >
                        <span style="float: right;"
                            >{getNonRenewableEnergy().toFixed(1)} MW</span
                        >
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <div id="timeline">
        <div
            class="step-indicator"
            style="position: fixed; bottom: 20px; left: 10px;"
        >
            {$activeIndex === -1 || $activeIndex === -2
                ? "STEPS"
                : `${$activeIndex + 1}/${$ledger.length} `}
            {#if $activeIndex >= 0}
                <span
                    style="margin-left: 10px; font-size: 0.8rem; opacity: 0.7; "
                >
                </span>
            {/if}
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <button class="toggle" onclick={previousStep} title="Previous Step">
                <div class="in">{"<"}</div>
            </button>
            <button
                class="toggle"
                style="width: 120px;"
                onclick={runOptimization}
            >
                <div class="in" style="width: 110px;">PLAY</div>
            </button>
            <button class="toggle" onclick={nextStep} title="Next Step">
                <div class="in">{">"}</div>
            </button>
        </div>
    </div>
</div>

{#if showAddNodeModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Add New Node</h3>
            <div class="inspect-row">
                <label for="new-name">Name:</label>
                <input
                    id="new-name"
                    type="text"
                    bind:value={newNodeData.name}
                />
            </div>
            <div class="inspect-row">
                <label for="new-type">Type:</label>
                <select id="new-type" bind:value={newNodeData.type}>
                    <optgroup label="Energy Sources">
                        <option value="solar">Solar Farm</option>
                        <option value="wind">Wind Farm</option>
                        <option value="hydro">Hydro Plant</option>
                        <option value="nuclear">Nuclear Plant</option>
                        <option value="gas">Gas Station</option>
                        <option value="coal">Coal Plant</option>
                        <option value="thermal">Thermal Plant</option>
                    </optgroup>
                    <optgroup label="Infrastructure">
                        <option value="hospital">Hospital</option>
                        <option value="police">Police Station</option>
                        <option value="university">University</option>
                        <option value="bank">Financial</option>
                    </optgroup>
                </select>
            </div>
            <div class="inspect-row">
                <label for="new-prod">Base Value (MW):</label>
                <input
                    id="new-prod"
                    type="number"
                    bind:value={newNodeData.prod}
                />
            </div>
            <div class="inspect-row">
                <label for="new-store">Storage (MWh):</label>
                <input
                    id="new-store"
                    type="number"
                    bind:value={newNodeData.store}
                />
            </div>
            <div class="inspect-row">
                <label for="new-priority">Priority (1-10):</label>
                <input
                    id="new-priority"
                    type="number"
                    min="1"
                    max="10"
                    bind:value={newNodeData.priority}
                />
            </div>
            <div class="modal-actions">
                <button
                    class="search-btn"
                    onclick={() => (showAddNodeModal = false)}>Cancel</button
                >
                <button
                    class="search-btn"
                    style="background: #2ecc71; color: white;"
                    onclick={addNode}>Add Node</button
                >
            </div>
        </div>
    </div>
{/if}

<style>
    :global(body) {
        margin: 0;
        padding: 0;
    }

    #ui {
        pointer-events: none;
    }

    #ui > * {
        pointer-events: auto;
    }

    .step-indicator {
        background: var(--border-color);
        color: var(--primary-bg);
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: bold;
        box-shadow: var(--shadow);
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        backdrop-filter: blur(5px);
    }

    .modal-content {
        background: var(--glass-bg);
        border: 2px solid var(--border-color);
        border-radius: 12px;
        padding: 20px;
        width: 350px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(20px);
        color: var(--text-color);
    }

    .modal-content h3 {
        margin-top: 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        margin-bottom: 20px;
    }

    .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
    }

    .toggle.active {
        background: #2ecc71;
        border-color: #27ae60;
    }

    .toggle.active .in {
        color: white;
    }
</style>
