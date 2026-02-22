<script lang="ts">
  import ConditionConfigFields from "./ConditionConfigFields.svelte";
  import ModalShell from "./ModalShell.svelte";
  import type { SoundConditionsModalState } from "../helpers/editor-types";
  import { defaultCondition } from "../helpers/conditions";
  import type { ConditionOption, ConditionType, NumericOperator, UiCondition } from "../helpers/conditions";

  export let modal: SoundConditionsModalState;
  export let conditionTypeOptions: Array<{ value: ConditionType; label: string }>;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: ConditionOption[];
  export let conditionDisplayText: (values: string[]) => string;

  export let onClose: () => void;
  export let onSave: () => void;

  let openConditionPickerKey: string | null = null;
  let hasAttemptedSave = false;

  function updateTrigger(updater: (condition: UiCondition) => void): void {
    updater(modal.trigger);
    modal = { ...modal, trigger: { ...modal.trigger } };
  }

  function setTriggerType(type: ConditionType): void {
    modal = { ...modal, trigger: defaultCondition(type) };
    if (openConditionPickerKey === "sound-modal:trigger") openConditionPickerKey = null;
  }

  function addCondition(): void {
    modal = { ...modal, conditions: [...modal.conditions, defaultCondition("hp-percent")] };
  }

  function setConditionType(conditionIndex: number, type: ConditionType): void {
    const conditions = [...modal.conditions];
    if (!conditions[conditionIndex]) return;
    conditions[conditionIndex] = defaultCondition(type);
    modal = { ...modal, conditions };
    if (openConditionPickerKey === `sound-modal:condition:${conditionIndex}`) openConditionPickerKey = null;
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
    modal = { ...modal, conditions };
    if (openConditionPickerKey?.startsWith("sound-modal:condition:")) openConditionPickerKey = null;
  }

  function setOpenPickerKey(key: string | null): void {
    openConditionPickerKey = key;
  }

  function hasValidationErrors(): boolean {
    if (modal.trigger.type === "status-effect" && modal.trigger.value.length === 0) {
      return true;
    }
    return modal.conditions.some(
      (condition) =>
        condition.type === "status-effect" && condition.value.length === 0,
    );
  }

  function saveModal(): void {
    hasAttemptedSave = true;
    if (hasValidationErrors()) return;
    onSave();
  }
</script>

<svelte:window on:pointerdown={() => (openConditionPickerKey = null)} />

<ModalShell title="Configure Sound Trigger & Conditions" wide={true} onClose={onClose}>
  <section class="sf2e-token-state-editor__section">
    <div class="sf2e-token-state-editor__section-header">
      <h3>Trigger</h3>
    </div>

    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__condition-modal-header">
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
              on:change={(e) => setTriggerType((e.currentTarget as HTMLSelectElement).value as ConditionType)}
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
          showValidation={hasAttemptedSave}
          setOpenConditionPickerKey={setOpenPickerKey}
          pickerKey="sound-modal:trigger"
          onUpdate={updateTrigger}
        />
      </div>
    </div>
  </section>

  <div class="sf2e-token-state-editor__section-header" style="margin-top: 0.75rem;">
    <h3>Conditions</h3>
    <button type="button" title="Add condition" on:click={addCondition}>
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>

  {#if modal.conditions.length === 0}
    <p class="sf2e-token-state-editor__empty-state">No conditions</p>
  {:else}
    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__condition-modal-header">
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
            showValidation={hasAttemptedSave}
            setOpenConditionPickerKey={setOpenPickerKey}
            pickerKey={`sound-modal:condition:${conditionIndex}`}
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
  {/if}

  <footer class="sf2e-token-state-editor__modal-footer">
    <button type="button" on:click={saveModal}>Save Configuration</button>
    <button type="button" on:click={onClose}>Cancel</button>
  </footer>
</ModalShell>
