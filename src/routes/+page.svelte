<script>
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { data, activeData, config, ledger } from "$lib/data.js";
    import { init } from "$lib/init.js";
    import { optimize } from "$lib/optamize.js";
    import "../lib/assets/global.css";

    let theme = "light";
    let isAdvanced = true;
    let isDashboardOpen = false;
    let activeIndex = 0;

    const modes = ["inspect", "visual", "heatmap"];
    let modeIndex = 0;

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

    function toggleDashboard() {
        isDashboardOpen = !isDashboardOpen;
    }

    function closeDashboard() {
        isDashboardOpen = false;
    }

    async function runOptimization() {
        optimize.run();
        init.refresh();

        // Add delay back to optimization visualization
        const currentLedger = get(ledger);
        if (currentLedger.length > 0) {
            activeIndex = -1;
            init.refresh();

            currentLedger.forEach((step, index) => {
                setTimeout(async () => {
                    if (data.map && data.L) {
                        const { draw } = await import("$lib/draw.js");
                        const renderer = new draw();
                        renderer.path(index);
                        activeIndex = index;
                    }
                }, 500 * index); // 500ms delay between steps
            });
        }
    }

    async function previousStep() {
        if (activeIndex > 0) {
            activeIndex--;
            if (data.map && data.L) {
                const { draw } = await import("$lib/draw.js");
                const renderer = new draw();
                renderer.path(activeIndex);
            }
        } else {
            activeIndex = -1;
            if (data.map && data.L) {
                const { draw } = await import("$lib/draw.js");
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
                const { draw } = await import("$lib/draw.js");
                const renderer = new draw();
                renderer.path(activeIndex);
            }
        }
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

<div id="map"></div>

<div id="ui">
    <button
        type="button"
        class="mode-badge"
        on:click={cycleMode}
        style="cursor: pointer;"
        aria-label="Cycle Mode"
    >
        Mode: {$config.mode.toUpperCase()}
    </button>

    <div id="dev">
        <button class="toggle" on:click={toggleTheme}>
            <div class="in">{theme === "light" ? "D" : "L"}</div>
        </button>
        <button class="toggle" on:click={toggleDashboard}>
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
                <h2 id="name">{$activeData.name || "Location"}</h2>
                <button
                    on:click={() => activeData.set(null)}
                    style="border: none; background: none; cursor: pointer; font-family: inherit;"
                    >[X]</button
                >
            </div>
            <div id="subinspect">
                {#if !isAdvanced}
                    <div class="inspect-row">
                        <span class="label">Net Energy:</span>
                        <span
                            >{($activeData.prod - $activeData.dem).toFixed(2)} MW</span
                        >
                    </div>
                    <div class="inspect-row">
                        <span class="label">Storage:</span>
                        <span>{$activeData.store} MWh</span>
                    </div>
                {:else}
                    <div class="inspect-row">
                        <label for="prod">Production:</label>
                        <input
                            id="prod"
                            type="number"
                            bind:value={$activeData.prod}
                        />
                    </div>
                    <div class="inspect-row">
                        <label for="dem">Demand:</label>
                        <input
                            id="dem"
                            type="number"
                            bind:value={$activeData.dem}
                        />
                    </div>
                {/if}
                <div class="inspect-row">
                    <span class="label">Priority:</span>
                    <span>{$activeData.priority}</span>
                </div>
                <div class="inspect-row">
                    <span class="label">Type:</span>
                    <span style="text-transform: capitalize;"
                        >{$activeData.type}</span
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- Clickable overlay to close dashboard -->
    {#if isDashboardOpen}
        <button
            type="button"
            on:click={closeDashboard}
            style="position: fixed; inset: 0; z-index: 1001; pointer-events: auto;"
            aria-label="Close Dashboard"
        ></button>
    {/if}

    <div id="dashboard" class:open={isDashboardOpen} style="z-index: 2000;">
        <div
            style="display: flex; justify-content: space-between; align-items: center;"
        >
            <h3>Regional Controls</h3>
            <button
                on:click={closeDashboard}
                style="border: none; background: none; cursor: pointer; font-size: 1.5rem;"
                >×</button
            >
        </div>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            on:click={() => {
                isAdvanced = !isAdvanced;
            }}
        >
            {isAdvanced ? "Switch to Simple" : "Switch to Advanced"}
        </button>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            on:click={cycleMode}
        >
            CYCLE MODE ({$config.mode})
        </button>

        <button
            class="search-btn"
            style="position: static; transform: none; width: 100%;"
            on:click={runOptimization}
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
        <button class="toggle" on:click={previousStep}
            ><div class="in">{"<"}</div></button
        >
        <button class="toggle" style="width: 100px;" on:click={runOptimization}
            ><div class="in" style="width: 90px;">OPTIMIZE</div></button
        >
        <button class="toggle" on:click={nextStep}
            ><div class="in">{">"}</div></button
        >
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
</style>
