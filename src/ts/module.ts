// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";
import { registerTokenChangerHooks } from "./tokenChanger";

Hooks.once("init", () => {
  registerTokenChangerHooks();
});

if (import.meta.hot) {
  import.meta.hot.accept();
}
