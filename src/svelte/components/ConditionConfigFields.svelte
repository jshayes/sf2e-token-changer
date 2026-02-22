<script lang="ts">
  import { tick } from "svelte";
  import type { ConditionOption, NumericOperator, UiCondition } from "../helpers/conditions";
  import { clamp } from "../helpers/conditions";

  export let condition: UiCondition;
  export let numericOperatorOptions: Array<{ value: NumericOperator; label: string }>;
  export let conditionOptions: ConditionOption[];
  export let conditionDisplayText: (values: string[]) => string;
  export let openConditionPickerKey: string | null;
  export let setOpenConditionPickerKey: (key: string | null) => void;
  export let pickerKey: string;
  export let onUpdate: (updater: (condition: UiCondition) => void) => void;
  export let showValidation = false;

  let multiselectRoot: HTMLDivElement | null = null;
  let pickerButton: HTMLButtonElement | null = null;
  let popoverElement: HTMLDivElement | null = null;
  let searchInput: HTMLInputElement | null = null;
  let statusSearch = "";

  $: filteredConditionOptions = conditionOptions.filter((option) => {
    const query = statusSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      option.name.toLowerCase().includes(query) ||
      option.slug.toLowerCase().includes(query)
    );
  });

  $: if (openConditionPickerKey !== pickerKey) {
    statusSearch = "";
  }

  $: if (openConditionPickerKey === pickerKey) {
    void tick().then(() => {
      updatePopoverPosition();
      searchInput?.focus();
      searchInput?.select();
    });
  }

  function portalToBody(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode === document.body) {
          document.body.removeChild(node);
        }
      },
    };
  }

  function updatePopoverPosition(): void {
    if (openConditionPickerKey !== pickerKey) return;
    if (!pickerButton || !popoverElement) return;

    const margin = 8;
    const gap = 4;
    const buttonRect = pickerButton.getBoundingClientRect();
    const popoverRect = popoverElement.getBoundingClientRect();
    const popoverWidth = Math.ceil(popoverRect.width || 260);
    const popoverHeight = Math.ceil(popoverRect.height || 220);

    let left = Math.round(buttonRect.right - popoverWidth);
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    const spaceBelow = window.innerHeight - buttonRect.bottom - margin;
    const spaceAbove = buttonRect.top - margin;
    const shouldOpenUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    let top = shouldOpenUp
      ? Math.round(buttonRect.top - popoverHeight - gap)
      : Math.round(buttonRect.bottom + gap);

    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

    const themeSource = multiselectRoot ?? pickerButton;
    const computed = getComputedStyle(themeSource);
    for (const cssVar of [
      "--background",
      "--color-border",
      "--color-text-primary",
      "--color-text-secondary",
    ]) {
      const value = computed.getPropertyValue(cssVar);
      if (value) popoverElement.style.setProperty(cssVar, value);
    }

    popoverElement.style.left = `${left}px`;
    popoverElement.style.top = `${top}px`;
  }

  function closePickerOnOutsidePointerDown(event: PointerEvent): void {
    if (openConditionPickerKey !== pickerKey) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (multiselectRoot?.contains(target)) return;
    if (popoverElement?.contains(target)) return;
    setOpenConditionPickerKey(null);
  }
</script>

<svelte:window
  on:pointerdown|capture={closePickerOnOutsidePointerDown}
  on:resize={updatePopoverPosition}
  on:scroll|capture={updatePopoverPosition}
/>

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
        <div
          class="sf2e-token-state-editor__multiselect"
          bind:this={multiselectRoot}
          on:pointerdown|stopPropagation
        >
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
              bind:this={pickerButton}
              title="Select conditions"
              on:pointerdown|stopPropagation|preventDefault={() => setOpenConditionPickerKey(openConditionPickerKey === pickerKey ? null : pickerKey)}
            >
              <i class="fa-solid fa-gear"></i>
            </button>
          </div>
          {#if openConditionPickerKey === pickerKey}
            <div
              class="sf2e-token-state-editor__multiselect-popover"
              bind:this={popoverElement}
              use:portalToBody
              on:pointerdown|stopPropagation
            >
              <div class="sf2e-token-state-editor__multiselect-search">
                <input
                  type="text"
                  bind:this={searchInput}
                  placeholder="Search conditions..."
                  bind:value={statusSearch}
                  on:pointerdown|stopPropagation
                />
              </div>
              {#if filteredConditionOptions.length === 0}
                <p class="sf2e-token-state-editor__multiselect-empty">No matching conditions</p>
              {:else}
                <div class="sf2e-token-state-editor__multiselect-popover-items">
                  {#each filteredConditionOptions as option}
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
          {/if}
        </div>
      </div>
    </div>
    {#if showValidation && condition.value.length === 0}
      <div class="sf2e-token-state-editor__condition-inline-error">
        <span class="sf2e-token-state-editor__field-error">Select at least one status condition.</span>
      </div>
    {/if}
  {/if}
</div>
