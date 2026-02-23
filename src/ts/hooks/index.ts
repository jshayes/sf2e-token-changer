import {
  registerTokenSoundHooks,
  unregisterTokenSoundHooks,
} from "./tokenSoundHooks";
import {
  registerTokenStateHooks,
  unregisterTokenStateHooks,
} from "./tokenStateHooks";

export function registerTokenChangerHooks(): void {
  registerTokenStateHooks();
  registerTokenSoundHooks();
}

export function unregisterTokenChangerHooks(): void {
  unregisterTokenStateHooks();
  unregisterTokenSoundHooks();
}
