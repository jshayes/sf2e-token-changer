<script lang="ts">
  import ConditionConfigFields from "./ConditionConfigFields.svelte";
  import ModalShell from "./ModalShell.svelte";
  import { defaultCondition } from "../helpers/conditions";
  import type { TokenStateConditionsModalState } from "../helpers/editor-types";
  import type { ConditionOption, ConditionType, NumericOperator, UiCondition } from "../helpers/conditions";

  export let modal: TokenStateConditionsModalState;
  export let conditionTypeOptions: Array<{ value: ConditionType; label: string }>;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: ConditionOption[];
  export let conditionDisplayText: (values: string[]) => string;

  export let onClose: () => void;
  export let onSave: () => void;
  let openConditionPickerKey: string | null = null;

  function addCondition(): void {
    modal = { ...modal, conditions: [...modal.conditions, defaultCondition("hp-percent")] };
  }

  function setConditionType(conditionIndex: number, type: ConditionType): void {
    const conditions = [...modal.conditions];
    if (!conditions[conditionIndex]) return;
    conditions[conditionIndex] = defaultCondition(type);
    modal = { ...modal, conditions };
    if (openConditionPickerKey === `token-state-modal:${conditionIndex}`) openConditionPickerKey = null;
  }

  function updateCondition(conditionIndex: number, updater: (condition: UiCondition) => void): void {
    const conditions = [...modal.conditions];
    const condition = conditions[conditionIndex];
    if (!condition) return;
    updater(condition);
    modal = { ...modal, conditions };
  }

  function removeCondition(conditionIndex: number): void {
    const conditions = [...modal.conditions];
    conditions.splice(conditionIndex, 1);
    modal = {
      ...modal,
      conditions: conditions.length > 0 ? conditions : [defaultCondition("hp-percent")],
    };
    if (openConditionPickerKey?.startsWith("token-state-modal:")) openConditionPickerKey = null;
  }

  function setOpenPickerKey(key: string | null): void {
    openConditionPickerKey = key;
  }
</script>

<svelte:window on:pointerdown={() => (openConditionPickerKey = null)} />

<ModalShell title="Configure Conditions" wide={true} onClose={onClose}>
  <div class="sf2e-token-state-editor__section-header">
    <h3>Conditions</h3>
    <button type="button" title="Add condition" on:click={addCondition}>
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>

  <div class="sf2e-token-state-editor__condition-modal-header">
    <span>Type</span>
    <span>Condition Config</span>
    <span>Actions</span>
  </div>

  <div class="sf2e-token-state-editor__condition-modal-rows">
    {#each modal.conditions as condition, conditionIndex}
      <div class="sf2e-token-state-editor__condition-modal-row">
        <div class="form-group">
          <label>Type</label>
          <div class="form-fields">
            <select
              value={condition.type}
              on:change={(e) => setConditionType(conditionIndex, (e.currentTarget as HTMLSelectElement).value as ConditionType)}
            >
              {#each conditionTypeOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <ConditionConfigFields
          {condition}
          {numericOperatorOptions}
          {conditionOptions}
          {conditionDisplayText}
          {openConditionPickerKey}
          setOpenConditionPickerKey={setOpenPickerKey}
          pickerKey={`token-state-modal:${conditionIndex}`}
          onUpdate={(updater) => updateCondition(conditionIndex, updater)}
        />

        <div class="sf2e-token-state-editor__condition-modal-row-actions">
          <button
            type="button"
            class="sf2e-token-state-editor__icon-button"
            title="Remove condition"
            on:click={() => removeCondition(conditionIndex)}
          >
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    {/each}
  </div>

  <footer class="sf2e-token-state-editor__modal-footer">
    <button type="button" on:click={onSave}>Save Configuration</button>
    <button type="button" on:click={onClose}>Cancel</button>
  </footer>
</ModalShell>
