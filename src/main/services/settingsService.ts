import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { AppSettings } from "../../shared/types";

const DEFAULT_SETTINGS: AppSettings = {
  labelOverrides: {},
  layerNameOverrides: {},
  layerTargets: {}
};

export class SettingsService {
  private readonly settingsPath = path.join(app.getPath("userData"), "macrodeck-settings.json");

  load(): AppSettings {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return { ...DEFAULT_SETTINGS };
      }

      const raw = fs.readFileSync(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        labelOverrides: parsed.labelOverrides ?? {},
        layerNameOverrides: parsed.layerNameOverrides ?? {},
        layerTargets: parsed.layerTargets ?? {}
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(settings: AppSettings): AppSettings {
    const normalized: AppSettings = {
      labelOverrides: settings.labelOverrides ?? {},
      layerNameOverrides: settings.layerNameOverrides ?? {},
      layerTargets: settings.layerTargets ?? {}
    };

    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(this.settingsPath, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  }
}
