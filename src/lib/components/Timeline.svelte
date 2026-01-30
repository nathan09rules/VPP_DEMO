<script>
    import { activeIndex, ledger } from "$lib/data.js";

    let { previousStep, nextStep, runOptimization } = $props();
</script>

<div id="timeline">
    <div
        class="step-indicator"
        style="position: fixed; bottom: 20px; left: 10px;"
    >
        {$activeIndex === -1 || $activeIndex === -2
            ? "STEPS"
            : `${$activeIndex + 1}/${$ledger.length} `}
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
        <button
            class="timeline-btn"
            onclick={previousStep}
            title="Previous Step"
        >
            <div class="in">{"<"}</div>
        </button>
        <button
            class="timeline-btn"
            style="width: 120px;"
            onclick={runOptimization}
        >
            <div class="in" style="width: 110px;">PLAY</div>
        </button>
        <button class="timeline-btn" onclick={nextStep} title="Next Step">
            <div class="in">{">"}</div>
        </button>
    </div>
</div>
