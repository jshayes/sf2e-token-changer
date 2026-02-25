import { ActorPF2e, CombatantPF2e, TokenPF2e } from "foundry-pf2e";
import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import type { TokenStateConfig } from "../types";
import { checkCondition } from "../utils/conditions";
import { getTokenState, TokenState } from "../utils/tokenState";

type ModuleTokenFlags = {
  config?: TokenStateConfig | null;
};

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
  hooks.on("createCombatant", (combatant: CombatantPF2e) => {
    if (!combatant.token) return;
    if (combatant.token.scene?.id !== canvas.scene?.id) return;

    const token = combatant.token;
    const current = getTokenState(token);
    if (!current) return;

    const previous = clone(current);
    previous.inCombat = false;

    const flags = getModuleFlags(token);
    playExpectedSounds(flags, current, previous);
  });

  hooks.on("deleteCombatant", (combatant: CombatantPF2e) => {
    if (!combatant.token) return;
    if (combatant.token.scene?.id !== canvas.scene?.id) return;

    const token = combatant.token;
    const current = getTokenState(token);
    if (!current) return;

    const previous = clone(current);
    previous.inCombat = true;

    const flags = getModuleFlags(token);
    playExpectedSounds(flags, current, previous);
  });

  hooks.on("updateActor", (actor: ActorPF2e, _: any, action: any) => {
    actor.getActiveTokens().map((token) => {
      const flags = getModuleFlags(token.document);
      const current = getTokenState(token.document);
      if (!current) return;

      const previous = clone(current);
      if (action.damageTaken) {
        previous.hp += action.damageTaken;
      }

      playExpectedSounds(flags, current, previous);
    });
  });

  hooks.on("applyTokenStatusEffect", (token: TokenPF2e, status: string) => {
    const flags = getModuleFlags(token.document);
    const current = getTokenState(token.document);
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
