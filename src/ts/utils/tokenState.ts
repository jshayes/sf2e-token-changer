import type { Actor, TokenDocument } from "../types";

export interface TokenState {
  hp: number;
  maxHp: number;
  conditions: Set<string>;
  inCombat: boolean;
}

export function getTokenState(token: TokenDocument): TokenState | null {
  if (!token.actor) return null;
  // Weird jank to get around infinite type BS
  const actor = token.actor as unknown as Actor;
  return {
    hp: actor.system.attributes.hp.value,
    maxHp: actor.system.attributes.hp.max,
    conditions: new Set(actor.conditions.active.map((x) => x.slug)),
    inCombat: token.inCombat,
  };
}
