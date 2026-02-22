<script lang="ts">
  type NumericOperator = "<" | "<=" | ">" | ">=";
  type StatusOperator = "any-of" | "all-of";
  type UiCondition =
    | { type: "hp-percent"; operator: NumericOperator; value: number }
    | { type: "hp-value"; operator: NumericOperator; value: number }
    | { type: "in-combat"; value: boolean }
    | { type: "status-effect"; operator: StatusOperator; value: string[] };

  type SoundTriggerRuleConfig = {
    id: string;
    name: string;
    trigger: UiCondition;
    conditions: UiCondition[];
    src: string;
    volume: number;
  };

  export let row: SoundTriggerRuleConfig;
  export let index: number;
  export let conditionSummary: string;
  export let onNameInput: () => void;
  export let onOpenConditions: (index: number) => void;
  export let onOpenSound: (index: number) => void;
  export let onRemove: (index: number) => void;
  export let onDragStart: (event: DragEvent, index: number) => void;
  export let onDragOver: (event: DragEvent) => void;
  export let onDrop: (event: DragEvent, index: number) => void;
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
      <input type="text" value={conditionSummary} readonly />
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
      <input type="text" value={row.src} readonly />
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
