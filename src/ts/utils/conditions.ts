import { TokenState } from "./tokenState";
import {
  Condition,
  HpPercentCondition,
  HpValueCondition,
  InCombatCondition,
  StatusEffectCondition,
} from "../types";

function checkHpPercentCondition(
  condition: HpPercentCondition,
  token: TokenState,
): boolean {
  const hpPercent = token.maxHp > 0 ? token.hp / token.maxHp : 0;

  switch (condition.operator) {
    case "<":
      return hpPercent < condition.value;
    case "<=":
      return hpPercent <= condition.value;
    case ">":
      return hpPercent > condition.value;
    case ">=":
      return hpPercent >= condition.value;
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

export function checkCondition(condition: Condition, token: TokenState) {
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
