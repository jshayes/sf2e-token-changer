import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import { getTokenStateConfigEditorTemplatePath } from "../tokenStateConfigEditor";
import type { TokenStateConfig, TokenDocument } from "../types";
import { checkCondition } from "../utils/conditions";
import { getTokenState, TokenState } from "../utils/tokenState";

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

  hooks.on("createCombatant", (combatant) => {
    if (!combatant.token) return;
    if (combatant.token.scene.id !== canvas.scene?.id) return;

    const token = combatant.token;
    const current = getTokenState(token);
    if (!current) return;

    const previous = clone(current);
    previous.inCombat = false;

    const flags = getModuleFlags(token);
    playExpectedSounds(flags, current, previous);
  });

  hooks.on("deleteCombatant", (combatant) => {
    if (!combatant.token) return;
    if (combatant.token.scene.id !== canvas.scene?.id) return;

    const token = combatant.token;
    const current = getTokenState(token);
    if (!current) return;

    const previous = clone(current);
    previous.inCombat = true;

    const flags = getModuleFlags(token);
    playExpectedSounds(flags, current, previous);
  });

  hooks.on("updateActor", (actor: Actor, _: any, action: any) => {
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
  });

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
