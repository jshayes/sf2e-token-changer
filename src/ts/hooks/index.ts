import {
  registerTokenConfigHooks,
  unregisterTokenConfigHooks,
} from "./tokenConfigHooks";
import {
  registerTokenSoundHooks,
  unregisterTokenSoundHooks,
} from "./tokenSoundHooks";
import {
  registerTokenStateHooks,
  unregisterTokenStateHooks,
} from "./tokenStateHooks";

export function registerTokenChangerHooks(): void {
  registerTokenConfigHooks();
  registerTokenStateHooks();
  registerTokenSoundHooks();
}

export function unregisterTokenChangerHooks(): void {
  unregisterTokenConfigHooks();
  unregisterTokenStateHooks();
  unregisterTokenSoundHooks();
}
