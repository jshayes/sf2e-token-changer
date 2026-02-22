<script lang="ts">
  import ModalShell from "./ModalShell.svelte";

  type NumericOperator = "<" | "<=" | ">" | ">=";
  type StatusOperator = "any-of" | "all-of";
  type ConditionType = "hp-percent" | "hp-value" | "in-combat" | "status-effect";
  type UiCondition =
    | { type: "hp-percent"; operator: NumericOperator; value: number }
    | { type: "hp-value"; operator: NumericOperator; value: number }
    | { type: "in-combat"; value: boolean }
    | { type: "status-effect"; operator: StatusOperator; value: string[] };

  type SoundConditionsModalState = {
    target: { index: number };
    trigger: UiCondition;
    conditions: UiCondition[];
  };

  export let modal: SoundConditionsModalState;
  export let conditionTypeOptions: Array<{ value: ConditionType; label: string }>;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: Array<{ slug: string; name: string }>;
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

  function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
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

      <div class="sf2e-token-state-editor__condition-modal-config">
        {#if modal.trigger.type === "hp-percent" || modal.trigger.type === "hp-value"}
          <div class="form-group">
            <label>Operator</label>
            <div class="form-fields">
              <select
                value={modal.trigger.operator}
                on:change={(e) =>
                  onUpdateTrigger((c) => {
                    if (!("operator" in c) || c.type === "status-effect") return;
                    const value = (e.currentTarget as HTMLSelectElement).value;
                    if (value === "<" || value === "<=" || value === ">" || value === ">=") c.operator = value;
                  })}
              >
                {#each numericOperatorOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Value</label>
            <div class="form-fields">
              {#if modal.trigger.type === "hp-percent"}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={modal.trigger.value}
                  on:input={(e) =>
                    onUpdateTrigger((c) => {
                      if (c.type !== "hp-percent") return;
                      c.value = clamp(Number((e.currentTarget as HTMLInputElement).value), 0, 1);
                    })}
                />
              {/if}
              <input
                type="number"
                min={modal.trigger.type === "hp-percent" ? 0 : undefined}
                max={modal.trigger.type === "hp-percent" ? 1 : undefined}
                step={modal.trigger.type === "hp-percent" ? 0.01 : 1}
                bind:value={modal.trigger.value}
                on:input={(e) =>
                  onUpdateTrigger((c) => {
                    const value = Number((e.currentTarget as HTMLInputElement).value);
                    if (c.type === "hp-percent") c.value = clamp(value, 0, 1);
                    if (c.type === "hp-value") c.value = Number.isFinite(value) ? value : 0;
                  })}
              />
            </div>
          </div>
        {:else if modal.trigger.type === "in-combat"}
          <div class="form-group">
            <label>In Combat</label>
            <div class="form-fields">
              <select
                value={String(modal.trigger.value)}
                on:change={(e) =>
                  onUpdateTrigger((c) => {
                    if (c.type !== "in-combat") return;
                    c.value = (e.currentTarget as HTMLSelectElement).value === "true";
                  })}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        {:else if modal.trigger.type === "status-effect"}
          <div class="form-group">
            <label>Operator</label>
            <div class="form-fields">
              <select
                class="sf2e-token-state-editor__status-operator-select"
                value={modal.trigger.operator}
                on:change={(e) =>
                  onUpdateTrigger((c) => {
                    if (c.type !== "status-effect") return;
                    c.operator = (e.currentTarget as HTMLSelectElement).value === "all-of" ? "all-of" : "any-of";
                  })}
              >
                <option value="any-of">Any Of</option>
                <option value="all-of">All Of</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Status Slugs</label>
            <div class="form-fields">
              <div class="sf2e-token-state-editor__multiselect" on:pointerdown|stopPropagation>
                <div class="form-fields">
                  <input type="text" readonly value={conditionDisplayText(modal.trigger.value)} title={modal.trigger.value.join(", ")} />
                  <button
                    type="button"
                    class="sf2e-token-state-editor__icon-button"
                    title="Select conditions"
                    on:pointerdown|stopPropagation|preventDefault={() => setOpenConditionPickerKey(openConditionPickerKey === "sound-modal:trigger" ? null : "sound-modal:trigger")}
                  >
                    <i class="fa-solid fa-gear"></i>
                  </button>
                </div>
                {#if openConditionPickerKey === "sound-modal:trigger"}
                  <div class="sf2e-token-state-editor__multiselect-popover">
                    {#each conditionOptions as option}
                      <label class="sf2e-token-state-editor__multiselect-option">
                        <input
                          type="checkbox"
                          checked={modal.trigger.value.includes(option.slug)}
                          on:change={() =>
                            onUpdateTrigger((c) => {
                              if (c.type !== "status-effect") return;
                              const selected = new Set(c.value);
                              if (selected.has(option.slug)) selected.delete(option.slug);
                              else selected.add(option.slug);
                              c.value = Array.from(selected);
                            })}
                        />
                        <span>{option.name}</span>
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
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
        <div class="sf2e-token-state-editor__condition-modal-config">
          {#if condition.type === "hp-percent" || condition.type === "hp-value"}
            <div class="form-group">
              <label>Operator</label>
              <div class="form-fields">
                <select
                  value={condition.operator}
                  on:change={(e) =>
                    onUpdateCondition(conditionIndex, (c) => {
                      if (!("operator" in c) || c.type === "status-effect") return;
                      const value = (e.currentTarget as HTMLSelectElement).value;
                      if (value === "<" || value === "<=" || value === ">" || value === ">=") c.operator = value;
                    })}
                >
                  {#each numericOperatorOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Value</label>
              <div class="form-fields">
                {#if condition.type === "hp-percent"}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={condition.value}
                    on:input={(e) =>
                      onUpdateCondition(conditionIndex, (c) => {
                        if (c.type !== "hp-percent") return;
                        c.value = clamp(Number((e.currentTarget as HTMLInputElement).value), 0, 1);
                      })}
                  />
                {/if}
                <input
                  type="number"
                  min={condition.type === "hp-percent" ? 0 : undefined}
                  max={condition.type === "hp-percent" ? 1 : undefined}
                  step={condition.type === "hp-percent" ? 0.01 : 1}
                  bind:value={condition.value}
                  on:input={(e) =>
                    onUpdateCondition(conditionIndex, (c) => {
                      const value = Number((e.currentTarget as HTMLInputElement).value);
                      if (c.type === "hp-percent") c.value = clamp(value, 0, 1);
                      if (c.type === "hp-value") c.value = Number.isFinite(value) ? value : 0;
                    })}
                />
              </div>
            </div>
          {:else if condition.type === "in-combat"}
            <div class="form-group">
              <label>In Combat</label>
              <div class="form-fields">
                <select
                  value={String(condition.value)}
                  on:change={(e) =>
                    onUpdateCondition(conditionIndex, (c) => {
                      if (c.type !== "in-combat") return;
                      c.value = (e.currentTarget as HTMLSelectElement).value === "true";
                    })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          {:else if condition.type === "status-effect"}
            <div class="form-group">
              <label>Operator</label>
              <div class="form-fields">
                <select
                  class="sf2e-token-state-editor__status-operator-select"
                  value={condition.operator}
                  on:change={(e) =>
                    onUpdateCondition(conditionIndex, (c) => {
                      if (c.type !== "status-effect") return;
                      c.operator = (e.currentTarget as HTMLSelectElement).value === "all-of" ? "all-of" : "any-of";
                    })}
                >
                  <option value="any-of">Any Of</option>
                  <option value="all-of">All Of</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Status Slugs</label>
              <div class="form-fields">
                <div class="sf2e-token-state-editor__multiselect" on:pointerdown|stopPropagation>
                  <div class="form-fields">
                    <input type="text" readonly value={conditionDisplayText(condition.value)} title={condition.value.join(", ")} />
                    <button
                      type="button"
                      class="sf2e-token-state-editor__icon-button"
                      title="Select conditions"
                      on:pointerdown|stopPropagation|preventDefault={() => setOpenConditionPickerKey(openConditionPickerKey === `sound-modal:condition:${conditionIndex}` ? null : `sound-modal:condition:${conditionIndex}`)}
                    >
                      <i class="fa-solid fa-gear"></i>
                    </button>
                  </div>
                  {#if openConditionPickerKey === `sound-modal:condition:${conditionIndex}`}
                    <div class="sf2e-token-state-editor__multiselect-popover">
                      {#each conditionOptions as option}
                        <label class="sf2e-token-state-editor__multiselect-option">
                          <input
                            type="checkbox"
                            checked={condition.value.includes(option.slug)}
                            on:change={() =>
                              onUpdateCondition(conditionIndex, (c) => {
                                if (c.type !== "status-effect") return;
                                const selected = new Set(c.value);
                                if (selected.has(option.slug)) selected.delete(option.slug);
                                else selected.add(option.slug);
                                c.value = Array.from(selected);
                              })}
                          />
                          <span>{option.name}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
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
