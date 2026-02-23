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

function getModuleFlags(
  token: foundry.documents.TokenDocument,
): ModuleTokenFlags {
  return ((token.flags as Record<string, unknown>)[moduleId] ??
    {}) as ModuleTokenFlags;
}

function checkHpPercentCondition(
  condition: HpPercentCondition,
  token: TokenState,
): boolean {
  const hpPerc = token.maxHp > 0 ? token.hp / token.maxHp : 0;

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
  token: TokenState,
): boolean {
  switch (condition.operator) {
    case "<":
      return token.hp < condition.value;
    case "<=":
      return token.hp <= condition.value;
    case ">":
      return token.hp > condition.value;
    case ">=":
      return token.hp >= condition.value;
    default:
      return false;
  }
}

function checkInCombatCondition(
  condition: InCombatCondition,
  token: TokenState,
): boolean {
  return token.inCombat === condition.value;
}

function checkStatusEffectCondition(
  condition: StatusEffectCondition,
  token: TokenState,
): boolean {
  const matchedConditions = condition.value.filter((status) =>
    token.conditions.has(status),
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

function checkCondition(condition: Condition, token: TokenState) {
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

function getExpectedTokenSounds(
  flags: ModuleTokenFlags,
  current: TokenState,
  previous: TokenState,
) {
  if (!flags.config) return [];
  return flags.config.sounds.filter((sound) => {
    return (
      checkCondition(sound.trigger, current) &&
      !checkCondition(sound.trigger, previous) &&
      sound.conditions.reduce(
        (prev, cur) => prev && checkCondition(cur, current),
        true,
      )
    );
  });
}

interface TokenState {
  hp: number;
  maxHp: number;
  conditions: Set<string>;
  inCombat: boolean;
}

function playExpectedSounds(
  flags: ModuleTokenFlags,
  current: TokenState,
  previous: TokenState,
) {
  const sounds = new Set();
  getExpectedTokenSounds(flags, current, previous)
    .filter((sound) => {
      if (sounds.has(sound.src)) {
        return false;
      }
      sounds.add(sound.src);
      return true;
    })
    .map((sound) => {
      foundry.audio.AudioHelper.play(sound, false);
    });
}

type Actor = foundry.documents.Actor & {
  system: {
    attributes: {
      hp: {
        value: number;
        max: number;
      };
    };
  };
  conditions: {
    active: { slug: string }[];
  };
};
type TokenDocument = foundry.documents.TokenDocument & { actor: Actor | null };

function getTokenState(token: TokenDocument): TokenState | null {
  if (!token.actor) return null;
  return {
    hp: token.actor.system.attributes.hp.value,
    maxHp: token.actor.system.attributes.hp.max,
    conditions: new Set(token.actor.conditions.active.map((x) => x.slug)),
    inCombat: token.inCombat,
  };
}

function handleActorEvent(actor: Actor, _: any, action: any): void {
  actor.getActiveTokens().map((token) => {
    if (!token) return;

    if (token instanceof foundry.canvas.placeables.Token) {
      token = token.document;
    }

    const flags = getModuleFlags(token);
    const current = getTokenState(token as TokenDocument);
    if (!current) return;

    const previous = clone(current);
    if (action.damageTaken) {
      previous.hp += action.damageTaken;
    }

    playExpectedSounds(flags, current, previous);
  });

  // const docs = actor
  //   .getActiveTokens()
  //   .map((token) => asTokenDocument(token))
  //   .filter((token): token is TokenDocument => Boolean(token));
  //
  // void handleTokenEvents(docs);
}

const hooks = new HooksManager();
export function registerTokenSoundHooks(): void {
  hooks.on("ready", async () => {
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

    // game.socket.on(`module.${moduleId}`, async (data: unknown) => {
    //   if (!isApplyStateSocketPayload(data)) return;
    //   const scene = game.scenes.get(data.sceneId);
    //   if (!scene) return;
    //
    //   const tokens = data.tokenIds.map((id) => scene.tokens.get(id));
    //   await handleTokenEvents(tokens);
    // });
  });

  // hooks.on("createCombat", handleCombatEvent);
  // hooks.on("updateCombat", handleCombatEvent);
  // hooks.on("deleteCombat", handleCombatEvent);
  //
  // hooks.on("createCombatant", handleCombatantEvent);
  // hooks.on("updateCombatant", handleCombatantEvent);
  // hooks.on("deleteCombatant", handleCombatantEvent);

  hooks.on("updateActor", handleActorEvent);

  hooks.on("applyTokenStatusEffect", (token, status) => {
    token = token.document;

    const flags = getModuleFlags(token);
    const current = getTokenState(token);
    if (!current) return;

    const previous = clone(current);
    previous.conditions.delete(status);

    playExpectedSounds(flags, current, previous);
  });
}

function clone(tokenState: TokenState) {
  return {
    ...tokenState,
    conditions: new Set(tokenState.conditions),
  };
}

export function unregisterTokenSoundHooks(): void {
  hooks.off();
}
