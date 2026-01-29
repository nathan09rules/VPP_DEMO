<script>
    import { config, ledger } from "$lib/data.js";
    import {
        getTotalEnergy,
        getRenewableEnergy,
        getNonRenewableEnergy,
    } from "$lib/utils.js";

    let {
        isDashboardOpen,
        closeDashboard,
        isAdvanced,
        toggleAdvanced,
        setMode,
        runOptimization,
    } = $props();
</script>

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
            style="border: none; background: none; cursor: pointer; font-size: 1.5rem; color: var(--primary-text);"
            >×</button
        >
    </div>

    <button
        class="search-btn"
        style="position: static; transform: none; width: 100%;"
        onclick={toggleAdvanced}
    >
        {isAdvanced ? "Switch to Simple" : "Switch to Advanced"}
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
