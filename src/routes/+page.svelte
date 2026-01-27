<script>
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import { data, activeData, config, ledger, time } from "$lib/data.js";
    import { init } from "$lib/init.js";
    import { optimize } from "$lib/optamize.js";
    import { draw } from "$lib/draw.js";
    import { simulation } from "$lib/simulation.js";
    import "../lib/assets/global.css";

    let theme = $state("light");
    let isAdvanced = $state(true);
    let isDashboardOpen = $state(false);
    let activeIndex = $state(-1);

    const modes = ["inspect", "visual", "heatmap"];
    let modeIndex = 0;

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
    });

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        init.setTheme(theme);
    }

    function cycleMode() {
        modeIndex = (modeIndex + 1) % modes.length;
        const newMode = modes[modeIndex];
        config.update((c) => ({ ...c, mode: newMode }));
        init.refresh();
    }

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

            return next;
        });

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
        optimize.run();
        init.refresh();

        const currentLedger = get(ledger);
        if (currentLedger.length > 0) {
            activeIndex = -1;
            init.refresh();

            currentLedger.forEach((step, index) => {
                setTimeout(() => {
                    if (data.map && data.L) {
                        const renderer = new draw();
                        renderer.path(index);
                        activeIndex = index;
                    }
                }, 100 * index); // 0.1s delay between steps as requested
            });
        }
    }

    async function previousStep() {
        if (activeIndex > 0) {
            activeIndex--;
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.path(activeIndex);
            }
        } else {
            activeIndex = -1;
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.drawLedger(); // Show all paths when at beginning
            }
        }
    }

    async function nextStep() {
        const currentLedger = get(ledger);
        if (activeIndex < currentLedger.length - 1) {
            activeIndex++;
            if (data.map && data.L) {
                const renderer = new draw();
                renderer.path(activeIndex);
            }
        }
    }

    // Auto-optimize only when user manually changes prod/dem values, not when clicking nodes
    let lastProd = $state(0);
    let lastDem = $state(0);

    $effect(() => {
        // Only trigger optimization if the user manually changed values, not from node clicks
        if (
            $activeData &&
            ($activeData.prop.prod !== lastProd ||
                $activeData.prop.dem !== lastDem)
        ) {
            // Update tracking values
            lastProd = $activeData.prop.prod;
            lastDem = $activeData.prop.dem;

            // Only run optimization if values actually changed from user input
            optimize.run();
            init.refresh();
        }
    });
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

<div id="map"></div>

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
                oninput={(e) => updateTime("month", parseInt(e.target.value))}
            />
        </div>
        <div class="control-group">
            <span>Hour</span>
            <input
                type="range"
                min="0"
                max="23"
                value={$time.hour}
                oninput={(e) => updateTime("hour", parseInt(e.target.value))}
            />
        </div>
    </div>
</div>

<div id="ui">
    <button
        type="button"
        class="mode-badge"
        onclick={cycleMode}
        style="cursor: pointer;"
        aria-label="Cycle Mode"
    >
        Mode: {$config.mode.toUpperCase()}
    </button>

    <div id="dev">
        <button class="toggle" onclick={toggleTheme}>
            <div class="in">{theme === "light" ? "D" : "L"}</div>
        </button>
        <button class="toggle" onclick={toggleDashboard}>
            <div class="in">≡</div>
        </button>
    </div>

    <div id="drop">
        <button class="toggle" title="Settings">
            <div class="in">⚙</div>
        </button>
        <button class="toggle" title="Search">
            <div class="in">S</div>
        </button>
    </div>

    {#if $activeData}
        <div id="inspect">
            <div
                style="display: flex; justify-content: space-between; align-items: center;"
            >
                <div style="display: flex; flex-direction: column;">
                    <h2 id="name" style="margin: 0;">
                        {$activeData.name || "Location"}
                    </h2>
                    <span style="font-size: 0.8rem; opacity: 0.7;"
                        >{$activeData.prop.source_type.toUpperCase()} / {$activeData.prop.type.toUpperCase()}</span
                    >
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
                        </svg>
                        <div
                            style="display: flex; justify-content: space-between; font-size: 0.6rem; opacity: 0.6; margin-top: 5px;"
                        >
                            <span>00:00</span>
                            <span>12:00</span>
                            <span>23:00</span>
                        </div>
                        <div
                            style="display: flex; gap: 10px; font-size: 0.7rem; margin-top: 5px;"
                        >
                            <span style="color: #22c55e;"
                                >● PROD: {Math.round($activeData.prop.prod)} MW</span
                            >
                            <span style="color: #ef4444;"
                                >● DEM: {Math.round($activeData.prop.dem)} MW</span
                            >
                        </div>
                    </div>

                    <div class="inspect-row">
                        <label for="prod">Current Prod:</label>
                        <input
                            id="prod"
                            type="number"
                            bind:value={$activeData.prop.prod}
                        />
                    </div>
                    <div class="inspect-row">
                        <label for="dem">Current Demand:</label>
                        <input
                            id="dem"
                            type="number"
                            bind:value={$activeData.prop.dem}
                        />
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

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            onclick={cycleMode}
        >
            CYCLE MODE ({$config.mode})
        </button>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            onclick={runOptimization}
        >
            RUN OPTIMIZATION
        </button>

        <div style="margin-top: 20px;">
            <h4>Active Ledger ({$ledger.length})</h4>
            <div style="max-height: 40vh; overflow-y: auto;">
                {#each $ledger as step}
                    <div
                        style="font-size: 0.7rem; border-bottom: 1px solid #ccc; padding: 8px 0;"
                    >
                        <span style="font-weight: bold;">{step.startid}</span> →
                        <span style="font-weight: bold;">{step.endid}</span>
                        <div style="opacity: 0.7;">
                            Supply: {step.startenergy.toFixed(1)} MW (Loss applied)
                        </div>
                    </div>
                {:else}
                    <div style="opacity: 0.5; font-size: 0.8rem;">
                        No transfers recorded.
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <div id="timeline">
        <div class="step-indicator">
            {activeIndex === -1
                ? "OVERVIEW"
                : `STEP ${activeIndex + 1}/${$ledger.length} ⮕`}
            {#if activeIndex !== -1}
                <span
                    style="margin-left: 10px; font-size: 0.8rem; opacity: 0.7;"
                >
                    (Moving {activeIndex > 0 ? "Forward" : "Start"})
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
                <div class="in" style="width: 110px;">OPTIMIZE</div>
            </button>
            <button class="toggle" onclick={nextStep} title="Next Step">
                <div class="in">{">"}</div>
            </button>
        </div>
    </div>
</div>

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
</style>
