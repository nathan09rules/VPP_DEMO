<script>
    let { showAddNodeModal, newNodeData, addNode, closeAddNodeModal } =
        $props();
</script>

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
                <button class="search-btn" onclick={closeAddNodeModal}
                    >Cancel</button
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
