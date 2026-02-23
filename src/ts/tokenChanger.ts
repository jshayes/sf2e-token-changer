import { moduleId } from "./constants";
import { HooksManager } from "./hooksManager";
import {
  getTokenStateConfigEditorTemplatePath,
  validateTokenStateConfigJSON,
} from "./tokenStateConfigEditor";
import { TokenStateConfig } from "./types";

const tokenConfigTemplate = `modules/${moduleId}/templates/token-config.hbs`;
const tokenImageFieldTemplate = `modules/${moduleId}/templates/components/token-image-field.hbs`;

type HpPercentCondition = {
  type: "hp-percent";
  operator: "<" | "<=" | ">" | ">=";
  value: number;
};

type CombatCondition = {
  type: "combat";
  value: boolean;
};

type StatusEffectCondition = {
  type: "status-effect";
  operator: "any-of" | "all-of";
  value: string[];
};

type RuleCondition =
  | HpPercentCondition
  | CombatCondition
  | StatusEffectCondition;

type TokenUpdateEffect = {
  type: "token-update";
  value: Record<string, unknown>;
};

type PlaySoundEffect = {
  type: "play-sound";
  src: string;
  volume?: number;
};

type RuleEffect = TokenUpdateEffect | PlaySoundEffect;

type TokenRule = {
  id: string;
  triggers: RuleCondition[];
  effects: RuleEffect[];
};

type ModuleTokenFlags = {
  rules?: TokenRule[];
  rulesJSON?: string;
  config?: TokenStateConfig | null;
  configJSON?: string;
  _defaults?: {
    ring?: unknown;
    texture?: unknown;
  };
  state?: string | null;
};

type ApplyStateSocketPayload = {
  type: "applyState";
  sceneId: string;
  tokenIds: string[];
};

type TokenOrPlaceable = TokenDocument | { document: TokenDocument };

function asTokenDocument(
  token: TokenOrPlaceable | null | undefined,
): TokenDocument | undefined {
  if (!token) return undefined;
  if ("document" in token) return token.document;
  return token;
}

function isApplyStateSocketPayload(
  value: unknown,
): value is ApplyStateSocketPayload {
  const payload = value as Partial<ApplyStateSocketPayload> | null | undefined;
  return (
    payload?.type === "applyState" &&
    typeof payload.sceneId === "string" &&
    Array.isArray(payload.tokenIds)
  );
}

async function loadModuleTemplates(paths: string[]): Promise<void> {
  const loader = (
    globalThis as { loadTemplates?: (templates: string[]) => Promise<unknown> }
  ).loadTemplates;
  if (!loader) return;
  await loader(paths);
}

function addTokenStatesTab(sheetClass: {
  TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
  PARTS?: Record<string, unknown>;
}): void {
  sheetClass.TABS?.sheet?.tabs?.push({
    id: moduleId,
    label: "Token States",
    icon: "fa-solid fa-grid",
  });

  if (!sheetClass.PARTS) return;

  const footer = sheetClass.PARTS.footer;
  delete sheetClass.PARTS.footer;

  sheetClass.PARTS[moduleId] = {
    template: tokenConfigTemplate,
    scrollable: [""],
  };

  sheetClass.PARTS.footer = footer;
}

function validateRulesJSON(json: unknown): TokenRule[] | null | undefined {
  if (json === undefined) return undefined;
  if (json === "") return null;

  const parsed = JSON.parse(String(json));
  if (!Array.isArray(parsed)) {
    throw new Error("Rules must be an array");
  }

  return parsed as TokenRule[];
}

function getModuleFlags(token: TokenDocument): ModuleTokenFlags {
  return ((token.flags as Record<string, unknown>)[moduleId] ??
    {}) as ModuleTokenFlags;
}

