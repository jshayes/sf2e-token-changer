<script lang="ts">
  import type { SoundTriggerRuleConfig } from "../helpers/editor-types";
  import type { UiCondition } from "../helpers/conditions";
  import { soundConditionSummary } from "../helpers/conditions";

  export let row: SoundTriggerRuleConfig;
  export let index: number;
  export let showValidation = false;
  export let onNameInput: () => void;
  export let onOpenConditions: (index: number) => void;
  export let onOpenSound: (index: number) => void;
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

  function hasStatusErrors(row: SoundTriggerRuleConfig): boolean {
    return (
      (row.trigger.type === "status-effect" && row.trigger.value.length === 0) ||
      hasEmptyStatusEffectCondition(row.conditions)
    );
  }

  $: hasConditionError = showValidation && hasStatusErrors(row);
  $: hasSoundError = showValidation && !row.src.trim();
</script>

<article
  class="sf2e-token-state-editor__row"
  data-list="sounds"
  data-index={index}
  on:dragover={onDragOver}
  on:drop={(e) => onDrop(e, index)}
>
  <div class="sf2e-token-state-editor__row-toolbar">
    <button
      type="button"
      draggable="true"
      title="Drag priority"
      on:dragstart={(e) => onDragStart(e, index)}
    >☰</button>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--type">
    <label>Name</label>
    <div class="form-fields">
      <input type="text" bind:value={row.name} placeholder="e.g. Condition Applied In Combat" on:input={onNameInput} />
    </div>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--condition">
    <label>Conditions</label>
    <div class="form-fields">
      <input
        type="text"
        readonly
        value={hasConditionError ? "Status-effect trigger/conditions must select at least one status." : soundConditionSummary(row.trigger, row.conditions)}
        class:sf2e-token-state-editor__input-error={hasConditionError}
      />
      <button
        type="button"
        class="sf2e-token-state-editor__icon-button"
        on:click={() => onOpenConditions(index)}
        title="Configure trigger and conditions"
      >
        <i class="fa-solid fa-gear"></i>
      </button>
    </div>
  </div>

  <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
    <label>Sound</label>
    <div class="form-fields">
      <input
        type="text"
        readonly
        value={hasSoundError ? "Sound is required." : row.src}
        class:sf2e-token-state-editor__input-error={hasSoundError}
      />
      <button
        type="button"
        class="sf2e-token-state-editor__icon-button"
        on:click={() => onOpenSound(index)}
        title="Configure sound"
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

</article>
