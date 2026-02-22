import { moduleId } from "./constants";
import { HooksManager } from "./hooksManager";

const tokenStateConfigEditorTemplate = `modules/${moduleId}/templates/token-state-config-editor.hbs`;

type NumericOperator = "<" | "<=" | ">" | ">=";
type StatusOperator = "any-of" | "all-of";

type UiCondition =
  | { type: "hp-percent"; operator: NumericOperator; value: number }
  | { type: "hp-value"; operator: NumericOperator; value: number }
  | { type: "in-combat"; value: boolean }
  | { type: "status-effect"; operator: StatusOperator; value: string[] };

export type TokenStateImageRuleConfig = {
  id: string;
  condition: UiCondition;
  image: string;
  scale: number;
};

export type SoundTriggerRuleConfig = {
  id: string;
  condition: UiCondition;
  src: string;
  volume: number;
};

export type TokenStateUiConfig = {
  version: 1;
  default: {
    bindExplicitly: boolean;
    image: string;
    scale: number;
  };
  tokenStates: TokenStateImageRuleConfig[];
  sounds: SoundTriggerRuleConfig[];
};

type EditorRowList = "tokenStates" | "sounds";

type EditorHost = {
  id?: string;
  title?: string;
};

const CONDITION_TYPE_OPTIONS: Array<{
  value: UiCondition["type"];
  label: string;
}> = [
  { value: "hp-percent", label: "HP Percent" },
  { value: "hp-value", label: "HP Value" },
  { value: "in-combat", label: "In Combat" },
  { value: "status-effect", label: "Status Effect" },
];

const NUMERIC_OPERATOR_OPTIONS: Array<{
  value: NumericOperator;
  label: string;
}> = [
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
];

function randomId(): string {
  const utils = (
    globalThis as { foundry?: { utils?: { randomID?: () => string } } }
  ).foundry?.utils;
  if (utils?.randomID) return utils.randomID();
  return Math.random().toString(36).slice(2, 10);
}

