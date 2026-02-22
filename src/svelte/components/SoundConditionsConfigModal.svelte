<script lang="ts">
  import ConditionConfigFields from "./ConditionConfigFields.svelte";
  import ModalShell from "./ModalShell.svelte";
  import type { ConditionOption, ConditionType, NumericOperator, UiCondition } from "../helpers/conditions";

  type SoundConditionsModalState = {
    target: { index: number };
    trigger: UiCondition;
    conditions: UiCondition[];
  };

  export let modal: SoundConditionsModalState;
  export let conditionTypeOptions: Array<{ value: ConditionType; label: string }>;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: ConditionOption[];
  export let openConditionPickerKey: string | null;
  export let setOpenConditionPickerKey: (key: string | null) => void;
  export let conditionDisplayText: (values: string[]) => string;

  export let onClose: () => void;
  export let onSetTriggerType: (type: ConditionType) => void;
  export let onUpdateTrigger: (updater: (condition: UiCondition) => void) => void;
  export let onAddCondition: () => void;
  export let onSetConditionType: (conditionIndex: number, type: ConditionType) => void;
  export let onUpdateCondition: (
    conditionIndex: number,
    updater: (condition: UiCondition) => void,
  ) => void;
  export let onRemoveCondition: (conditionIndex: number) => void;
  export let onSave: () => void;

</script>

<ModalShell title="Configure Sound Trigger & Conditions" wide={true} onClose={onClose}>
  <div class="sf2e-token-state-editor__section-header">
    <h3>Trigger</h3>
  </div>

  <div class="sf2e-token-state-editor__condition-modal-header">
    <span>Type</span>
    <span>Trigger Config</span>
  </div>
  <div class="sf2e-token-state-editor__condition-modal-rows">
    <div class="sf2e-token-state-editor__condition-modal-row">
      <div class="form-group">
        <label>Type</label>
        <div class="form-fields">
          <select
            value={modal.trigger.type}
            on:change={(e) => onSetTriggerType((e.currentTarget as HTMLSelectElement).value as ConditionType)}
          >
            {#each conditionTypeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <ConditionConfigFields
        condition={modal.trigger}
        {numericOperatorOptions}
        {conditionOptions}
        {conditionDisplayText}
        {openConditionPickerKey}
        {setOpenConditionPickerKey}
        pickerKey="sound-modal:trigger"
        onUpdate={onUpdateTrigger}
      />
    </div>
  </div>

  <div class="sf2e-token-state-editor__section-header" style="margin-top: 0.75rem;">
    <h3>Optional Conditions</h3>
    <button type="button" title="Add condition" on:click={onAddCondition}>
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
              on:change={(e) => onSetConditionType(conditionIndex, (e.currentTarget as HTMLSelectElement).value as ConditionType)}
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
          {setOpenConditionPickerKey}
          pickerKey={`sound-modal:condition:${conditionIndex}`}
          onUpdate={(updater) => onUpdateCondition(conditionIndex, updater)}
        />
        <div class="sf2e-token-state-editor__condition-modal-row-actions">
          <button
            type="button"
            class="sf2e-token-state-editor__icon-button"
            title="Remove condition"
            on:click={() => onRemoveCondition(conditionIndex)}
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
