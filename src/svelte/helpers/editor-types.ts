import type { UiCondition } from "./conditions";

export type TokenStateImageRuleConfig = {
  id: string;
  name: string;
  conditions: UiCondition[];
  image: string;
  scale: number;
};

export type SoundTriggerRuleConfig = {
  id: string;
  name: string;
  trigger: UiCondition;
  conditions: UiCondition[];
  src: string;
  volume: number;
};

export type TokenStateUiConfig = {
  version: 1;
  default: {
    image: string;
    scale: number;
  };
  tokenStates: TokenStateImageRuleConfig[];
  sounds: SoundTriggerRuleConfig[];
};

export type ImageConfigTarget =
  | { kind: "default" }
  | { kind: "tokenState"; index: number };

export type SoundConfigTarget = { index: number };
export type TokenStateConditionsConfigTarget = { index: number };
export type SoundConditionsConfigTarget = { index: number };

export type ImageConfigModalState = {
  target: ImageConfigTarget;
  image: string;
  scale: number;
};

export type SoundConfigModalState = {
  target: SoundConfigTarget;
  src: string;
  volume: number;
};

export type TokenStateConditionsModalState = {
  target: TokenStateConditionsConfigTarget;
  conditions: UiCondition[];
};

export type SoundConditionsModalState = {
  target: SoundConditionsConfigTarget;
  trigger: UiCondition;
  conditions: UiCondition[];
};
