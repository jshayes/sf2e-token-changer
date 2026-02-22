<script lang="ts">
  type NumericOperator = "<" | "<=" | ">" | ">=";
  type StatusOperator = "any-of" | "all-of";
  type ConditionType = "hp-percent" | "hp-value" | "in-combat" | "status-effect";

  type UiCondition =
    | { type: "hp-percent"; operator: NumericOperator; value: number }
    | { type: "hp-value"; operator: NumericOperator; value: number }
    | { type: "in-combat"; value: boolean }
    | { type: "status-effect"; operator: StatusOperator; value: string[] };

  type TokenStateImageRuleConfig = {
    id: string;
    condition: UiCondition;
    image: string;
    scale: number;
  };

  type SoundTriggerRuleConfig = {
    id: string;
    condition: UiCondition;
    src: string;
    volume: number;
  };

  type TokenStateUiConfig = {
    version: 1;
    default: {
      image: string;
      scale: number;
    };
    tokenStates: TokenStateImageRuleConfig[];
    sounds: SoundTriggerRuleConfig[];
  };

  type EditorRowList = "tokenStates" | "sounds";
  type Row = TokenStateImageRuleConfig | SoundTriggerRuleConfig;

  const conditionTypeOptions: Array<{ value: ConditionType; label: string }> = [
    { value: "hp-percent", label: "HP Percent" },
    { value: "hp-value", label: "HP Value" },
    { value: "in-combat", label: "In Combat" },
    { value: "status-effect", label: "Status Effect" },
  ];

  const numericOperatorOptions: Array<{ value: NumericOperator; label: string }> = [
    { value: "<", label: "<" },
    { value: "<=", label: "<=" },
    { value: ">", label: ">" },
    { value: ">=", label: ">=" },
  ];

  export let initialConfig: TokenStateUiConfig;
  export let onApply: (config: TokenStateUiConfig) => void;
  export let onClose: () => void;
  export let openFilePicker: (type: "image" | "audio", current: string) => Promise<string | null>;

  let config: TokenStateUiConfig = deepClone(initialConfig);
  let dragState: { list: EditorRowList; index: number } | null = null;
  let conditionOptions: Array<{ slug: string; name: string }> = getConditionOptions();
  let openConditionPickerKey: string | null = null;

  $: jsonPreview = JSON.stringify(config, null, 2);

  function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function randomId(): string {
    const utils = (globalThis as { foundry?: { utils?: { randomID?: () => string } } }).foundry?.utils;
    if (utils?.randomID) return utils.randomID();
    return Math.random().toString(36).slice(2, 10);
  }

  function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function defaultCondition(type: ConditionType = "hp-percent"): UiCondition {
    switch (type) {
      case "hp-percent":
        return { type, operator: "<=", value: 0.5 };
      case "hp-value":
        return { type, operator: "<=", value: 10 };
      case "in-combat":
        return { type, value: true };
      case "status-effect":
        return { type, operator: "any-of", value: [] };
    }
  }

  function addTokenState(): void {
    config.tokenStates = [
      ...config.tokenStates,
      { id: randomId(), condition: defaultCondition("hp-percent"), image: "", scale: 1 },
    ];
  }

  function addSound(): void {
    config.sounds = [
      ...config.sounds,
      { id: randomId(), condition: defaultCondition("in-combat"), src: "", volume: 0.8 },
    ];
  }

  function removeRow(list: EditorRowList, index: number): void {
    const rows = [...config[list]];
    rows.splice(index, 1);
    config = { ...config, [list]: rows } as TokenStateUiConfig;
  }

  function setConditionType(list: EditorRowList, index: number, type: ConditionType): void {
    const rows = [...config[list]];
    const row = rows[index];
    if (!row) return;
    row.condition = defaultCondition(type);
    config = { ...config, [list]: rows } as TokenStateUiConfig;
  }

  function updateConfig(): void {
    config = { ...config };
  }

  function setConditionOperator(row: Row, value: string): void {
    if (!("operator" in row.condition)) return;
    if (row.condition.type === "status-effect") {
      row.condition.operator = value === "all-of" ? "all-of" : "any-of";
    } else if (value === "<" || value === "<=" || value === ">" || value === ">=") {
      row.condition.operator = value;
    }
    updateConfig();
  }

  function setConditionNumericValue(row: Row, value: number): void {
    if (row.condition.type === "hp-percent") row.condition.value = clamp(value, 0, 1);
    if (row.condition.type === "hp-value") row.condition.value = Number.isFinite(value) ? value : 0;
    updateConfig();
  }

  function setConditionCombatValue(row: Row, value: string): void {
    if (row.condition.type !== "in-combat") return;
    row.condition.value = value === "true";
    updateConfig();
  }

  function getConditionOptions(): Array<{ slug: string; name: string }> {
    const pf2eGame = (globalThis as { game?: { pf2e?: unknown } }).game?.pf2e as
      | {
          ConditionManager?: {
            conditionsSlugs?: string[];
            conditionSlugs?: string[];
            conditions?: Map<string, { name?: string }>;
          };
        }
      | undefined;
    const manager = pf2eGame?.ConditionManager;
    const slugs = (manager?.conditionsSlugs ?? manager?.conditionSlugs ?? []).sort();
    return slugs.map((slug) => ({
      slug,
      name: manager?.conditions?.get(slug)?.name ?? slug,
    }));
  }

  function pickerKey(list: EditorRowList, index: number): string {
    return `${list}:${index}`;
  }

  function toggleConditionPicker(list: EditorRowList, index: number): void {
    const key = pickerKey(list, index);
    openConditionPickerKey = openConditionPickerKey === key ? null : key;
  }

  function closeConditionPicker(): void {
    openConditionPickerKey = null;
  }

  function toggleStatusCondition(row: Row, slug: string): void {
    if (row.condition.type !== "status-effect") return;
    const selected = new Set(row.condition.value);
    if (selected.has(slug)) selected.delete(slug);
    else selected.add(slug);
    row.condition.value = Array.from(selected);
    updateConfig();
  }

  function conditionDisplayText(values: string[]): string {
    if (values.length === 0) return "Select conditions";
    const names = values.map(
      (slug) => conditionOptions.find((option) => option.slug === slug)?.name ?? slug,
    );
    const text = names.join(", ");
    return text.length > 40 ? `${text.slice(0, 37)}...` : text;
  }

  function setDefaultScale(value: number): void {
    config.default.scale = clamp(value, 0.1, 3);
    updateConfig();
  }

  function setRowScale(row: TokenStateImageRuleConfig, value: number): void {
    row.scale = clamp(value, 0.1, 3);
    updateConfig();
  }

  function setRowVolume(row: SoundTriggerRuleConfig, value: number): void {
    row.volume = clamp(value, 0, 1);
    updateConfig();
  }

  async function pickDefaultImage(): Promise<void> {
    const selected = await openFilePicker("image", config.default.image);
    if (selected) {
      config.default.image = selected;
      updateConfig();
    }
  }

  async function pickRowAsset(list: EditorRowList, index: number, type: "image" | "audio"): Promise<void> {
    const rows = config[list];
    const row = rows[index];
    if (!row) return;
    const current = type === "image" ? (row as TokenStateImageRuleConfig).image : (row as SoundTriggerRuleConfig).src;
    const selected = await openFilePicker(type, current);
    if (!selected) return;
    if (type === "image") (row as TokenStateImageRuleConfig).image = selected;
    else (row as SoundTriggerRuleConfig).src = selected;
    updateConfig();
  }

  function startDrag(event: DragEvent, list: EditorRowList, index: number): void {
    dragState = { list, index };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `${list}:${index}`);
    }
  }

  function dragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function dropOn(event: DragEvent, list: EditorRowList, index: number): void {
    event.preventDefault();
    if (!dragState || dragState.list !== list) return;
    if (dragState.index === index) return;

    const rows = [...config[list]];
    const [moved] = rows.splice(dragState.index, 1);
    if (!moved) return;
    rows.splice(index, 0, moved);
    dragState = null;
    config = { ...config, [list]: rows } as TokenStateUiConfig;
  }