function defaultCondition(
  type: UiCondition["type"] = "hp-percent",
): UiCondition {
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

function createDefaultTokenStateRule(): TokenStateImageRuleConfig {
  return {
    id: randomId(),
    condition: defaultCondition("hp-percent"),
    image: "",
    scale: 1,
  };
}

function createDefaultSoundRule(): SoundTriggerRuleConfig {
  return {
    id: randomId(),
    condition: defaultCondition("in-combat"),
    src: "",
    volume: 0.8,
  };
}

function createDefaultConfig(): TokenStateUiConfig {
  return {
    version: 1,
    default: {
      bindExplicitly: true,
      image: "",
      scale: 1,
    },
    tokenStates: [],
    sounds: [],
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeCondition(raw: unknown): UiCondition {
  const input = (raw ?? {}) as Partial<UiCondition>;
  const type = input.type;
  if (type === "hp-percent") {
    return {
      type,
      operator: normalizeNumericOperator(
        (input as { operator?: unknown }).operator,
      ),
      value: clamp(Number((input as { value?: unknown }).value ?? 0.5), 0, 1),
    };
  }
  if (type === "hp-value") {
    return {
      type,
      operator: normalizeNumericOperator(
        (input as { operator?: unknown }).operator,
      ),
      value: Number((input as { value?: unknown }).value ?? 0),
    };
  }
  if (type === "in-combat") {
    return { type, value: Boolean((input as { value?: unknown }).value) };
  }
  if (type === "status-effect") {
    const operator =
      (input as { operator?: unknown }).operator === "all-of"
        ? "all-of"
        : "any-of";
    const value = Array.isArray((input as { value?: unknown }).value)
      ? ((input as { value: unknown[] }).value
          .map((entry) => String(entry).trim())
          .filter(Boolean) as string[])
      : [];
    return { type, operator, value };
  }
  return defaultCondition();
}

function normalizeNumericOperator(value: unknown): NumericOperator {
  switch (value) {
    case "<":
    case "<=":
    case ">":
    case ">=":
      return value;
    default:
      return "<=";
  }
}

function normalizeTokenStateRule(raw: unknown): TokenStateImageRuleConfig {
  const input = (raw ?? {}) as Partial<TokenStateImageRuleConfig>;
  return {
    id: typeof input.id === "string" && input.id ? input.id : randomId(),
    condition: normalizeCondition(input.condition),
    image: typeof input.image === "string" ? input.image : "",
    scale: clamp(Number(input.scale ?? 1), 0.1, 3),
  };
}

function normalizeSoundRule(raw: unknown): SoundTriggerRuleConfig {
  const input = (raw ?? {}) as Partial<SoundTriggerRuleConfig>;
  return {
    id: typeof input.id === "string" && input.id ? input.id : randomId(),
    condition: normalizeCondition(input.condition),
    src: typeof input.src === "string" ? input.src : "",
    volume: clamp(Number(input.volume ?? 0.8), 0, 1),
  };
}

export function normalizeTokenStateUiConfig(raw: unknown): TokenStateUiConfig {
  const input = (raw ?? {}) as Partial<TokenStateUiConfig>;
  return {
    version: 1,
    default: {
      bindExplicitly:
        typeof input.default?.bindExplicitly === "boolean"
          ? input.default.bindExplicitly
          : true,
      image:
        typeof input.default?.image === "string" ? input.default.image : "",
      scale: clamp(Number(input.default?.scale ?? 1), 0.1, 3),
    },
    tokenStates: Array.isArray(input.tokenStates)
      ? input.tokenStates.map((row) => normalizeTokenStateRule(row))
      : [],
    sounds: Array.isArray(input.sounds)
      ? input.sounds.map((row) => normalizeSoundRule(row))
      : [],
  };
}

export function validateTokenStateConfigJSON(
  json: unknown,
): TokenStateUiConfig | null | undefined {
  if (json === undefined) return undefined;
  if (json === "") return null;
  const parsed = JSON.parse(String(json));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Config must be an object");
  }
  return normalizeTokenStateUiConfig(parsed);
}

function getTokenConfigRootElement(html: unknown): HTMLElement | null {
  if (html instanceof HTMLElement) return html;
  const candidate = html as { 0?: unknown; length?: number };
  if (candidate?.[0] instanceof HTMLElement) return candidate[0];
  return null;
}

function getEventElementTarget(event: Event): HTMLElement | null {
  const target = event.target;
  if (target instanceof HTMLElement) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function getDragEventElementTarget(event: DragEvent): HTMLElement | null {
  const target = event.target;
  if (target instanceof HTMLElement) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function getInputValue(el: HTMLInputElement | HTMLSelectElement): string {
  return el.value;
}

function parseStatusValueText(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class TokenStateConfigEditorApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static override DEFAULT_OPTIONS = {
    classes: ["sf2e-token-state-config-editor-app"],
    position: {
      width: 1400,
      height: 760,
    },
    window: {
      title: "Token State Config Editor",
      resizable: true,
    },
  };

  static override PARTS = {
    main: {
      template: tokenStateConfigEditorTemplate,
      root: true,
      scrollable: [""],
    },
  };

  #config: TokenStateUiConfig;
  #targetField: HTMLTextAreaElement;
  #host: EditorHost;
  #dragState: { list: EditorRowList; index: number } | null = null;
  #listenerRoot: HTMLElement | null = null;

  constructor(options: {
    config: TokenStateUiConfig;
    targetField: HTMLTextAreaElement;
    host: EditorHost;
  }) {
    super({});
    this.#config = deepClone(options.config);
    this.#targetField = options.targetField;
    this.#host = options.host;
  }

  override get title(): string {
    const hostTitle = this.#host.title ? `: ${this.#host.title}` : "";
    return `Token State Config${hostTitle}`;
  }

  protected override async _prepareContext(): Promise<Record<string, unknown>> {
    const tokenStates = this.#config.tokenStates.map((row, index) =>
      this.#decorateRow("tokenStates", row, index),
    );
    const sounds = this.#config.sounds.map((row, index) =>
      this.#decorateRow("sounds", row, index),
    );

    return {
      config: this.#config,
      tokenStates,
      sounds,
      jsonPreview: JSON.stringify(this.#config, null, 2),
    };
  }

  protected override _attachPartListeners(
    _partId: string,
    htmlElement: HTMLElement,
  ): void {
    const listenerRoot = this.element ?? htmlElement;
    if (this.#listenerRoot === listenerRoot) return;

    this.#listenerRoot = listenerRoot;
    listenerRoot.addEventListener("click", (event) => this.#onClick(event));
    listenerRoot.addEventListener("change", (event) => this.#onChange(event));
    listenerRoot.addEventListener("input", (event) => this.#onInput(event));
    listenerRoot.addEventListener("dragstart", (event) =>
      this.#onDragStart(event),
    );
    listenerRoot.addEventListener("dragover", (event) =>
      this.#onDragOver(event),
    );
    listenerRoot.addEventListener("drop", (event) => this.#onDrop(event));
  }

  #decorateRow(
    _list: EditorRowList,
    row: TokenStateImageRuleConfig | SoundTriggerRuleConfig,
    index: number,
  ): Record<string, unknown> {
    const condition = row.condition;
    return {
      index,
      row,
      conditionTypeOptions: CONDITION_TYPE_OPTIONS.map((option) => ({
        ...option,
        selected: option.value === condition.type,
      })),
      operatorOptions: ("operator" in condition
        ? NUMERIC_OPERATOR_OPTIONS.map((option) => ({
            ...option,
            selected: option.value === condition.operator,
          }))
        : NUMERIC_OPERATOR_OPTIONS.map((option) => ({
            ...option,
            selected: false,
          }))) as Array<Record<string, unknown>> | undefined,
      isHpPercent: condition.type === "hp-percent",
      isHpValue: condition.type === "hp-value",
      isInCombat: condition.type === "in-combat",
      isStatusEffect: condition.type === "status-effect",
      conditionValue:
        "value" in condition && typeof condition.value === "number"
          ? condition.value
          : undefined,
      inCombatValueTrue:
        condition.type === "in-combat" && condition.value === true,
      inCombatValueFalse:
        condition.type === "in-combat" && condition.value === false,
      statusOperatorAny:
        condition.type === "status-effect" && condition.operator === "any-of",
      statusOperatorAll:
        condition.type === "status-effect" && condition.operator === "all-of",
      statusValueText:
        condition.type === "status-effect" ? condition.value.join(", ") : "",
    };
  }

  #scheduleRender(): void {
    void this.render();
  }

  #writeToTargetField(): void {
    const json = JSON.stringify(this.#config, null, 2);
    this.#targetField.value = json;
    this.#targetField.dispatchEvent(new Event("input", { bubbles: true }));
    this.#targetField.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #openPicker(
    type: "image" | "audio",
    current: string,
    onSelect: (path: string) => void,
  ): void {
    const Picker = (
      globalThis as {
        FilePicker?: new (...args: unknown[]) => {
          render: (show?: boolean) => void;
        };
      }
    ).FilePicker;
    if (!Picker) {
      ui.notifications.warn("FilePicker is not available in this client.");
      return;
    }

    const picker = new (Picker as new (options: Record<string, unknown>) => {
      render: (show?: boolean) => void;
    })({
      type,
      current,
      callback: (path: string) => {
        onSelect(path);
        this.#scheduleRender();
      },
    });
    picker.render(true);
  }

  #getList(
    list: EditorRowList,
  ): Array<TokenStateImageRuleConfig | SoundTriggerRuleConfig> {
    return this.#config[list] as Array<
      TokenStateImageRuleConfig | SoundTriggerRuleConfig
    >;
  }

  #replaceCondition(
    list: EditorRowList,
    index: number,
    type: UiCondition["type"],
  ): void {
    const rows = this.#getList(list);
    const row = rows[index];
    if (!row) return;
    row.condition = defaultCondition(type);
    this.#scheduleRender();
  }

  #setConditionField(
    list: EditorRowList,
    index: number,
    field: string,
    value: string,
    shouldRender = true,
  ): void {
    const rows = this.#getList(list);
    const row = rows[index];
    if (!row) return;
    const condition = row.condition;

    if (field === "operator" && "operator" in condition) {
      if (condition.type === "status-effect") {
        condition.operator = value === "all-of" ? "all-of" : "any-of";
      } else {
        condition.operator = normalizeNumericOperator(value);
      }
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (field === "value" && condition.type === "in-combat") {
      condition.value = value === "true";
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (
      field === "value" &&
      (condition.type === "hp-percent" || condition.type === "hp-value")
    ) {
      const n = Number(value);
      condition.value =
        condition.type === "hp-percent"
          ? clamp(n, 0, 1)
          : Number.isFinite(n)
            ? n
            : 0;
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (field === "valueText" && condition.type === "status-effect") {
      condition.value = parseStatusValueText(value);
      if (shouldRender) this.#scheduleRender();
    }
  }

  #setRowField(
    list: EditorRowList,
    index: number,
    field: string,
    value: string,
    shouldRender = true,
  ): void {
    const rows = this.#getList(list);
    const row = rows[index] as Record<string, unknown> | undefined;
    if (!row) return;

    if (field === "image" || field === "src") {
      row[field] = value;
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (field === "scale") {
      row.scale = clamp(Number(value), 0.1, 3);
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (field === "volume") {
      row.volume = clamp(Number(value), 0, 1);
      if (shouldRender) this.#scheduleRender();
    }
  }

  #onClick(event: Event): void {
    const target = getEventElementTarget(event);
    const button = target?.closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    if (!action) return;
    event.preventDefault();

    switch (action) {
      case "add-token-state":
        this.#config.tokenStates.push(createDefaultTokenStateRule());
        this.#scheduleRender();
        return;
      case "add-sound":
        this.#config.sounds.push(createDefaultSoundRule());
        this.#scheduleRender();
        return;
      case "remove-row": {
        const list = button.dataset.list as EditorRowList | undefined;
        const index = Number(button.dataset.index);
        if (!list || !Number.isInteger(index)) return;
        this.#getList(list).splice(index, 1);
        this.#scheduleRender();
        return;
      }
      case "pick-file": {
        const path = button.dataset.path;
        const pickerType =
          button.dataset.pickerType === "audio" ? "audio" : "image";
        if (!path) return;
        if (path === "default.image") {
          this.#openPicker(
            pickerType,
            this.#config.default.image,
            (selectedPath) => {
              this.#config.default.image = selectedPath;
            },
          );
        }
        return;
      }
      case "pick-row-file": {
        const list = button.dataset.list as EditorRowList | undefined;
        const index = Number(button.dataset.index);
        const field = button.dataset.field;
        const pickerType =
          button.dataset.pickerType === "audio" ? "audio" : "image";
        if (!list || !field || !Number.isInteger(index)) return;
        const row = this.#getList(list)[index] as
          | Record<string, unknown>
          | undefined;
        if (!row) return;
        this.#openPicker(
          pickerType,
          String(row[field] ?? ""),
          (selectedPath) => {
            row[field] = selectedPath;
          },
        );
        return;
      }
      case "save-config":
        this.#writeToTargetField();
        ui.notifications.info(
          "Token state config JSON applied to the token sheet form.",
        );
        return;
      case "close-editor":
        void this.close();
        return;
      default:
        return;
    }
  }

  #onChange(event: Event): void {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement
      )
    )
      return;

    if (target.dataset.path) {
      this.#onDefaultFieldChange(target, true);
      return;
    }

    const action = target.dataset.action;
    const list = target.dataset.list as EditorRowList | undefined;
    const index = Number(target.dataset.index);
    if (!action || !list || !Number.isInteger(index)) return;

    if (action === "set-condition-type") {
      this.#replaceCondition(
        list,
        index,
        getInputValue(target) as UiCondition["type"],
      );
      return;
    }

    if (action === "set-condition-field") {
      this.#setConditionField(
        list,
        index,
        String(target.dataset.field ?? ""),
        getInputValue(target),
        true,
      );
      return;
    }

    if (action === "set-row-field") {
      this.#setRowField(
        list,
        index,
        String(target.dataset.field ?? ""),
        getInputValue(target),
        true,
      );
    }
  }

  #onInput(event: Event): void {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement
      )
    )
      return;

    if (target.dataset.path) {
      this.#onDefaultFieldChange(target, false);
      return;
    }

    const action = target.dataset.action;
    if (action !== "set-row-field" && action !== "set-condition-field") return;

    const list = target.dataset.list as EditorRowList | undefined;
    const index = Number(target.dataset.index);
    if (!list || !Number.isInteger(index)) return;

    if (action === "set-condition-field") {
      this.#setConditionField(
        list,
        index,
        String(target.dataset.field ?? ""),
        getInputValue(target),
        false,
      );
      return;
    }

    this.#setRowField(
      list,
      index,
      String(target.dataset.field ?? ""),
      getInputValue(target),
      false,
    );
  }

  #onDefaultFieldChange(
    target: HTMLInputElement | HTMLSelectElement,
    shouldRender = true,
  ): void {
    const path = target.dataset.path;
    if (!path) return;

    if (path === "default.image" && target instanceof HTMLInputElement) {
      this.#config.default.image = target.value;
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (path === "default.scale" && target instanceof HTMLInputElement) {
      this.#config.default.scale = clamp(Number(target.value), 0.1, 3);
      if (shouldRender) this.#scheduleRender();
      return;
    }

    if (
      path === "default.bindExplicitly" &&
      target instanceof HTMLInputElement
    ) {
      this.#config.default.bindExplicitly = target.checked;
      if (shouldRender) this.#scheduleRender();
    }
  }

  #onDragStart(event: DragEvent): void {
    const target = getDragEventElementTarget(event);
    const handle = target?.closest<HTMLButtonElement>(
      'button[data-action="drag-handle"]',
    );
    if (!handle) return;

    const row = getDragEventElementTarget(event)?.closest<HTMLElement>(
      ".sf2e-token-state-editor__row[data-list][data-index]",
    );
    if (!row) return;
    const list = row.dataset.list as EditorRowList | undefined;
    const index = Number(row.dataset.index);
    if (!list || !Number.isInteger(index)) return;
    this.#dragState = { list, index };
    event.dataTransfer?.setData("text/plain", `${list}:${index}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  #onDragOver(event: DragEvent): void {
    const row = getDragEventElementTarget(event)?.closest<HTMLElement>(
      ".sf2e-token-state-editor__row[data-list][data-index]",
    );
    if (!row) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  #onDrop(event: DragEvent): void {
    const row = getDragEventElementTarget(event)?.closest<HTMLElement>(
      ".sf2e-token-state-editor__row[data-list][data-index]",
    );
    if (!row || !this.#dragState) return;
    event.preventDefault();

    const toList = row.dataset.list as EditorRowList | undefined;
    const toIndex = Number(row.dataset.index);
    const { list: fromList, index: fromIndex } = this.#dragState;
    this.#dragState = null;

    if (!toList || !Number.isInteger(toIndex) || fromList !== toList) return;
    if (fromIndex === toIndex) return;

    const rows = this.#getList(toList);
    const [moved] = rows.splice(fromIndex, 1);
    if (!moved) return;
    rows.splice(toIndex, 0, moved);
    this.#scheduleRender();
  }
}

function attachTokenSheetEditorButton(app: unknown, html: unknown): void {
  const root = getTokenConfigRootElement(html);
  if (!root) return;

  const button = root.querySelector<HTMLButtonElement>(
    '[data-action="open-token-state-config-editor"]',
  );
  const field = root.querySelector<HTMLTextAreaElement>(
    'textarea[data-role="token-state-config-json"]',
  );
  if (!button || !field) return;
  if (button.dataset.boundClick === "true") return;

  button.dataset.boundClick = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();

    let config = createDefaultConfig();
    try {
      const parsed = validateTokenStateConfigJSON(field.value);
      config = parsed ?? createDefaultConfig();
    } catch (error) {
      ui.notifications.warn(
        `Invalid structured config JSON. Loading defaults in editor: ${(error as Error).message}`,
      );
    }

    const host = app as EditorHost;
    const editor = new TokenStateConfigEditorApplication({
      config,
      targetField: field,
      host,
    });
    void editor.render(true);
  });
}

const hooks = new HooksManager();
export function registerTokenStateConfigEditorHooks(): void {
  hooks.on("renderTokenConfig", (app, html) => {
    attachTokenSheetEditorButton(app, html);
  });

  hooks.on("renderPrototypeTokenConfig", (app, html) => {
    attachTokenSheetEditorButton(app, html);
  });
}

export function unregisterTokenStateConfigEditorHooks(): void {
  hooks.off();
}

export function getTokenStateConfigEditorTemplatePath(): string {
  return tokenStateConfigEditorTemplate;
}
