import { ActorPF2e } from "foundry-pf2e";
import { PrototypeToken } from "foundry-pf2e/foundry/common/data/data.mjs";
import { mount, unmount } from "svelte";
import TokenStateConfigEditor from "../svelte/TokenStateConfigEditor.svelte";
import { moduleId } from "./constants";
import { HooksManager } from "./hooksManager";
import type {
  Condition,
  NumericOperator,
  SoundTriggerRuleConfig,
  TokenStateConfig,
  TokenStateImageRuleConfig,
} from "./types";

type TokenOrPrototype =
  | foundry.documents.TokenDocument
  | PrototypeToken<ActorPF2e>;

const tokenStateConfigEditorTemplate = `modules/${moduleId}/templates/token-state-config-editor-shell.hbs`;

function randomId(): string {
  const utils = (
    globalThis as { foundry?: { utils?: { randomID?: () => string } } }
  ).foundry?.utils;
  if (utils?.randomID) return utils.randomID();
  return Math.random().toString(36).slice(2, 10);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function defaultCondition(type: Condition["type"] = "hp-percent"): Condition {
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

export function createDefaultTokenStateConfig(
  token: TokenOrPrototype,
): TokenStateConfig {
  return {
    version: 1,
    default: getDefaultImage(token),
    tokenStates: [],
    sounds: [],
  };
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

function normalizeCondition(raw: unknown): Condition {
  const input = (raw ?? {}) as Partial<Condition>;
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

function normalizeTokenStateRule(raw: unknown): TokenStateImageRuleConfig {
  const input = (raw ?? {}) as Partial<TokenStateImageRuleConfig> & {
    condition?: unknown;
    conditions?: unknown;
  };
  const normalizedConditions = Array.isArray(input.conditions)
    ? input.conditions.map((condition) => normalizeCondition(condition))
    : input.condition !== undefined
      ? [normalizeCondition(input.condition)]
      : [defaultCondition()];
  return {
    id: typeof input.id === "string" && input.id ? input.id : randomId(),
    name: typeof input.name === "string" ? input.name : "",
    conditions: normalizedConditions,
    image: typeof input.image === "string" ? input.image : "",
    scale: clamp(Number(input.scale ?? 1), 0.1, 3),
  };
}

function normalizeSoundRule(raw: unknown): SoundTriggerRuleConfig {
  const input = (raw ?? {}) as Partial<SoundTriggerRuleConfig> & {
    condition?: unknown;
    trigger?: unknown;
    conditions?: unknown;
  };
  const normalizedTrigger =
    input.trigger !== undefined
      ? normalizeCondition(input.trigger)
      : input.condition !== undefined
        ? normalizeCondition(input.condition)
        : defaultCondition("in-combat");
  const normalizedConditions = Array.isArray(input.conditions)
    ? input.conditions.map((condition) => normalizeCondition(condition))
    : [];
  return {
    id: typeof input.id === "string" && input.id ? input.id : randomId(),
    name: typeof input.name === "string" ? input.name : "",
    trigger: normalizedTrigger,
    conditions: normalizedConditions,
    src: typeof input.src === "string" ? input.src : "",
    volume: clamp(Number(input.volume ?? 0.8), 0, 1),
  };
}

export function normalizeTokenStateConfig(raw: unknown): TokenStateConfig {
  const input = (raw ?? {}) as Partial<TokenStateConfig>;
  return {
    version: 1,
    default: {
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getDefaultImage(token: TokenOrPrototype): {
  image: string;
  scale: number;
} {
  if (token.ring.enabled) {
    return {
      image: token.ring.subject.texture ?? token.texture.src ?? "",
      scale: token.ring.subject.scale ?? token.texture.scaleX,
    };
  }

  return { image: token.texture.src ?? "", scale: token.texture.scaleX };
}

class TokenStateConfigEditorApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static override DEFAULT_OPTIONS = {
    classes: ["sf2e-token-state-config-editor-app"],
    position: { width: 1000, height: 846 },
    window: { title: "Token State Config Editor", resizable: false },
  };

  static override PARTS = {
    main: {
      template: tokenStateConfigEditorTemplate,
      root: true,
      scrollable: [""],
    },
  };

  #config: TokenStateConfig;
  #targetToken: TokenOrPrototype;
  #svelteApp: object | null = null;
  #mountedRoot: HTMLElement | null = null;

  constructor(options: {
    config: TokenStateConfig;
    targetToken: TokenOrPrototype;
  }) {
    super({});
    this.#config = deepClone(options.config);
    this.#targetToken = options.targetToken;
  }

  override get title(): string {
    const hostTitle = this.#targetToken.name
      ? `: ${this.#targetToken.name}`
      : "";
    return `Token State Config${hostTitle}`;
  }

  protected override async _prepareContext(): Promise<Record<string, unknown>> {
    return {};
  }

  protected override _attachPartListeners(
    _partId: string,
    htmlElement: HTMLElement,
  ): void {
    const root = this.element ?? htmlElement;
    const mountRoot = root.querySelector<HTMLElement>(
      '[data-role="token-state-config-editor-mount"]',
    );
    if (!mountRoot) return;
    if (this.#mountedRoot === mountRoot && this.#svelteApp) return;

    if (this.#svelteApp) {
      void unmount(this.#svelteApp as never);
      this.#svelteApp = null;
    }

    this.#mountedRoot = mountRoot;
    this.#svelteApp = mount(TokenStateConfigEditor as never, {
      target: mountRoot,
      props: {
        initialConfig: deepClone(this.#config),
        onApply: async (nextConfig: TokenStateConfig) => {
          this.#config = deepClone(nextConfig);
          try {
            await this.#targetToken.setFlag(moduleId, "config", this.#config);
            ui.notifications.info("Token state config saved.");
            void this.close();
          } catch (error) {
            ui.notifications.error(
              `Failed to save token state config: ${(error as Error).message}`,
            );
          }
        },
        onClose: () => {
          void this.close();
        },
        openFilePicker: (type: "image" | "audio", current: string) =>
          this.#openFilePicker(type, current),
      },
    }) as object;
  }

  override async close(options?: unknown): Promise<this> {
    if (this.#svelteApp) {
      await unmount(this.#svelteApp as never);
      this.#svelteApp = null;
      this.#mountedRoot = null;
    }
    return await super.close(options as never);
  }

  async #openFilePicker(
    type: "image" | "audio",
    current: string,
  ): Promise<string | null> {
    const Picker = (
      globalThis as {
        FilePicker?: new (options: Record<string, unknown>) => {
          render: (show?: boolean) => void;
        };
      }
    ).FilePicker;

    if (!Picker) {
      ui.notifications.warn("FilePicker is not available in this client.");
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      const picker = new Picker({
        type,
        current,
        callback: (path: string) => resolve(path),
      });
      picker.render(true);
    });
  }
}

function attachTokenSheetEditorButton(
  token: foundry.documents.TokenDocument | PrototypeToken<ActorPF2e>,
  html: HTMLElement,
): void {
  const button = html.querySelector<HTMLButtonElement>(
    '[data-action="open-token-state-config-editor"]',
  );
  if (!button) return;
  if (button.dataset.boundClick === "true") return;

  button.dataset.boundClick = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();

    let config = createDefaultTokenStateConfig(token);
    const currentConfig = token.getFlag(moduleId, "config");
    if (currentConfig && typeof currentConfig === "object") {
      config = normalizeTokenStateConfig(currentConfig);
    }

    const editor = new TokenStateConfigEditorApplication({
      config,
      targetToken: token,
    });
    void editor.render(true);
  });
}

function syncToPrototype(token: foundry.documents.TokenDocument) {
  const prototype = token.actor?.prototypeToken;
  if (!prototype) return;

  const tokenConfig = token.getFlag(moduleId, "config");
  prototype.unsetFlag(moduleId, "config");
  prototype.setFlag(moduleId, "config", foundry.utils.deepClone(tokenConfig));
}

function syncFromPrototype(token: foundry.documents.TokenDocument) {
  const prototype = token.actor?.prototypeToken;
  if (!prototype) return;

  const prototypeConfig = prototype.getFlag(moduleId, "config");
  token.unsetFlag(moduleId, "config");
  token.setFlag(moduleId, "config", foundry.utils.deepClone(prototypeConfig));
}

function attachTokenPrototypeButtons(
  token: PrototypeToken<ActorPF2e>,
  html: HTMLElement,
) {
  attachTokenSheetEditorButton(token, html);

  const button = html.querySelector<HTMLButtonElement>(
    '.sf2e-token-state-tab__sync-actions [data-action="sync-to-tokens"]',
  );
  if (!button) return;
  if (button.dataset.boundClick === "true") return;

  button.dataset.boundClick = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
  });
}

function attachTokenButtons(
  token: foundry.documents.TokenDocument,
  html: HTMLElement,
) {
  attachTokenSheetEditorButton(token, html);

  // Sync to prototype
  let button = html.querySelector<HTMLButtonElement>(
    '.sf2e-token-state-tab__sync-actions [data-action="sync-to-prototype"]',
  );
  if (!button) return;
  if (button.dataset.boundClick === "true") return;

  button.dataset.boundClick = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    syncToPrototype(token);
  });

  // Sync from prototype
  button = html.querySelector<HTMLButtonElement>(
    '.sf2e-token-state-tab__sync-actions [data-action="sync-from-prototype"]',
  );
  if (!button) return;
  if (button.dataset.boundClick === "true") return;

  button.dataset.boundClick = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    syncFromPrototype(token);
  });
}

const hooks = new HooksManager();
export function registerTokenStateConfigEditorHooks(): void {
  hooks.on("renderTokenConfig", (app, html) => {
    attachTokenButtons(app.document, html);
  });

  hooks.on("renderPrototypeTokenConfig", (app, html) => {
    attachTokenPrototypeButtons(app.token, html);
  });
}

export function unregisterTokenStateConfigEditorHooks(): void {
  hooks.off();
}

export function getTokenStateConfigEditorTemplatePath(): string {
  return tokenStateConfigEditorTemplate;
}
