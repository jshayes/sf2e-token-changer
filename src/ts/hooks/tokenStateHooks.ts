import {
  ActorPF2e,
  CanvasPF2e,
  CombatantPF2e,
  EncounterPF2e,
  TokenDocumentPF2e,
  TokenPF2e,
} from "foundry-pf2e";
import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import type { TokenStateConfig } from "../types";
import { checkCondition } from "../utils/conditions";
import { getTokenState } from "../utils/tokenState";
import { isDefined } from "../utils/isDefined";

type ModuleTokenFlags = {
  config?: TokenStateConfig | null;
};

type ApplyStateSocketPayload = {
  type: "applyState";
  sceneId: string;
  tokenIds: string[];
};

function isApplyStateSocketPayload(
  value: unknown,
): value is ApplyStateSocketPayload {
  const payload = value as Partial<ApplyStateSocketPayload> | null | undefined;
  return (
    payload?.type === "applyState" &&
    typeof payload.sceneId === "string" &&
    Array.isArray(payload.tokenIds)
  );
}

function getModuleFlags(token: TokenDocumentPF2e): ModuleTokenFlags {
  return ((token.flags as Record<string, unknown>)[moduleId] ??
    {}) as ModuleTokenFlags;
}

function getExpectedTokenImage(token: TokenDocumentPF2e): {
  image: string;
  scale: number;
} | null {
  const flags = getModuleFlags(token)?.config;
  if (!flags) return null;

  const tokenState = getTokenState(token);
  if (!tokenState) return null;

  return (
    flags.tokenStates.find((state) =>
      state.conditions.reduce(
        (prev, cur) => prev && checkCondition(cur, tokenState),
        true,
      ),
    ) ?? flags.default
  );
}

function groupTokensByScene(tokens: TokenDocumentPF2e[]) {
  const grouped: { [key: string]: TokenDocumentPF2e[] } = {};

  tokens.forEach((token) => {
    if (!token.scene) return;

    const arr = grouped[token.scene.id] ?? [];
    arr.push(token);
    grouped[token.scene.id] = arr;
  });

  return grouped;
}

async function handleTokenEvents(tokens: TokenDocumentPF2e[]): Promise<void> {
  if (!game.user.isGM) {
    if (canvas.scene) {
      const tokenIds = tokens
        .filter((token) => Boolean(canvas.tokens.get(token.id)))
        .map((token) => token.id);

      game.socket.emit(`module.${moduleId}`, {
        type: "applyState",
        sceneId: canvas.scene.id,
        tokenIds,
      } satisfies ApplyStateSocketPayload);
    }
    return;
  }

  const groupedTokens = groupTokensByScene(tokens);
  const tokenUpdates = Object.entries(groupedTokens).map(
    ([sceneId, tokens]) => {
      return [
        sceneId,
        tokens
          .map((token) => {
            const image = getExpectedTokenImage(token);
            if (!image) return;

            if (token.ring.enabled) {
              return {
                _id: token.id,
                ring: {
                  subject: {
                    texture: image.image,
                    scale: image.scale,
                  },
                },
              };
            }

            return {
              _id: token.id,
              texture: image.image,
              scaleX: image.scale,
              scaleY: image.scale,
            };
          })
          .filter(isDefined),
      ] as const;
    },
  );

  for (const [sceneId, updates] of tokenUpdates) {
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;
    await scene.updateEmbeddedDocuments(
      "Token",
      updates as Array<{ _id: string } & Record<string, unknown>>,
    );
  }
}

function handleTokenEvent(token: TokenDocumentPF2e): void {
  void handleTokenEvents([token]);
}

function handleActorEvent(actor: ActorPF2e): void {
  const docs = actor.getActiveTokens().map((token) => token.document);

  void handleTokenEvents(docs);
}

function handleCombatantEvents(combatants: CombatantPF2e[]): void {
  const docs = combatants
    .map((x) => x.tokenId)
    .filter(isDefined)
    .map((x) => canvas.scene?.tokens.get(x))
    .filter(isDefined);

  void handleTokenEvents(docs);
}

function handleCombatantEvent(combatant: CombatantPF2e): void {
  handleCombatantEvents([combatant]);
}

function handleCombatEvent(encounter: EncounterPF2e): void {
  handleCombatantEvents(Array.from(encounter.combatants));
}

function handleCanvasEvent(currentCanvas: CanvasPF2e): void {
  const docs = currentCanvas.tokens.placeables.map((token) => token.document);
  void handleTokenEvents(docs);
}

const hooks = new HooksManager();
export function registerTokenStateHooks(): void {
  hooks.once("ready", () => {
    if (!game.user.isGM) return;

    game.socket.on(`module.${moduleId}`, async (data: unknown) => {
      if (!isApplyStateSocketPayload(data)) return;
      const scene = game.scenes.get(data.sceneId);
      if (!scene) return;

      const tokens = data.tokenIds
        .map((id) => scene.tokens.get(id))
        .filter(isDefined);
      await handleTokenEvents(tokens);
    });
  });

  hooks.on("createCombat", handleCombatEvent);
  hooks.on("updateCombat", handleCombatEvent);
  hooks.on("deleteCombat", handleCombatEvent);

  hooks.on("createCombatant", handleCombatantEvent);
  hooks.on("updateCombatant", handleCombatantEvent);
  hooks.on("deleteCombatant", handleCombatantEvent);

  hooks.on("updateActor", handleActorEvent);

  hooks.on("createToken", handleTokenEvent);

  hooks.on("canvasReady", handleCanvasEvent);
  hooks.on("applyTokenStatusEffect", (token: TokenPF2e) => {
    handleTokenEvent(token.document);
  });
}

export function unregisterTokenStateHooks(): void {
  hooks.off();
}
