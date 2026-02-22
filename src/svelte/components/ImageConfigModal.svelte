<script lang="ts">
  import ModalShell from "./ModalShell.svelte";
  import type { ImageConfigModalState } from "../helpers/editor-types";

  export let modal: ImageConfigModalState;
  export let onClose: () => void;
  export let onBrowse: () => void;
  export let onSave: () => void;
</script>

<ModalShell title="Configure Image" onClose={onClose}>
  <div class="form-group">
    <label>Image Path</label>
    <div class="form-fields">
      <input type="text" bind:value={modal.image} />
      <button type="button" on:click={onBrowse}>Browse</button>
    </div>
  </div>

  <div class="form-group">
    <label>Scale</label>
    <div class="form-fields">
      <input
        type="range"
        min="0.1"
        max="3"
        step="0.05"
        bind:value={modal.scale}
        on:input={(e) => (modal = { ...modal, scale: Number((e.currentTarget as HTMLInputElement).value) })}
      />
      <input
        type="number"
        min="0.1"
        max="3"
        step="0.05"
        bind:value={modal.scale}
        on:input={(e) => (modal = { ...modal, scale: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    </div>
  </div>

  <footer class="sf2e-token-state-editor__modal-footer">
    <button type="button" on:click={onSave}>Save Configuration</button>
    <button type="button" on:click={onClose}>Cancel</button>
  </footer>
</ModalShell>
