<script>
    import { activeData, time, activeIndex, ledger } from "$lib/data.js";
    import { getGraphPath } from "$lib/utils.js";

    let { isAdvanced, currentExternal } = $props();

    const energyTypes = [
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
    ];
</script>

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
                    {energyTypes.includes($activeData.prop.type)
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
                                                  ...$activeData.prop.hourlyDem,
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
