<script lang="ts">
  import type { TokenStateImageRuleConfig } from "../helpers/editor-types";
  import type { UiCondition } from "../helpers/conditions";
  import { tokenStateConditionsSummary } from "../helpers/conditions";

  export let row: TokenStateImageRuleConfig;
  export let index: number;
  export let showValidation = false;
  export let onNameInput: () => void;
  export let onOpenConditions: (index: number) => void;
  export let onOpenImage: (index: number) => void;
  export let onRemove: (index: number) => void;
  export let onDragStart: (event: DragEvent, index: number) => void;
  export let onDragOver: (event: DragEvent) => void;
  export let onDrop: (event: DragEvent, index: number) => void;

  function hasEmptyStatusEffectCondition(conditions: UiCondition[]): boolean {
    return conditions.some(
      (condition) =>
        condition.type === "status-effect" && condition.value.length === 0,
    );
  }
</script>

<article
  class="sf2e-token-state-editor__row"
  data-list="tokenStates"
  data-index={index}
  on:dragover={onDragOver}
  on:drop={(e) => onDrop(e, index)}
>
  <div class="sf2e-token-state-editor__row-toolbar">
    <button
      type="button"
      draggable="true"
      data-action="drag-handle"
      title="Drag priority"
      on:dragstart={(e) => onDragStart(e, index)}
    >☰</button>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--type">
    <label>Name</label>
    <div class="form-fields">
      <input type="text" bind:value={row.name} placeholder="e.g. Bloodied In Combat" on:input={onNameInput} />
    </div>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--condition">
    <label>Conditions</label>
    <div class="form-fields">
      <input type="text" value={tokenStateConditionsSummary(row.conditions)} readonly />
      <button
        type="button"
        class="sf2e-token-state-editor__icon-button"
        on:click={() => onOpenConditions(index)}
        title="Configure conditions"
      >
        <i class="fa-solid fa-gear"></i>
      </button>
    </div>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
    <label>Image</label>
    <div class="form-fields">
      <input type="text" value={row.image} readonly />
      <button
        type="button"
        class="sf2e-token-state-editor__icon-button"
        on:click={() => onOpenImage(index)}
        title="Configure image"
      >
        <i class="fa-solid fa-gear"></i>
      </button>
    </div>
  </div>

  <div class="sf2e-token-state-editor__cell sf2e-token-state-editor__cell--actions">
    <button
      type="button"
      class="sf2e-token-state-editor__icon-button"
      title="Remove row"
      on:click={() => onRemove(index)}
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  </div>

  {#if showValidation && (!row.image.trim() || hasEmptyStatusEffectCondition(row.conditions))}
    <div class="sf2e-token-state-editor__row-error">
      {#if !row.image.trim()}
        <span class="sf2e-token-state-editor__field-error">Image is required.</span>
      {/if}
      {#if hasEmptyStatusEffectCondition(row.conditions)}
        <span class="sf2e-token-state-editor__field-error">Status-effect conditions must select at least one status.</span>
      {/if}
    </div>
  {/if}
</article>
