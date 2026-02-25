import { TokenDocumentPF2e } from "foundry-pf2e";

export interface TokenState {
  hp: number;
  maxHp: number;
  conditions: Set<string>;
  inCombat: boolean;
}

export function getTokenState(token: TokenDocumentPF2e): TokenState | null {
  if (!token.actor) return null;
  // Weird jank to get around infinite type BS
  const actor = token.actor;
  return {
    hp: actor.system.attributes.hp?.value ?? 0,
    maxHp: actor.system.attributes.hp?.max ?? 0,
    conditions: new Set(actor.conditions.active.map((x) => x.slug)),
    inCombat: token.inCombat,
  };
}
