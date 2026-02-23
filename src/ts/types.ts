import { Module } from "foundry-pf2e/foundry/client/packages/_module.mjs";

export interface MyModule extends Module {}

export type NumericOperator = "<" | "<=" | ">" | ">=";
export type StatusOperator = "any-of" | "all-of";

export type HpPercentCondition = {
  type: "hp-percent";
  operator: NumericOperator;
  value: number;
};
export type HpValueCondition = {
  type: "hp-value";
  operator: NumericOperator;
  value: number;
};
export type InCombatCondition = { type: "in-combat"; value: boolean };
export type StatusEffectCondition = {
  type: "status-effect";
  operator: StatusOperator;
  value: string[];
};

export type Condition =
  | HpPercentCondition
  | HpValueCondition
  | InCombatCondition
  | StatusEffectCondition;

export type TokenStateImageRuleConfig = {
  id: string;
  name: string;
  conditions: Condition[];
  image: string;
  scale: number;
};

export type SoundTriggerRuleConfig = {
  id: string;
  name: string;
  trigger: Condition;
  conditions: Condition[];
  src: string;
  volume: number;
};

export type TokenStateConfig = {
  version: 1;
  default: {
    image: string;
    scale: number;
  };
  tokenStates: TokenStateImageRuleConfig[];
  sounds: SoundTriggerRuleConfig[];
};

export type Actor = foundry.documents.Actor & {
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

export type TokenDocument = foundry.documents.TokenDocument & {
  actor: Actor | null;
  scene: foundry.documents.Scene;
};