function checkHpPercentCondition(
  condition: HpPercentCondition,
  token: TokenDocument,
): boolean {
  const actor = token.actor as
    | {
        system?: {
          attributes?: {
            hp?: { value?: number; max?: number };
          };
        };
      }
    | null
    | undefined;

  const hp = actor?.system?.attributes?.hp;
  const value = hp?.value ?? 0;
  const max = hp?.max ?? 0;
  const hpPerc = max > 0 ? value / max : 0;

  switch (condition.operator) {
    case "<":
      return hpPerc < condition.value;
    case "<=":
      return hpPerc <= condition.value;
    case ">":
      return hpPerc > condition.value;
    case ">=":
      return hpPerc >= condition.value;
    default:
      return false;
  }
}

function checkCombatCondition(
  condition: CombatCondition,
  token: TokenDocument,
): boolean {
  return (
    Boolean((token as TokenDocument & { inCombat?: boolean }).inCombat) ===
    condition.value
  );
}

function checkStatusEffectCondition(
  condition: StatusEffectCondition,
  token: TokenDocument,
): boolean {
  const actor = token.actor as
    | {
        conditions?: {
          active?: Array<{ slug?: string }>;
        };
      }
    | null
    | undefined;

  const matchedConditions = (actor?.conditions?.active ?? []).filter((entry) =>
    condition.value.includes(String(entry.slug ?? "")),
  );

  switch (condition.operator) {
    case "any-of":
      return matchedConditions.length > 0;
    case "all-of":
      return matchedConditions.length === condition.value.length;
    default:
      return false;
  }
}

function checkRule(rule: TokenRule, token: TokenDocument): boolean {
  for (const condition of rule.triggers ?? []) {
    switch (condition.type) {
      case "hp-percent":
        if (!checkHpPercentCondition(condition, token)) return false;
        break;
      case "combat":
        if (!checkCombatCondition(condition, token)) return false;
        break;
      case "status-effect":
        if (!checkStatusEffectCondition(condition, token)) return false;
        break;
      default:
        return false;
    }
  }

  return true;
}

function findHighestPriorityRule(token: TokenDocument): TokenRule | undefined {
  const rules = getModuleFlags(token).rules;
  return rules?.find((rule) => checkRule(rule, token));
}

function getActions(tokens: TokenDocument[]): {
  tokenUpdates: Record<string, Record<string, unknown>[]>;
  soundsToPlay: Array<{ src: string; volume?: number; loop: boolean }>;
} {
  const tokenUpdates: Record<
    string,
    Record<string, Record<string, unknown>>
  > = {};
  const soundsToPlay: Array<{ src: string; volume?: number; loop: boolean }> =
    [];

  const queueTokenUpdate = (
    token: TokenDocument,
    update: Record<string, unknown>,
  ) => {
    const sceneId = String(token.parent?.id ?? "");
    if (!sceneId) return;

    const sceneUpdates = (tokenUpdates[sceneId] ??= {});
    const tokenId = String(token.id);
    const existing = (sceneUpdates[tokenId] ??= { _id: tokenId });
    foundry.utils.mergeObject(existing, update, { inplace: true });
  };

  for (const token of tokens) {
    const flags = getModuleFlags(token);
    if (!flags.rules) continue;

    const rule = findHighestPriorityRule(token);
    if (!rule) {
      if (flags._defaults) {
        queueTokenUpdate(token, {
          ...flags._defaults,
          [`flags.${moduleId}.-=_defaults`]: null,
        });
      }
      queueTokenUpdate(token, { [`flags.${moduleId}.state`]: null });
      continue;
    }

    const tokenUpdate: Record<string, unknown> = {};
    if (!flags._defaults) {
      tokenUpdate[`flags.${moduleId}._defaults`] = {
        ring: token.ring,
        texture: token.texture,
      };
    }

    const shouldSkipSound = flags.state === rule.id;
    tokenUpdate[`flags.${moduleId}.state`] = rule.id;
    let queuedTokenUpdate = false;

    for (const effect of rule.effects ?? []) {
      switch (effect.type) {
        case "token-update": {
          const currentRingTexture = (
            token.ring as { subject?: { texture?: unknown } } | undefined
          )?.subject?.texture;
          const nextRingTexture = (
            effect.value.ring as { subject?: { texture?: unknown } } | undefined
          )?.subject?.texture;

          if (currentRingTexture !== nextRingTexture) {
            queueTokenUpdate(token, { ...tokenUpdate, ...effect.value });
            queuedTokenUpdate = true;
          }
          break;
        }
        case "play-sound": {
          if (!shouldSkipSound) {
            soundsToPlay.push({
              src: effect.src,
              volume: effect.volume,
              loop: false,
            });
          }
          break;
        }
      }
    }

    if (!queuedTokenUpdate) {
      queueTokenUpdate(token, tokenUpdate);
    }
  }

  const updatesByScene = Object.fromEntries(
    Object.entries(tokenUpdates).map(([sceneId, updates]) => [
      sceneId,
      Object.values(updates),
    ]),
  );

  return {
    tokenUpdates: updatesByScene,
    soundsToPlay,
  };
}

