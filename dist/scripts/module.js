const A = "sf2e-token-changer", r = A, C = `modules/${r}/templates/token-config.hbs`, I = `modules/${r}/templates/components/token-image-field.hbs`;
function m(e) {
  if (e)
    return "document" in e ? e.document : e;
}
function w(e) {
  const t = e;
  return t?.type === "applyState" && typeof t.sceneId == "string" && Array.isArray(t.tokenIds);
}
async function E(e) {
  const t = globalThis.loadTemplates;
  t && await t(e);
}
function y(e) {
  if (e.TABS?.sheet?.tabs?.push({
    id: r,
    label: "Token States",
    icon: "fa-solid fa-grid"
  }), !e.PARTS) return;
  const t = e.PARTS.footer;
  delete e.PARTS.footer, e.PARTS[r] = {
    template: C,
    scrollable: [""]
  }, e.PARTS.footer = t;
}
function v(e) {
  if (e === void 0) return;
  if (e === "") return null;
  const t = JSON.parse(String(e));
  if (!Array.isArray(t))
    throw new Error("Rules must be an array");
  return t;
}
function T(e) {
  return e.flags[r] ?? {};
}
function P(e, t) {
  const s = t.actor?.system?.attributes?.hp, c = s?.value ?? 0, n = s?.max ?? 0, a = n > 0 ? c / n : 0;
  switch (e.operator) {
    case "<":
      return a < e.value;
    case "<=":
      return a <= e.value;
    case ">":
      return a > e.value;
    case ">=":
      return a >= e.value;
    default:
      return !1;
  }
}
function R(e, t) {
  return !!t.inCombat === e.value;
}
function O(e, t) {
  const s = (t.actor?.conditions?.active ?? []).filter(
    (c) => e.value.includes(String(c.slug ?? ""))
  );
  switch (e.operator) {
    case "any-of":
      return s.length > 0;
    case "all-of":
      return s.length === e.value.length;
    default:
      return !1;
  }
}
function x(e, t) {
  for (const o of e.triggers ?? [])
    switch (o.type) {
      case "hp-percent":
        if (!P(o, t)) return !1;
        break;
      case "combat":
        if (!R(o, t)) return !1;
        break;
      case "status-effect":
        if (!O(o, t)) return !1;
        break;
      default:
        return !1;
    }
  return !0;
}
function $(e) {
  return T(e).rules?.find((o) => x(o, e));
}
function U(e) {
  const t = {}, o = [], s = (n, a) => {
    const u = String(n.parent?.id ?? "");
    if (!u) return;
    const i = t[u] ??= {}, d = String(n.id), p = i[d] ??= { _id: d };
    foundry.utils.mergeObject(p, a, { inplace: !0 });
  };
  for (const n of e) {
    const a = T(n);
    if (!a.rules) continue;
    const u = $(n);
    if (!u) {
      a._defaults && s(n, {
        ...a._defaults,
        [`flags.${r}.-=_defaults`]: null
      }), s(n, { [`flags.${r}.state`]: null });
      continue;
    }
    const i = {};
    a._defaults || (i[`flags.${r}._defaults`] = {
      ring: n.ring,
      texture: n.texture
    });
    const d = a.state === u.id;
    i[`flags.${r}.state`] = u.id;
    let p = !1;
    for (const l of u.effects ?? [])
      switch (l.type) {
        case "token-update": {
          const S = n.ring?.subject?.texture, H = l.value.ring?.subject?.texture;
          S !== H && (s(n, { ...i, ...l.value }), p = !0);
          break;
        }
        case "play-sound": {
          d || o.push({
            src: l.src,
            volume: l.volume,
            loop: !1
          });
          break;
        }
      }
    p || s(n, i);
  }
  return {
    tokenUpdates: Object.fromEntries(
      Object.entries(t).map(([n, a]) => [
        n,
        Object.values(a)
      ])
    ),
    soundsToPlay: o
  };
}
async function f(e, t = !1) {
  const o = e.filter((n) => !!n);
  if (!game.user.isGM) {
    if (canvas.scene) {
      const n = o.filter((a) => !!canvas.tokens.get(a.id)).map((a) => a.id);
      game.socket.emit(`module.${r}`, {
        type: "applyState",
        sceneId: canvas.scene.id,
        tokenIds: n
      });
    }
    return;
  }
  const { tokenUpdates: s, soundsToPlay: c } = U(o);
  for (const [n, a] of Object.entries(s)) {
    const u = game.scenes.get(n);
    u && await u.updateEmbeddedDocuments(
      "Token",
      a
    );
  }
  if (!t)
    for (const n of c)
      foundry.audio.AudioHelper.play(
        n,
        { broadcast: !0 }
      );
}
function b(e) {
  f([e]);
}
function B(e) {
  const t = e.getActiveTokens().map((o) => m(o)).filter((o) => !!o);
  f(t);
}
function h(e) {
  const t = e.map((o) => m(o.token)).filter((o) => !!o);
  f(t);
}
function k(e) {
  h([e]);
}
function g(e) {
  h(Array.from(e.combatants));
}
function _(e) {
  const t = e.tokens.placeables.map((o) => o.document);
  f(t, !0);
}
function J() {
  Hooks.on("ready", async () => {
    game.user.isGM && (await E([I]), y(
      foundry.applications.sheets.TokenConfig
    ), y(
      foundry.applications.sheets.PrototypeTokenConfig
    ));
  }), Hooks.once("ready", () => {
    game.user.isGM && game.socket.on(`module.${r}`, async (e) => {
      if (!w(e)) return;
      const t = game.scenes.get(e.sceneId);
      if (!t) return;
      const o = e.tokenIds.map((s) => t.tokens.get(s));
      await f(o, !0);
    });
  }), Hooks.on("preUpdateActor", (e, t) => {
    const o = t, s = o.prototypeToken?.flags?.[r]?.rulesJSON;
    if (s !== void 0)
      try {
        const c = v(s);
        if (!o.prototypeToken?.flags?.[r]) return;
        o.prototypeToken.flags[r].rules = c;
      } catch (c) {
        ui.notifications.error(`Invalid rules JSON: ${c.message}`);
      }
  }), Hooks.on("preUpdateToken", (e, t) => {
    const o = t, s = o.flags?.[r]?.rulesJSON;
    if (s !== void 0)
      try {
        const c = v(s);
        if (!o.flags?.[r]) return;
        o.flags[r].rules = c;
      } catch (c) {
        ui.notifications.error(`Invalid rules JSON: ${c.message}`);
      }
  }), Hooks.on("createCombat", g), Hooks.on("updateCombat", g), Hooks.on("deleteCombat", g), Hooks.on("createCombatant", k), Hooks.on("updateCombatant", k), Hooks.on("deleteCombatant", k), Hooks.on("updateActor", B), Hooks.on("createToken", b), Hooks.on("canvasReady", _), Hooks.on("applyTokenStatusEffect", (e) => {
    const t = m(e);
    t && b(t);
  });
}
Hooks.once("init", () => {
  J();
});
//# sourceMappingURL=module.js.map
