<script lang="ts">
  import ModalShell from "./ModalShell.svelte";
  import type { SoundConfigModalState } from "../helpers/editor-types";

  export let modal: SoundConfigModalState;
  export let onClose: () => void;
  export let onBrowse: () => void;
  export let onSave: () => void;
</script>

<ModalShell title="Configure Sound" onClose={onClose}>
  <div class="form-group">
    <label>Sound Path</label>
    <div class="form-fields">
      <input type="text" bind:value={modal.src} />
      <button type="button" on:click={onBrowse}>Browse</button>
    </div>
  </div>

  <div class="form-group">
    <label>Volume</label>
    <div class="form-fields">
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        bind:value={modal.volume}
        on:input={(e) => (modal = { ...modal, volume: Number((e.currentTarget as HTMLInputElement).value) })}
      />
      <input
        type="number"
        min="0"
        max="1"
        step="0.05"
        bind:value={modal.volume}
        on:input={(e) => (modal = { ...modal, volume: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    </div>
  </div>

  <footer class="sf2e-token-state-editor__modal-footer">
    <button type="button" on:click={onSave}>Save Configuration</button>
    <button type="button" on:click={onClose}>Cancel</button>
  </footer>
</ModalShell>
