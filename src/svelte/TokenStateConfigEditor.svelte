<script lang="ts">
  import {
    clamp,
    conditionDisplayText as conditionDisplayTextHelper,
    conditionTypeOptions,
    defaultCondition,
    numericOperatorOptions,
  } from "./helpers/conditions";
  import type { ConditionOption, ConditionType, UiCondition } from "./helpers/conditions";
  import type {
    ImageConfigModalState,
    ImageConfigTarget,
    SoundConditionsConfigModalState,
    SoundConditionsConfigTarget,
    SoundConfigModalState,
    SoundConfigTarget,
    SoundTriggerRuleConfig,
    TokenStateConditionsConfigModalState,
    TokenStateConditionsConfigTarget,
    TokenStateImageRuleConfig,
    TokenStateUiConfig,
  } from "./helpers/editor-types";
  import ImageConfigModal from "./components/ImageConfigModal.svelte";
  import SoundConditionsConfigModal from "./components/SoundConditionsConfigModal.svelte";
  import SoundConfigModal from "./components/SoundConfigModal.svelte";
  import SoundRow from "./components/SoundRow.svelte";
  import TokenStateConditionsModal from "./components/TokenStateConditionsModal.svelte";
  import TokenStateRow from "./components/TokenStateRow.svelte";

  type EditorRowList = "tokenStates" | "sounds";
  type Row = TokenStateImageRuleConfig | SoundTriggerRuleConfig;

  export let initialConfig: TokenStateUiConfig;
  export let onApply: (config: TokenStateUiConfig) => void;
  export let onClose: () => void;
  export let openFilePicker: (type: "image" | "audio", current: string) => Promise<string | null>;

  let config: TokenStateUiConfig = deepClone(initialConfig);
  let dragState: { list: EditorRowList; index: number } | null = null;
  let conditionOptions: ConditionOption[] = getConditionOptions();
  let imageConfigModal: ImageConfigModalState | null = null;
  let soundConfigModal: SoundConfigModalState | null = null;
  let tokenStateConditionsConfigModal: TokenStateConditionsConfigModalState | null = null;
  let soundConditionsConfigModal: SoundConditionsConfigModalState | null = null;
  let hasAttemptedSave = false;

  $: jsonPreview = JSON.stringify(toSerializableConfig(config), null, 2);

  function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function notifyWarn(message: string): void {
    const notifications = (globalThis as { ui?: { notifications?: { warn?: (msg: string) => void } } }).ui?.notifications;
    notifications?.warn?.(message);
  }

  function randomId(): string {
    const utils = (globalThis as { foundry?: { utils?: { randomID?: () => string } } }).foundry?.utils;
    if (utils?.randomID) return utils.randomID();
    return Math.random().toString(36).slice(2, 10);
  }

  function toSerializableConfig(value: TokenStateUiConfig): Omit<TokenStateUiConfig, "tokenStates" | "sounds"> & {
    tokenStates: Array<Omit<TokenStateImageRuleConfig, "id">>;
    sounds: Array<Omit<SoundTriggerRuleConfig, "id">>;
  } {
    return {
      version: value.version,
      default: deepClone(value.default),
      tokenStates: value.tokenStates.map(({ id: _id, ...row }) => deepClone(row)),
      sounds: value.sounds.map(({ id: _id, ...row }) => deepClone(row)),
    };
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
      {
        id: randomId(),
        name: "",
        trigger: defaultCondition("hp-percent"),
        conditions: [],
        src: "",
        volume: 0.8,
      },
    ];
  }

  function removeRow(list: EditorRowList, index: number): void {
    const rows = [...config[list]];
    rows.splice(index, 1);
    config = { ...config, [list]: rows } as TokenStateUiConfig;
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

  function getConditionOptions(): ConditionOption[] {
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
  }

  function openSoundConditionsConfig(index: number): void {
    const row = config.sounds[index];
    if (!row) return;
    soundConditionsConfigModal = {
      target: { index },
      trigger: deepClone(row.trigger),
      conditions: deepClone(row.conditions),
    };
  }

  function closeSoundConditionsConfigModal(): void {
    soundConditionsConfigModal = null;
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
  }

  function saveSoundConditionsConfigModal(): void {
    if (!soundConditionsConfigModal) return;
    const row = config.sounds[soundConditionsConfigModal.target.index];
    if (!row) return;
    row.trigger = deepClone(soundConditionsConfigModal.trigger);
    row.conditions = deepClone(soundConditionsConfigModal.conditions);
    updateConfig();
    soundConditionsConfigModal = null;
  }

  async function browseImageConfigModal(): Promise<void> {
    if (!imageConfigModal) return;
    const selected = await openFilePicker("image", imageConfigModal.image);
    if (!selected) return;
    imageConfigModal = { ...imageConfigModal, image: selected };
  }

  function saveImageConfigModal(): void {
    if (!imageConfigModal) return;
    if (!imageConfigModal.image.trim()) {
      notifyWarn("Image cannot be empty.");
      return;
    }
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
    if (!soundConfigModal.src.trim()) {
      notifyWarn("Sound cannot be empty.");
      return;
    }
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
    return conditionDisplayTextHelper(values, conditionOptions);
  }

  function validateCondition(condition: UiCondition, path: string): string | null {
    if (condition.type !== "status-effect") return null;
    if (condition.value.length > 0) return null;
    return `${path}: status conditions cannot be empty.`;
  }

  function validateConfigBeforeSave(): string | null {
    if (!config.default.image.trim()) {
      return "Default image cannot be empty.";
    }

    for (const [index, row] of config.tokenStates.entries()) {
      if (!row.image.trim()) {
        return `Token state row ${index + 1}: image cannot be empty.`;
      }
      for (const [conditionIndex, condition] of row.conditions.entries()) {
        const error = validateCondition(
          condition,
          `Token state row ${index + 1}, condition ${conditionIndex + 1}`,
        );
        if (error) return error;
      }
    }

    for (const [index, row] of config.sounds.entries()) {
      if (!row.src.trim()) {
        return `Sound row ${index + 1}: sound cannot be empty.`;
      }
      const triggerError = validateCondition(
        row.trigger,
        `Sound row ${index + 1}, trigger`,
      );
      if (triggerError) return triggerError;
      for (const [conditionIndex, condition] of row.conditions.entries()) {
        const error = validateCondition(
          condition,
          `Sound row ${index + 1}, condition ${conditionIndex + 1}`,
        );
        if (error) return error;
      }
    }

    return null;
  }

  function saveConfig(): void {
    hasAttemptedSave = true;
    const error = validateConfigBeforeSave();
    if (error) {
      notifyWarn(error);
      return;
    }
    onApply(toSerializableConfig(config) as unknown as TokenStateUiConfig);
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

<section class="sf2e-token-state-editor svelte-editor">
  <section class="sf2e-token-state-editor__section">
    <h3>Default</h3>
    <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--default">
      <span>Image</span>
    </div>
    <article class="sf2e-token-state-editor__row sf2e-token-state-editor__row--default">
      <div class="form-group sf2e-token-state-editor__cell sf2e-token-state-editor__cell--asset">
        <label>Image</label>
        <div class="form-fields">
          <input
            type="text"
            readonly
            value={hasAttemptedSave && !config.default.image.trim() ? "Default image is required." : config.default.image}
            class:sf2e-token-state-editor__input-error={hasAttemptedSave && !config.default.image.trim()}
          />
          <button type="button" class="sf2e-token-state-editor__icon-button" on:click={openDefaultImageConfig} title="Configure image">
            <i class="fa-solid fa-gear"></i>
          </button>
        </div>
      </div>
    </article>
  </section>

  <section class="sf2e-token-state-editor__section">
    <div class="sf2e-token-state-editor__section-header">
      <h3>Token States</h3>
      <button type="button" on:click={addTokenState}><i class="fa-solid fa-plus"></i></button>
    </div>
    <div class="sf2e-token-state-editor__section-content">
      {#if config.tokenStates.length === 0}
        <p class="sf2e-token-state-editor__empty-state">No token states configured</p>
      {:else}
        <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--token">
          <span>Row</span><span>Name</span><span>Condition</span><span>Image</span>
        </div>
        <div class="sf2e-token-state-editor__rows" data-list="tokenStates">
          {#each config.tokenStates as row, index (row.id)}
            <TokenStateRow
              {row}
              {index}
              showValidation={hasAttemptedSave}
              onNameInput={updateConfig}
              onOpenConditions={openTokenStateConditionsConfig}
              onOpenImage={openTokenStateImageConfig}
              onRemove={(rowIndex) => removeRow("tokenStates", rowIndex)}
              onDragStart={(event, rowIndex) => startDrag(event, "tokenStates", rowIndex)}
              onDragOver={dragOver}
              onDrop={(event, rowIndex) => dropOn(event, "tokenStates", rowIndex)}
            />
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <section class="sf2e-token-state-editor__section">
    <div class="sf2e-token-state-editor__section-header">
      <h3>Sounds</h3>
      <button type="button" on:click={addSound}><i class="fa-solid fa-plus"></i></button>
    </div>
    <div class="sf2e-token-state-editor__section-content">
      {#if config.sounds.length === 0}
        <p class="sf2e-token-state-editor__empty-state">No sounds configured</p>
      {:else}
        <div class="sf2e-token-state-editor__row-header sf2e-token-state-editor__row-header--sound">
          <span>Row</span><span>Name</span><span>Condition</span><span>Sound</span>
        </div>
        <div class="sf2e-token-state-editor__rows" data-list="sounds">
          {#each config.sounds as row, index (row.id)}
            <SoundRow
              {row}
              {index}
              showValidation={hasAttemptedSave}
              onNameInput={updateConfig}
              onOpenConditions={openSoundConditionsConfig}
              onOpenSound={openSoundConfig}
              onRemove={(rowIndex) => removeRow("sounds", rowIndex)}
              onDragStart={(event, rowIndex) => startDrag(event, "sounds", rowIndex)}
              onDragOver={dragOver}
              onDrop={(event, rowIndex) => dropOn(event, "sounds", rowIndex)}
            />
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <footer class="sf2e-token-state-editor__footer">
    <button type="button" on:click={saveConfig}>Save</button>
    <button type="button" on:click={onClose}>Close</button>
  </footer>

  {#if imageConfigModal}
    <ImageConfigModal
      bind:modal={imageConfigModal}
      onClose={closeImageConfigModal}
      onBrowse={browseImageConfigModal}
      onSave={saveImageConfigModal}
    />
  {/if}

  {#if tokenStateConditionsConfigModal}
    <TokenStateConditionsModal
      bind:modal={tokenStateConditionsConfigModal}
      {conditionTypeOptions}
      {numericOperatorOptions}
      {conditionOptions}
      {conditionDisplayText}
      onClose={closeTokenStateConditionsConfigModal}
      onSave={saveTokenStateConditionsConfigModal}
    />
  {/if}

  {#if soundConditionsConfigModal}
    <SoundConditionsConfigModal
      bind:modal={soundConditionsConfigModal}
      {conditionTypeOptions}
      {numericOperatorOptions}
      {conditionOptions}
      {conditionDisplayText}
      onClose={closeSoundConditionsConfigModal}
      onSave={saveSoundConditionsConfigModal}
    />
  {/if}

  {#if soundConfigModal}
    <SoundConfigModal
      bind:modal={soundConfigModal}
      onClose={closeSoundConfigModal}
      onBrowse={browseSoundConfigModal}
      onSave={saveSoundConfigModal}
    />
  {/if}
</section>