</script>

<svelte:window on:pointerdown={closeConditionPicker} />

<section class="sf2e-token-state-editor svelte-editor">
  <section class="sf2e-token-state-editor__section">
    <h3>Default</h3>
    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--default">
      <span>Row</span><span>Image</span><span>Scale</span>
    </div>
    <article class="sf2e-token-state-editor__row sf2e-token-state-editor__row--default">
      <div class="sf2e-token-state-editor__row-toolbar">
        <strong>Default</strong>
      </div>

      <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
        <label>Image</label>
        <div class="form-fields">
          <input type="text" bind:value={config.default.image} />
          <button type="button" on:click={pickDefaultImage}>Browse</button>
        </div>
      </div>

      <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--value">
        <label>Scale</label>
        <div class="form-fields">
          <input type="range" min="0.1" max="3" step="0.05" bind:value={config.default.scale} on:input={(e) => setDefaultScale(Number((e.currentTarget as HTMLInputElement).value))} />
          <input type="number" min="0.1" max="3" step="0.05" bind:value={config.default.scale} on:input={(e) => setDefaultScale(Number((e.currentTarget as HTMLInputElement).value))} />
        </div>
      </div>

    </article>
  </section>

  <section class="sf2e-token-state-editor__section">
    <div class="sf2e-token-state-editor__section-header">
      <h3>Token States</h3>
      <button type="button" on:click={addTokenState}><i class="fa-solid fa-plus"></i></button>
    </div>
    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--token">
      <span>Row</span><span>Type</span><span>Condition</span><span>Image</span><span>Scale</span><span>Actions</span>
    </div>
    <div class="sf2e-token-state-editor__rows" data-list="tokenStates">
      {#each config.tokenStates as row, index (row.id)}
        <article class="sf2e-token-state-editor__row" data-list="tokenStates" data-index={index} on:dragover={dragOver} on:drop={(e) => dropOn(e, "tokenStates", index)}>
          <div class="sf2e-token-state-editor__row-toolbar">
            <button type="button" draggable="true" data-action="drag-handle" title="Drag priority" on:dragstart={(e) => startDrag(e, "tokenStates", index)}>☰</button>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--type">
            <label>State Type</label>
            <div class="form-fields">
              <select value={row.condition.type} on:change={(e) => setConditionType("tokenStates", index, (e.currentTarget as HTMLSelectElement).value as ConditionType)}>
                {#each conditionTypeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="sf2e-token-state-editor__cell sf2e-token-state-editor__cell--condition">
            {#if row.condition.type === "hp-percent" || row.condition.type === "hp-value"}
              <div class="form-group">
                <label>Operator</label>
                <div class="form-fields">
                  <select
                    value={row.condition.operator}
                    on:change={(e) => setConditionOperator(row, (e.currentTarget as HTMLSelectElement).value)}
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
                  <input
                    type="number"
                    min={row.condition.type === "hp-percent" ? 0 : undefined}
                    max={row.condition.type === "hp-percent" ? 1 : undefined}
                    step={row.condition.type === "hp-percent" ? 0.01 : 1}
                    bind:value={row.condition.value}
                    on:input={(e) => setConditionNumericValue(row, Number((e.currentTarget as HTMLInputElement).value))}
                  />
                </div>
              </div>
            {:else if row.condition.type === "in-combat"}
              <div class="form-group">
                <label>In Combat</label>
                <div class="form-fields">
                  <select value={String(row.condition.value)} on:change={(e) => setConditionCombatValue(row, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            {:else if row.condition.type === "status-effect"}
              <div class="form-group">
                <label>Operator</label>
                <div class="form-fields">
                  <select
                    class="sf2e-token-state-editor__status-operator-select"
                    value={row.condition.operator}
                    on:change={(e) => setConditionOperator(row, (e.currentTarget as HTMLSelectElement).value)}
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
                    <button
                      type="button"
                      class="sf2e-token-state-editor__multiselect-trigger"
                      on:pointerdown|stopPropagation|preventDefault={() =>
                        toggleConditionPicker("tokenStates", index)}
                      title={row.condition.value.join(", ")}
                    >
                      <span class="sf2e-token-state-editor__multiselect-trigger-text">
                        {conditionDisplayText(row.condition.value)}
                      </span>
                    </button>
                    {#if openConditionPickerKey === `tokenStates:${index}`}
                      <div class="sf2e-token-state-editor__multiselect-popover">
                        {#each conditionOptions as option}
                          <label class="sf2e-token-state-editor__multiselect-option">
                            <input
                              type="checkbox"
                              checked={row.condition.value.includes(option.slug)}
                              on:change={() => toggleStatusCondition(row, option.slug)}
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

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
            <label>Image</label>
            <div class="form-fields">
              <input type="text" bind:value={row.image} />
              <button type="button" on:click={() => pickRowAsset("tokenStates", index, "image")}>Browse</button>
            </div>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--value">
            <label>Scale</label>
            <div class="form-fields">
              <input type="range" min="0.1" max="3" step="0.05" bind:value={row.scale} on:input={(e) => setRowScale(row, Number((e.currentTarget as HTMLInputElement).value))} />
              <input type="number" min="0.1" max="3" step="0.05" bind:value={row.scale} on:input={(e) => setRowScale(row, Number((e.currentTarget as HTMLInputElement).value))} />
            </div>
          </div>

          <div class="sf2e-token-state-editor__cell sf2e-token-state-editor__cell--actions">
            <button type="button" on:click={() => removeRow("tokenStates", index)}>Remove</button>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="sf2e-token-state-editor__section">
    <div class="sf2e-token-state-editor__section-header">
      <h3>Sounds</h3>
      <button type="button" on:click={addSound}><i class="fa-solid fa-plus"></i></button>
    </div>
    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--sound">
      <span>Row</span><span>Type</span><span>Condition</span><span>Sound</span><span>Volume</span><span>Actions</span>
    </div>
    <div class="sf2e-token-state-editor__rows" data-list="sounds">
      {#each config.sounds as row, index (row.id)}
        <article class="sf2e-token-state-editor__row" data-list="sounds" data-index={index} on:dragover={dragOver} on:drop={(e) => dropOn(e, "sounds", index)}>
          <div class="sf2e-token-state-editor__row-toolbar">
            <button type="button" draggable="true" title="Drag priority" on:dragstart={(e) => startDrag(e, "sounds", index)}>☰</button>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--type">
            <label>Trigger Type</label>
            <div class="form-fields">
              <select value={row.condition.type} on:change={(e) => setConditionType("sounds", index, (e.currentTarget as HTMLSelectElement).value as ConditionType)}>
                {#each conditionTypeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="sf2e-token-state-editor__cell sf2e-token-state-editor__cell--condition">
            {#if row.condition.type === "hp-percent" || row.condition.type === "hp-value"}
              <div class="form-group">
                <label>Operator</label>
                <div class="form-fields">
                  <select
                    class="sf2e-token-state-editor__status-operator-select"
                    value={row.condition.operator}
                    on:change={(e) => setConditionOperator(row, (e.currentTarget as HTMLSelectElement).value)}
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
                  <input type="number" min={row.condition.type === "hp-percent" ? 0 : undefined} max={row.condition.type === "hp-percent" ? 1 : undefined} step={row.condition.type === "hp-percent" ? 0.01 : 1} bind:value={row.condition.value} on:input={(e) => setConditionNumericValue(row, Number((e.currentTarget as HTMLInputElement).value))} />
                </div>
              </div>
            {:else if row.condition.type === "in-combat"}
              <div class="form-group">
                <label>In Combat</label>
                <div class="form-fields">
                  <select value={String(row.condition.value)} on:change={(e) => setConditionCombatValue(row, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            {:else if row.condition.type === "status-effect"}
              <div class="form-group">
                <label>Operator</label>
                <div class="form-fields">
                  <select value={row.condition.operator} on:change={(e) => setConditionOperator(row, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="any-of">Any Of</option>
                    <option value="all-of">All Of</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Status Slugs</label>
                <div class="form-fields">
                  <div class="sf2e-token-state-editor__multiselect" on:pointerdown|stopPropagation>
                    <button
                      type="button"
                      class="sf2e-token-state-editor__multiselect-trigger"
                      on:pointerdown|stopPropagation|preventDefault={() =>
                        toggleConditionPicker("sounds", index)}
                      title={row.condition.value.join(", ")}
                    >
                      <span class="sf2e-token-state-editor__multiselect-trigger-text">
                        {conditionDisplayText(row.condition.value)}
                      </span>
                    </button>
                    {#if openConditionPickerKey === `sounds:${index}`}
                      <div class="sf2e-token-state-editor__multiselect-popover">
                        {#each conditionOptions as option}
                          <label class="sf2e-token-state-editor__multiselect-option">
                            <input
                              type="checkbox"
                              checked={row.condition.value.includes(option.slug)}
                              on:change={() => toggleStatusCondition(row, option.slug)}
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

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
            <label>Sound</label>
            <div class="form-fields">
              <input type="text" bind:value={row.src} />
              <button type="button" on:click={() => pickRowAsset("sounds", index, "audio")}>Browse</button>
            </div>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--value">
            <label>Volume</label>
            <div class="form-fields">
              <input type="range" min="0" max="1" step="0.05" bind:value={row.volume} on:input={(e) => setRowVolume(row, Number((e.currentTarget as HTMLInputElement).value))} />
              <input type="number" min="0" max="1" step="0.05" bind:value={row.volume} on:input={(e) => setRowVolume(row, Number((e.currentTarget as HTMLInputElement).value))} />
            </div>
          </div>

          <div class="sf2e-token-state-editor__cell sf2e-token-state-editor__cell--actions">
            <button type="button" on:click={() => removeRow("sounds", index)}>Remove</button>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="sf2e-token-state-editor__section">
    <h3>JSON Preview</h3>
    <textarea rows="10" spellcheck="false" readonly>{jsonPreview}</textarea>
  </section>

  <footer class="sf2e-token-state-editor__footer">
    <button type="button" on:click={() => onApply(config)}>Apply To Token Config</button>
    <button type="button" on:click={onClose}>Close</button>
  </footer>
</section>