async function handleTokenEvents(
  tokens: Array<TokenDocument | null | undefined>,
  skipSound = false,
): Promise<void> {
  const cleanTokens = tokens.filter((token): token is TokenDocument =>
    Boolean(token),
  );

  if (!game.user.isGM) {
    if (canvas.scene) {
      const tokenIds = cleanTokens
        .filter((token) => Boolean(canvas.tokens.get(token.id)))
        .map((token) => token.id);

      game.socket.emit(`module.${moduleId}`, {
        type: "applyState",
        sceneId: canvas.scene.id,
        tokenIds,
      } satisfies ApplyStateSocketPayload);
    }
    return;
  }

  const { tokenUpdates, soundsToPlay } = getActions(cleanTokens);

  for (const [sceneId, updates] of Object.entries(tokenUpdates)) {
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;
    await scene.updateEmbeddedDocuments(
      "Token",
      updates as Array<{ _id: string } & Record<string, unknown>>,
    );
  }

  if (!skipSound) {
    for (const sound of soundsToPlay) {
      foundry.audio.AudioHelper.play(sound, { broadcast: true } as unknown as {
        recipients: string[];
      });
    }
  }
}

function handleTokenEvent(token: TokenDocument): void {
  void handleTokenEvents([token]);
}

function handleActorEvent(actor: Actor): void {
  const docs = actor
    .getActiveTokens()
    .map((token) => asTokenDocument(token))
    .filter((token): token is TokenDocument => Boolean(token));

  void handleTokenEvents(docs);
}

function handleCombatantEvents(combatants: Combatant[]): void {
  const docs = combatants
    .filter(
      <T extends Combatant>(x: T): x is T & { tokenId: string } => !!x.tokenId,
    )
    .map(
      (x) => canvas.scene?.tokens.get(x.tokenId),
      //asTokenDocument(combatant.token as TokenOrPlaceable | null),
    )
    .filter((x) => !!x);
  // .filter((token): token is TokenDocumentPF2e => Boolean(token));

  void handleTokenEvents(docs);
}

function handleCombatantEvent(combatant: Combatant): void {
  handleCombatantEvents([combatant]);
}

function handleCombatEvent(encounter: Combat): void {
  handleCombatantEvents(Array.from(encounter.combatants));
}

function handleCanvasEvent(currentCanvas: {
  tokens: { placeables: Array<{ document: TokenDocument }> };
}): void {
  const docs = currentCanvas.tokens.placeables.map((token) => token.document);
  void handleTokenEvents(docs, true);
}

