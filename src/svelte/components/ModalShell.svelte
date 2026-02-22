<script lang="ts">
  export let title: string;
  export let wide = false;
  export let onClose: () => void;
</script>

<div class="sf2e-token-state-editor__modal-backdrop" on:pointerdown={onClose}>
  <section
    class={`sf2e-token-state-editor__modal${wide ? " sf2e-token-state-editor__modal--wide" : ""}`}
    on:pointerdown|stopPropagation
  >
    <header class="sf2e-token-state-editor__modal-header">
      <h1>{title}</h1>
    </header>

    <div class="sf2e-token-state-editor__modal-content">
      <slot />
    </div>
  </section>
</div>
