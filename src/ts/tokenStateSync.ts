import { PrototypeToken } from "foundry-pf2e/foundry/common/data/data.mjs";
import { moduleId } from "./constants";
import { ActorPF2e, ScenePF2e, TokenDocumentPF2e } from "foundry-pf2e";
import { TokenOrPrototype } from "./types";

const syncAllTokensButtonSelector = '[data-action="sync-all-tokens"]';
const syncConfiguredTokensButtonSelector =
  '[data-action="sync-configured-tokens"]';

function confirm(message: string) {
  const content = html(`
    <p>${message}</p>
  `);

  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Confirm" },
    content,
  });
}

async function removeConfig(message: string, token: TokenOrPrototype) {
  const result = await confirm(message);

  if (!result) {
    ui.notifications.warn("Did not remove the config");
    return;
  }

  await token.unsetFlag(moduleId, "config");

  ui.notifications.info("Successfully removed the config");
}
export async function removeTokenConfig(token: TokenDocumentPF2e) {
  return removeConfig(
    "Are you sure? This will remove this token's config",
    token,
  );
}

export async function removePrototypeTokenConfig(
  prototype: PrototypeToken<ActorPF2e>,
) {
  return removeConfig(
    "Are you sure? This will remove the prototype token's config",
    prototype,
  );
}

export async function syncToPrototype(token: foundry.documents.TokenDocument) {
  const prototype = token.actor?.prototypeToken;
  if (!prototype) return;

  const result = await confirm(
    "Are you sure? This will overwrite the prototype's config.",
  );

  if (!result) {
    ui.notifications.warn("Did not sync the token config to prototype token");
    return;
  }

  const tokenConfig = token.getFlag(moduleId, "config");
  await prototype.unsetFlag(moduleId, "config");
  await prototype.setFlag(
    moduleId,
    "config",
    foundry.utils.deepClone(tokenConfig),
  );

  ui.notifications.info(
    "Successfully synced the token config to the prototype token",
  );
}

export async function syncFromPrototype(
  token: foundry.documents.TokenDocument,
) {
  const prototype = token.actor?.prototypeToken;
  if (!prototype) return;

  const result = await confirm(
    "Are you sure? This will overwrite the token's config.",
  );

  if (!result) {
    ui.notifications.warn("Did not sync the token config to prototype token");
    return;
  }

  const prototypeConfig = prototype.getFlag(moduleId, "config");
  await token.unsetFlag(moduleId, "config");
  await token.setFlag(
    moduleId,
    "config",
    foundry.utils.deepClone(prototypeConfig),
  );

  ui.notifications.info(
    "Successfully synced the prototype token's config to the token",
  );
}

function getAllTokens(prototype: PrototypeToken<ActorPF2e>) {
  const actor = prototype.actor;
  if (!actor)
    return {
      scenes: [],
      configuredScenes: [],
      tokens: [],
      configuredTokens: [],
    };

  const scenes: ScenePF2e[] = [];
  const configuredScenes: ScenePF2e[] = [];
  const tokens: TokenDocumentPF2e[] = [];
  const configuredTokens: TokenDocumentPF2e[] = [];

  for (const scene of game.scenes.contents) {
    let hasToken = false;
    let hasConfiguredToken = false;

    for (const token of scene.tokens.contents) {
      if (token.actorId === actor.id) {
        tokens.push(token);
        hasToken = true;

        if (token.getFlag(moduleId, "config")) {
          hasConfiguredToken = true;
          configuredTokens.push(token);
        }
      }
    }

    if (hasToken) scenes.push(scene);
    if (hasConfiguredToken) configuredScenes.push(scene);
  }

  return {
    scenes,
    configuredScenes,
    tokens,
    configuredTokens,
  };
}

async function syncPrototypeConfigToTokens(
  prototype: PrototypeToken<ActorPF2e>,
  tokens: TokenDocumentPF2e[],
) {
  const config = prototype.getFlag(moduleId, "config");
  if (!config) {
    ui.notifications.warn("No flags present on the prototype.");
    return;
  }

  await Promise.all(
    tokens.map((token) => token.setFlag(moduleId, "config", config)),
  );

  ui.notifications.info(
    `Update ${tokens.length} token${tokens.length === 1 ? "" : "s"}`,
  );
}

function html(s: string) {
  return s;
}

export async function openPrototypeTokenSyncDialog(
  prototype: PrototypeToken<ActorPF2e>,
): Promise<void> {
  const actor = prototype.actor;
  if (!actor) {
    ui.notifications.warn(
      "Unable to determine the owning actor for this prototype token.",
    );
    return;
  }

  const { scenes, configuredScenes, tokens, configuredTokens } =
    getAllTokens(prototype);

  const content = html(`
    <div class="sf2e-token-state-sync-dialog">
      <p>
        Choose how to sync this prototype token's Token States config to placed
        tokens for
        <strong>${foundry.utils.escapeHTML(actor.name ?? "Actor")}</strong>.
      </p>

      <fieldset>
        <legend>Sync to all tokens</legend>
        <div class="sf2e-token-state-sync-dialog__option">
          <p><strong>Sync to all tokens</strong></p>
          <p class="notes">
            Updates all tokens for this actor across all scenes.
          </p>
          <p>
            Found ${tokens.length} token${tokens.length === 1 ? "" : "s"} across
            ${scenes.length} scene${scenes.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            class="sf2e-token-state-sync-dialog__inline-button"
            data-action="sync-all-tokens"
          >
            Sync to all tokens
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Sync to configured tokens</legend>
        <div class="sf2e-token-state-sync-dialog__option">
          <p class="notes">
            Only updates tokens that already have a Token States config,
            preserving unconfigured tokens.
          </p>
          <p>
            Found ${configuredTokens.length}
            token${configuredTokens.length === 1 ? "" : "s"} across
            ${configuredScenes.length}
            scene${configuredScenes.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            class="sf2e-token-state-sync-dialog__inline-button"
            data-action="sync-configured-tokens"
          >
            Sync to configured tokens
          </button>
        </div>
      </fieldset>
    </div>
  `);

  await foundry.applications.api.DialogV2.wait({
    window: { title: `Sync Token Config: ${actor.name}` },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark",
        callback: () => null,
      },
    ],
    render: (_, dialog: foundry.applications.api.DialogV2) => {
      const root = dialog.element;

      const inlineAll = root.querySelector<HTMLButtonElement>(
        syncAllTokensButtonSelector,
      );
      const inlineConfigured = root.querySelector<HTMLButtonElement>(
        syncConfiguredTokensButtonSelector,
      );

      if (inlineAll && inlineAll.dataset.boundClick !== "true") {
        inlineAll.dataset.boundClick = "true";
        inlineAll.addEventListener("click", () => {
          syncPrototypeConfigToTokens(prototype, tokens);
          dialog.close();
        });
      }
      if (inlineConfigured && inlineConfigured.dataset.boundClick !== "true") {
        inlineConfigured.dataset.boundClick = "true";
        inlineConfigured.addEventListener("click", () => {
          syncPrototypeConfigToTokens(prototype, configuredTokens);
          dialog.close();
        });
      }
    },
  });
}