const hooks = new HooksManager();
export function registerTokenChangerHooks(): void {
  hooks.on("ready", async () => {
    if (!game.user.isGM) return;

    await loadModuleTemplates([
      tokenImageFieldTemplate,
      getTokenStateConfigEditorTemplatePath(),
    ]);

    addTokenStatesTab(
      foundry.applications.sheets.TokenConfig as unknown as {
        TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
        PARTS?: Record<string, unknown>;
      },
    );
    addTokenStatesTab(
      foundry.applications.sheets.PrototypeTokenConfig as unknown as {
        TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
        PARTS?: Record<string, unknown>;
      },
    );
  });

  hooks.once("ready", () => {
    if (!game.user.isGM) return;

    game.socket.on(`module.${moduleId}`, async (data: unknown) => {
      if (!isApplyStateSocketPayload(data)) return;
      const scene = game.scenes.get(data.sceneId);
      if (!scene) return;

      const tokens = data.tokenIds.map((id) => scene.tokens.get(id));
      await handleTokenEvents(tokens, true);
    });
  });

  hooks.on("preUpdateActor", (_actor, changes) => {
    type TokenStateFlagDraft = {
      rulesJSON?: unknown;
      rules?: TokenRule[] | null;
      configJSON?: unknown;
      config?: TokenStateConfig | null;
    };

    const draft = changes as {
      prototypeToken?: {
        flags?: Record<string, TokenStateFlagDraft>;
      };
    };

    const raw = draft.prototypeToken?.flags?.[moduleId]?.rulesJSON;
    if (raw !== undefined) {
      try {
        const rules = validateRulesJSON(raw);
        if (!draft.prototypeToken?.flags?.[moduleId]) return;
        draft.prototypeToken.flags[moduleId].rules = rules;
      } catch (error) {
        ui.notifications.error(
          `Invalid rules JSON: ${(error as Error).message}`,
        );
      }
    }

    const configRaw = draft.prototypeToken?.flags?.[moduleId]?.configJSON;
    if (configRaw !== undefined) {
      try {
        const config = validateTokenStateConfigJSON(configRaw);
        if (!draft.prototypeToken?.flags?.[moduleId]) return;
        draft.prototypeToken.flags[moduleId].config = config;
      } catch (error) {
        ui.notifications.error(
          `Invalid token state config JSON: ${(error as Error).message}`,
        );
      }
    }
  });

  hooks.on("preUpdateToken", (_doc, changes) => {
    type TokenStateFlagDraft = {
      rulesJSON?: unknown;
      rules?: TokenRule[] | null;
      configJSON?: unknown;
      config?: TokenStateConfig | null;
    };

    const draft = changes as {
      flags?: Record<string, TokenStateFlagDraft>;
    };

    const raw = draft.flags?.[moduleId]?.rulesJSON;
    if (raw !== undefined) {
      try {
        const rules = validateRulesJSON(raw);
        if (!draft.flags?.[moduleId]) return;
        draft.flags[moduleId].rules = rules;
      } catch (error) {
        ui.notifications.error(
          `Invalid rules JSON: ${(error as Error).message}`,
        );
      }
    }

    const configRaw = draft.flags?.[moduleId]?.configJSON;
    if (configRaw !== undefined) {
      try {
        const config = validateTokenStateConfigJSON(configRaw);
        if (!draft.flags?.[moduleId]) return;
        draft.flags[moduleId].config = config;
      } catch (error) {
        ui.notifications.error(
          `Invalid token state config JSON: ${(error as Error).message}`,
        );
      }
    }
  });

  hooks.on("createCombat", handleCombatEvent);
  hooks.on("updateCombat", handleCombatEvent);
  hooks.on("deleteCombat", handleCombatEvent);

  hooks.on("createCombatant", handleCombatantEvent);
  hooks.on("updateCombatant", handleCombatantEvent);
  hooks.on("deleteCombatant", handleCombatantEvent);

  hooks.on("updateActor", handleActorEvent);

  hooks.on("createToken", handleTokenEvent);

  hooks.on("canvasReady", handleCanvasEvent);
  hooks.on("applyTokenStatusEffect", (token) => {
    const doc = asTokenDocument(token as TokenOrPlaceable);
    if (doc) handleTokenEvent(doc);
  });
}

export function unregisterTokenChangerHooks(): void {
  hooks.off();
}
