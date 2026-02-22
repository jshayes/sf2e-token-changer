<script lang="ts">
  type NumericOperator = "<" | "<=" | ">" | ">=";
  type StatusOperator = "any-of" | "all-of";
  type UiCondition =
    | { type: "hp-percent"; operator: NumericOperator; value: number }
    | { type: "hp-value"; operator: NumericOperator; value: number }
    | { type: "in-combat"; value: boolean }
    | { type: "status-effect"; operator: StatusOperator; value: string[] };

  export let condition: UiCondition;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: Array<{ slug: string; name: string }>;
  export let conditionDisplayText: (values: string[]) => string;
  export let openConditionPickerKey: string | null;
  export let setOpenConditionPickerKey: (key: string | null) => void;
  export let pickerKey: string;
  export let onUpdate: (updater: (condition: UiCondition) => void) => void;

  function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
</script>

<div class="sf2e-token-state-editor__condition-modal-config">
  {#if condition.type === "hp-percent" || condition.type === "hp-value"}
    <div class="form-group">
      <label>Operator</label>
      <div class="form-fields">
        <select
          value={condition.operator}
          on:change={(e) =>
            onUpdate((c) => {
              if (!("operator" in c)) return;
              if (c.type === "status-effect") return;
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
              onUpdate((c) => {
                const value = Number((e.currentTarget as HTMLInputElement).value);
                if (c.type === "hp-percent") c.value = clamp(value, 0, 1);
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
            onUpdate((c) => {
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
            onUpdate((c) => {
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
            onUpdate((c) => {
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
            <input
              type="text"
              readonly
              value={conditionDisplayText(condition.value)}
              title={condition.value.join(", ")}
            />
            <button
              type="button"
              class="sf2e-token-state-editor__icon-button"
              title="Select conditions"
              on:pointerdown|stopPropagation|preventDefault={() => setOpenConditionPickerKey(openConditionPickerKey === pickerKey ? null : pickerKey)}
            >
              <i class="fa-solid fa-gear"></i>
            </button>
          </div>
          {#if openConditionPickerKey === pickerKey}
            <div class="sf2e-token-state-editor__multiselect-popover">
              {#each conditionOptions as option}
                <label class="sf2e-token-state-editor__multiselect-option">
                  <input
                    type="checkbox"
                    checked={condition.value.includes(option.slug)}
                    on:change={() =>
                      onUpdate((c) => {
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
