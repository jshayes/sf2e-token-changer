import { moduleId } from "../constants";
import { HooksManager } from "../hooksManager";
import { getTokenStateConfigEditorTemplatePath } from "../tokenStateConfigEditor";

const tokenConfigTemplate = `modules/${moduleId}/templates/token-config.hbs`;
const tokenImageFieldTemplate = `modules/${moduleId}/templates/components/token-image-field.hbs`;

async function loadModuleTemplates(paths: string[]): Promise<void> {
  await foundry.applications.handlebars.loadTemplates(paths);
}

function addTokenStatesTab(sheetClass: {
  TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
  PARTS?: Record<string, unknown>;
}): void {
  sheetClass.TABS?.sheet?.tabs?.push({
    id: moduleId,
    label: "Token States",
    icon: "fa-solid fa-grid",
  });

  if (!sheetClass.PARTS) return;

  const footer = sheetClass.PARTS.footer;
  delete sheetClass.PARTS.footer;

  sheetClass.PARTS[moduleId] = {
    template: tokenConfigTemplate,
    scrollable: [""],
  };

  sheetClass.PARTS.footer = footer;
}

const hooks = new HooksManager();
export function registerTokenConfigHooks(): void {
  hooks.on("ready", async () => {
    await loadModuleTemplates([
      tokenImageFieldTemplate,
      getTokenStateConfigEditorTemplatePath(),
    ]);

    addTokenStatesTab(
      foundry.applications.sheets.TokenConfig as unknown as {
        TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
        PARTS?: Record<string, unknown>;
      },
    );
    addTokenStatesTab(
      foundry.applications.sheets.PrototypeTokenConfig as unknown as {
        TABS?: { sheet?: { tabs?: Array<Record<string, unknown>> } };
        PARTS?: Record<string, unknown>;
      },
    );
  });
}

export function unregisterTokenConfigHooks(): void {
  hooks.off();
}
