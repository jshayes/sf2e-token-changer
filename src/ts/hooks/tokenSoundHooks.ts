import { ActorPF2e, CombatantPF2e, TokenPF2e } from "foundry-pf2e";
import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import type { SoundTriggerRuleConfig, TokenStateConfig } from "../types";
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

function dedupeSounds(sounds: SoundTriggerRuleConfig[]) {
  const soundSet = new Set();
  return sounds.filter((sound) => {
    if (soundSet.has(sound.src)) {
      return false;
    }
    soundSet.add(sound.src);
    return true;
  });
}

function playSounds(sounds: SoundTriggerRuleConfig[]) {
  sounds.forEach((sound) => {
    foundry.audio.AudioHelper.play(sound, false);
  });
}

function playExpectedSounds(
  flags: ModuleTokenFlags,
  current: TokenState,
  previous: TokenState,
) {
  playSounds(dedupeSounds(getExpectedTokenSounds(flags, current, previous)));
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
    const sounds: SoundTriggerRuleConfig[] = [];

    actor.getActiveTokens().map((token) => {
      const flags = getModuleFlags(token.document);
      const current = getTokenState(token.document);
      if (!current) return;

      const previous = clone(current);
      if (action.damageTaken) {
        previous.hp += action.damageTaken;
      }

      sounds.push(...getExpectedTokenSounds(flags, current, previous));
    });

    playSounds(dedupeSounds(sounds));
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
