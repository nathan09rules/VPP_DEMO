<script>
    import { config, activeData } from "$lib/data.js";

    let { innerWidth } = $props();
</script>

{#if !$activeData || innerWidth > 900}
    <div id="map-legend">
        <div class="legend-title">
            LEGEND: {$config.mode.toUpperCase()}
        </div>

        {#if $config.mode === "heatmap"}
            <div class="legend-item">
                <div class="color-box" style="background: #4444ff;"></div>
                <span>Surplus (MW)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #ff4444;"></div>
                <span>Deficit (MW)</span>
            </div>
            <div class="legend-item small-text">
                <span>* Intensity varies with scale</span>
            </div>
        {:else if $config.mode === "visual"}
            <div class="legend-item">
                <div class="color-circle" style="background: #FFD700;"></div>
                <span>Power Plant</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #00BFFF;"></div>
                <span>Police Station</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #FF0000;"></div>
                <span>Hospital</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #2E8B57;"></div>
                <span>Financial</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #9370DB;"></div>
                <span>University</span>
            </div>
            <div class="legend-item">
                <div class="color-line"></div>
                <span>Sub-lines</span>
            </div>
        {:else}
            <div class="legend-item">
                <div class="color-circle" style="background: #2ecc71;"></div>
                <span>Renewable Surplus</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #e74c3c;"></div>
                <span>Non-Renewable Surplus</span>
            </div>
            <div class="legend-item">
                <div class="color-circle" style="background: #ca794eff;"></div>
                <span>Power Deficit</span>
            </div>
            <div class="legend-item">
                <div
                    class="color-box"
                    style="background: #2ecc71; height: 2px;"
                ></div>
                <span>Renewable inspect</span>
            </div>
            <div class="legend-item">
                <div
                    class="color-box"
                    style="background: #e74c3c; height: 2px;"
                ></div>
                <span>Non-Renewable inspect</span>
            </div>
        {/if}
    </div>
{/if}
