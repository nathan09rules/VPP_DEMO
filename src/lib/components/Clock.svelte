<script>
    import { config, time } from "$lib/data.js";

    let { months, updateTime } = $props();
</script>

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
