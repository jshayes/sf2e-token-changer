import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import { getTokenStateConfigEditorTemplatePath } from "../tokenStateConfigEditor";
import type {
  Condition,
  HpPercentCondition,
  HpValueCondition,
  InCombatCondition,
  StatusEffectCondition,
  TokenStateConfig,
} from "../types";

const tokenConfigTemplate = `modules/${moduleId}/templates/token-config.hbs`;
const tokenImageFieldTemplate = `modules/${moduleId}/templates/components/token-image-field.hbs`;

type ModuleTokenFlags = {
  config?: TokenStateConfig | null;
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

function checkHpValueCondition(
  condition: HpValueCondition,
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

  switch (condition.operator) {
    case "<":
      return value < condition.value;
    case "<=":
      return value <= condition.value;
    case ">":
      return value > condition.value;
    case ">=":
      return value >= condition.value;
    default:
      return false;
  }
}

function checkInCombatCondition(
  condition: InCombatCondition,
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

function checkCondition(condition: Condition, token: TokenDocument) {
  switch (condition.type) {
    case "hp-percent":
      return checkHpPercentCondition(condition, token);
    case "hp-value":
      return checkHpValueCondition(condition, token);
    case "in-combat":
      return checkInCombatCondition(condition, token);
    case "status-effect":
      return checkStatusEffectCondition(condition, token);
    default:
      return false;
  }
}

function getExpectedTokenImage(token: TokenDocument): {
  image: string;
  scale: number;
} | null {
  const flags = getModuleFlags(token)?.config;

  if (!flags) return null;

  return (
    flags.tokenStates.find((state) =>
      state.conditions.reduce(
        (prev, cur) => prev && checkCondition(cur, token),
        true,
      ),
    ) ?? flags.default
  );
}

function groupTokensByScene(tokens: TokenDocument[]) {
  const grouped: { [key: string]: TokenDocument[] } = {};

  tokens.forEach((token) => {
    const arr = grouped[token.scene.id] ?? [];
    arr.push(token);
    grouped[token.scene.id] = arr;
  });

  return grouped;
}

async function handleTokenEvents(
  tokens: Array<TokenDocument | null | undefined>,
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

  const groupedTokens = groupTokensByScene(cleanTokens);
  const tokenUpdates = Object.entries(groupedTokens).map(
    ([sceneId, tokens]) => {
      return [
        sceneId,
        tokens
          .map((token) => {
            const image = getExpectedTokenImage(token);
            if (!image) return;

            if (token.ring.enabled) {
              return {
                _id: token.id,
                ring: {
                  subject: {
                    texture: image.image,
                    scale: image.scale,
                  },
                },
              };
            }

            return {
              _id: token.id,
              texture: image.image,
              scaleX: image.scale,
              scaleY: image.scale,
            };
          })
          .filter((x) => !!x),
      ] as const;
    },
  );

  for (const [sceneId, updates] of tokenUpdates) {
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;
    await scene.updateEmbeddedDocuments(
      "Token",
      updates as Array<{ _id: string } & Record<string, unknown>>,
    );
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
  void handleTokenEvents(docs);
}

const hooks = new HooksManager();
export function registerTokenStateHooks(): void {
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
      await handleTokenEvents(tokens);
    });
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

export function unregisterTokenStateHooks(): void {
  hooks.off();
}
