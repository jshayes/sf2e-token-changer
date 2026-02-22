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
    name: string;
    conditions: UiCondition[];
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
  type ImageConfigTarget =
    | { kind: "default" }
    | { kind: "tokenState"; index: number };
  type SoundConfigTarget = { index: number };
  type TokenStateConditionsConfigTarget = { index: number };

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
  let imageConfigModal:
    | {
        target: ImageConfigTarget;
        image: string;
        scale: number;
      }
    | null = null;
  let soundConfigModal:
    | {
        target: SoundConfigTarget;
        src: string;
        volume: number;
      }
    | null = null;
  let tokenStateConditionsConfigModal:
    | {
        target: TokenStateConditionsConfigTarget;
        conditions: UiCondition[];
      }
    | null = null;

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
      { id: randomId(), name: "", conditions: [defaultCondition("hp-percent")], image: "", scale: 1 },
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
    if (list !== "sounds") return;
    const rows = [...config.sounds];
    const row = rows[index];
    if (!row) return;
    row.condition = defaultCondition(type);
    config = { ...config, sounds: rows };
  }

  function updateConfig(): void {
    config = { ...config };
  }

  function setUiConditionOperator(condition: UiCondition, value: string): void {
    if (!("operator" in condition)) return;
    if (condition.type === "status-effect") {
      condition.operator = value === "all-of" ? "all-of" : "any-of";
    } else if (value === "<" || value === "<=" || value === ">" || value === ">=") {
      condition.operator = value;
    }
    updateConfig();
  }

  function setUiConditionNumericValue(condition: UiCondition, value: number): void {
    if (condition.type === "hp-percent") condition.value = clamp(value, 0, 1);
    if (condition.type === "hp-value") condition.value = Number.isFinite(value) ? value : 0;
    updateConfig();
  }

  function setUiConditionCombatValue(condition: UiCondition, value: string): void {
    if (condition.type !== "in-combat") return;
    condition.value = value === "true";
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

  function openDefaultImageConfig(): void {
    imageConfigModal = {
      target: { kind: "default" },
      image: config.default.image,
      scale: config.default.scale,
    };
  }

  function openTokenStateImageConfig(index: number): void {
    const row = config.tokenStates[index];
    if (!row) return;
    imageConfigModal = {
      target: { kind: "tokenState", index },
      image: row.image,
      scale: row.scale,
    };
  }

  function closeImageConfigModal(): void {
    imageConfigModal = null;
  }

  function openSoundConfig(index: number): void {
    const row = config.sounds[index];
    if (!row) return;
    soundConfigModal = {
      target: { index },
      src: row.src,
      volume: row.volume,
    };
  }

  function closeSoundConfigModal(): void {
    soundConfigModal = null;
  }

  function openTokenStateConditionsConfig(index: number): void {
    const row = config.tokenStates[index];
    if (!row) return;
    tokenStateConditionsConfigModal = {
      target: { index },
      conditions:
        row.conditions.length > 0
          ? deepClone(row.conditions)
          : [defaultCondition("hp-percent")],
    };
  }

  function closeTokenStateConditionsConfigModal(): void {
    tokenStateConditionsConfigModal = null;
    openConditionPickerKey = null;
  }

  function addTokenStateConditionModalRow(): void {
    if (!tokenStateConditionsConfigModal) return;
    tokenStateConditionsConfigModal = {
      ...tokenStateConditionsConfigModal,
      conditions: [
        ...tokenStateConditionsConfigModal.conditions,
        defaultCondition("hp-percent"),
      ],
    };
  }

  function removeTokenStateConditionModalRow(conditionIndex: number): void {
    if (!tokenStateConditionsConfigModal) return;
    const conditions = [...tokenStateConditionsConfigModal.conditions];
    conditions.splice(conditionIndex, 1);
    tokenStateConditionsConfigModal = {
      ...tokenStateConditionsConfigModal,
      conditions: conditions.length > 0 ? conditions : [defaultCondition("hp-percent")],
    };
    if (openConditionPickerKey?.startsWith("token-state-modal:")) {
      openConditionPickerKey = null;
    }
  }

  function setTokenStateConditionModalType(conditionIndex: number, type: ConditionType): void {
    if (!tokenStateConditionsConfigModal) return;
    const conditions = [...tokenStateConditionsConfigModal.conditions];
    if (!conditions[conditionIndex]) return;
    conditions[conditionIndex] = defaultCondition(type);
    tokenStateConditionsConfigModal = { ...tokenStateConditionsConfigModal, conditions };
    if (openConditionPickerKey === `token-state-modal:${conditionIndex}`) {
      openConditionPickerKey = null;
    }
  }

  function updateTokenStateConditionModalCondition(
    conditionIndex: number,
    updater: (condition: UiCondition) => void,
  ): void {
    if (!tokenStateConditionsConfigModal) return;
    const conditions = [...tokenStateConditionsConfigModal.conditions];
    const condition = conditions[conditionIndex];
    if (!condition) return;
    updater(condition);
    tokenStateConditionsConfigModal = { ...tokenStateConditionsConfigModal, conditions };
  }

  function saveTokenStateConditionsConfigModal(): void {
    if (!tokenStateConditionsConfigModal) return;
    const row = config.tokenStates[tokenStateConditionsConfigModal.target.index];
    if (!row) return;
    row.conditions =
      tokenStateConditionsConfigModal.conditions.length > 0
        ? deepClone(tokenStateConditionsConfigModal.conditions)
        : [defaultCondition("hp-percent")];
    updateConfig();
    tokenStateConditionsConfigModal = null;
    openConditionPickerKey = null;
  }

  async function browseImageConfigModal(): Promise<void> {
    if (!imageConfigModal) return;
    const selected = await openFilePicker("image", imageConfigModal.image);
    if (!selected) return;
    imageConfigModal = { ...imageConfigModal, image: selected };
  }

  function saveImageConfigModal(): void {
    if (!imageConfigModal) return;
    if (imageConfigModal.target.kind === "default") {
      config.default.image = imageConfigModal.image;
      config.default.scale = clamp(imageConfigModal.scale, 0.1, 3);
      updateConfig();
      imageConfigModal = null;
      return;
    }

    const row = config.tokenStates[imageConfigModal.target.index];
    if (!row) return;
    row.image = imageConfigModal.image;
    row.scale = clamp(imageConfigModal.scale, 0.1, 3);
    updateConfig();
    imageConfigModal = null;
  }

  async function browseSoundConfigModal(): Promise<void> {
    if (!soundConfigModal) return;
    const selected = await openFilePicker("audio", soundConfigModal.src);
    if (!selected) return;
    soundConfigModal = { ...soundConfigModal, src: selected };
  }

  function saveSoundConfigModal(): void {
    if (!soundConfigModal) return;
    const row = config.sounds[soundConfigModal.target.index];
    if (!row) return;
    row.src = soundConfigModal.src;
    row.volume = clamp(soundConfigModal.volume, 0, 1);
    updateConfig();
    soundConfigModal = null;
  }

  function toggleStatusConditionValue(condition: UiCondition, slug: string): void {
    if (condition.type !== "status-effect") return;
    const selected = new Set(condition.value);
    if (selected.has(slug)) selected.delete(slug);
    else selected.add(slug);
    condition.value = Array.from(selected);
  }

  function conditionDisplayText(values: string[]): string {
    if (values.length === 0) return "Select conditions";
    const names = values.map(
      (slug) => conditionOptions.find((option) => option.slug === slug)?.name ?? slug,
    );
    return names.join(", ");
  }

  function formatConditionSummary(condition: UiCondition): string {
    if (condition.type === "hp-percent") {
      return `HP % ${condition.operator} ${condition.value}`;
    }
    if (condition.type === "hp-value") {
      return `HP ${condition.operator} ${condition.value}`;
    }
    if (condition.type === "in-combat") {
      return condition.value ? "In Combat: Yes" : "In Combat: No";
    }
    const mode = condition.operator === "all-of" ? "all" : "any";
    return `Status (${mode}): ${conditionDisplayText(condition.value)}`;
  }

  function tokenStateConditionsSummary(conditions: UiCondition[]): string {
    if (conditions.length === 0) return "No conditions configured";
    if (conditions.length === 1) return formatConditionSummary(conditions[0]);
    return `${conditions.length} conditions configured`;
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
          <input type="text" value={config.default.image} readonly />
          <button type="button" class="sf2e-token-state-editor__icon-button" on:click={openDefaultImageConfig} title="Configure image">
            <i class="fa-solid fa-gear"></i>
          </button>
        </div>
      </div>

      <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--value">
        <label>Scale</label>
        <div class="form-fields">
          <input type="number" value={config.default.scale.toFixed(2)} readonly />
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
      <span>Row</span><span>Name</span><span>Condition</span><span>Image</span>
    </div>
    <div class="sf2e-token-state-editor__rows" data-list="tokenStates">
      {#each config.tokenStates as row, index (row.id)}
        <article class="sf2e-token-state-editor__row" data-list="tokenStates" data-index={index} on:dragover={dragOver} on:drop={(e) => dropOn(e, "tokenStates", index)}>
          <div class="sf2e-token-state-editor__row-toolbar">
            <button type="button" draggable="true" data-action="drag-handle" title="Drag priority" on:dragstart={(e) => startDrag(e, "tokenStates", index)}>☰</button>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--type">
            <label>Name</label>
            <div class="form-fields">
              <input type="text" bind:value={row.name} placeholder="e.g. Bloodied In Combat" on:input={updateConfig} />
            </div>
          </div>

          <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--condition">
            <label>Conditions</label>
            <div class="form-fields">
              <input type="text" value={tokenStateConditionsSummary(row.conditions)} readonly />
              <button
                type="button"
                class="sf2e-token-state-editor__icon-button"
                on:click={() => openTokenStateConditionsConfig(index)}
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
                on:click={() => openTokenStateImageConfig(index)}
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
              on:click={() => removeRow("tokenStates", index)}
            >
              <i class="fa-solid fa-trash"></i>
            </button>
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
      <span>Row</span><span>Type</span><span>Condition</span><span>Sound</span>
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
                    on:change={(e) => setUiConditionOperator(row.condition, (e.currentTarget as HTMLSelectElement).value)}
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
                  <input type="number" min={row.condition.type === "hp-percent" ? 0 : undefined} max={row.condition.type === "hp-percent" ? 1 : undefined} step={row.condition.type === "hp-percent" ? 0.01 : 1} bind:value={row.condition.value} on:input={(e) => setUiConditionNumericValue(row.condition, Number((e.currentTarget as HTMLInputElement).value))} />
                </div>
              </div>
            {:else if row.condition.type === "in-combat"}
              <div class="form-group">
                <label>In Combat</label>
                <div class="form-fields">
                  <select value={String(row.condition.value)} on:change={(e) => setUiConditionCombatValue(row.condition, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            {:else if row.condition.type === "status-effect"}
              <div class="form-group">
                <label>Operator</label>
                <div class="form-fields">
                  <select value={row.condition.operator} on:change={(e) => setUiConditionOperator(row.condition, (e.currentTarget as HTMLSelectElement).value)}>
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
                              on:change={() => {
                                toggleStatusConditionValue(row.condition, option.slug);
                                updateConfig();
                              }}
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
              <input type="text" value={row.src} readonly />
              <button
                type="button"
                class="sf2e-token-state-editor__icon-button"
                on:click={() => openSoundConfig(index)}
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
              on:click={() => removeRow("sounds", index)}
            >
              <i class="fa-solid fa-trash"></i>
            </button>
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

  {#if imageConfigModal}
    <div class="sf2e-token-state-editor__modal-backdrop" on:pointerdown={closeImageConfigModal}>
      <section
        class="sf2e-token-state-editor__modal"
        on:pointerdown|stopPropagation
      >
        <header class="sf2e-token-state-editor__modal-header">
          <h1>Configure Image</h1>
        </header>

        <div class="sf2e-token-state-editor__modal-content">
          <div class="form-group">
            <label>Image Path</label>
            <div class="form-fields">
              <input type="text" bind:value={imageConfigModal.image} />
              <button type="button" on:click={browseImageConfigModal}>Browse</button>
            </div>
          </div>

          <div class="form-group">
            <label>Scale</label>
            <div class="form-fields">
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.05"
                bind:value={imageConfigModal.scale}
                on:input={(e) => (imageConfigModal = { ...imageConfigModal, scale: Number((e.currentTarget as HTMLInputElement).value) })}
              />
              <input
                type="number"
                min="0.1"
                max="3"
                step="0.05"
                bind:value={imageConfigModal.scale}
                on:input={(e) => (imageConfigModal = { ...imageConfigModal, scale: Number((e.currentTarget as HTMLInputElement).value) })}
              />
            </div>
          </div>

          <footer class="sf2e-token-state-editor__modal-footer">
            <button type="button" on:click={saveImageConfigModal}>Save Configuration</button>
            <button type="button" on:click={closeImageConfigModal}>Cancel</button>
          </footer>
        </div>
      </section>
    </div>
  {/if}

  {#if tokenStateConditionsConfigModal}
    <div class="sf2e-token-state-editor__modal-backdrop" on:pointerdown={closeTokenStateConditionsConfigModal}>
      <section
        class="sf2e-token-state-editor__modal sf2e-token-state-editor__modal--wide"
        on:pointerdown|stopPropagation
      >
        <header class="sf2e-token-state-editor__modal-header">
          <h1>Configure Conditions</h1>
        </header>

        <div class="sf2e-token-state-editor__modal-content">
          <div class="sf2e-token-state-editor__section-header">
            <h3>Conditions</h3>
            <button type="button" title="Add condition" on:click={addTokenStateConditionModalRow}>
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>

          <div class="sf2e-token-state-editor__condition-modal-header">
            <span>Type</span>
            <span>Condition Config</span>
            <span>Actions</span>
          </div>

          <div class="sf2e-token-state-editor__condition-modal-rows">
            {#each tokenStateConditionsConfigModal.conditions as condition, conditionIndex}
              <div class="sf2e-token-state-editor__condition-modal-row">
                <div class="form-group">
                  <label>Type</label>
                  <div class="form-fields">
                    <select
                      value={condition.type}
                      on:change={(e) => setTokenStateConditionModalType(conditionIndex, (e.currentTarget as HTMLSelectElement).value as ConditionType)}
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
                            updateTokenStateConditionModalCondition(conditionIndex, (c) => {
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
                              updateTokenStateConditionModalCondition(conditionIndex, (c) => {
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
                            updateTokenStateConditionModalCondition(conditionIndex, (c) => {
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
                            updateTokenStateConditionModalCondition(conditionIndex, (c) => {
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
                            updateTokenStateConditionModalCondition(conditionIndex, (c) => {
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
                              on:pointerdown|stopPropagation|preventDefault={() => (openConditionPickerKey = openConditionPickerKey === `token-state-modal:${conditionIndex}` ? null : `token-state-modal:${conditionIndex}`)}
                            >
                              <i class="fa-solid fa-gear"></i>
                            </button>
                          </div>
                          {#if openConditionPickerKey === `token-state-modal:${conditionIndex}`}
                            <div class="sf2e-token-state-editor__multiselect-popover">
                              {#each conditionOptions as option}
                                <label class="sf2e-token-state-editor__multiselect-option">
                                  <input
                                    type="checkbox"
                                    checked={condition.value.includes(option.slug)}
                                    on:change={() =>
                                      updateTokenStateConditionModalCondition(conditionIndex, (c) => {
                                        if (c.type !== "status-effect") return;
                                        toggleStatusConditionValue(c, option.slug);
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
                    on:click={() => removeTokenStateConditionModalRow(conditionIndex)}
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            {/each}
          </div>

          <footer class="sf2e-token-state-editor__modal-footer">
            <button type="button" on:click={saveTokenStateConditionsConfigModal}>Save Configuration</button>
            <button type="button" on:click={closeTokenStateConditionsConfigModal}>Cancel</button>
          </footer>
        </div>
      </section>
    </div>
  {/if}

  {#if soundConfigModal}
    <div class="sf2e-token-state-editor__modal-backdrop" on:pointerdown={closeSoundConfigModal}>
      <section
        class="sf2e-token-state-editor__modal"
        on:pointerdown|stopPropagation
      >
        <header class="sf2e-token-state-editor__modal-header">
          <h1>Configure Sound</h1>
        </header>

        <div class="sf2e-token-state-editor__modal-content">
          <div class="form-group">
            <label>Sound Path</label>
            <div class="form-fields">
              <input type="text" bind:value={soundConfigModal.src} />
              <button type="button" on:click={browseSoundConfigModal}>Browse</button>
            </div>
          </div>

          <div class="form-group">
            <label>Volume</label>
            <div class="form-fields">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                bind:value={soundConfigModal.volume}
                on:input={(e) => (soundConfigModal = { ...soundConfigModal, volume: Number((e.currentTarget as HTMLInputElement).value) })}
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                bind:value={soundConfigModal.volume}
                on:input={(e) => (soundConfigModal = { ...soundConfigModal, volume: Number((e.currentTarget as HTMLInputElement).value) })}
              />
            </div>
          </div>

          <footer class="sf2e-token-state-editor__modal-footer">
            <button type="button" on:click={saveSoundConfigModal}>Save Configuration</button>
            <button type="button" on:click={closeSoundConfigModal}>Cancel</button>
          </footer>
        </div>
      </section>
    </div>
  {/if}
</section>
