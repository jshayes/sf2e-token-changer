// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";
import {
  registerTokenChangerHooks,
  unregisterTokenChangerHooks,
} from "./tokenChanger";
import {
  registerTokenStateConfigEditorHooks,
  unregisterTokenStateConfigEditorHooks,
} from "./tokenStateConfigEditor";

function initModule() {
  registerTokenChangerHooks();
  registerTokenStateConfigEditorHooks();
}

Hooks.once("init", () => {
  initModule();
});

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    unregisterTokenChangerHooks();
    unregisterTokenStateConfigEditorHooks();
  });

  initModule();
}
