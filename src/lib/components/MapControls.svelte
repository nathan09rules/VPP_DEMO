<script>
    let { isEditMode, toggleEditMode, theme, toggleTheme, toggleDashboard } =
        $props();
</script>

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
