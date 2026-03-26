import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SaveBoardProfileRequest, SavedBoardProfile } from "../../shared/types";

export class ProfilesService {
  private readonly profilesPath = path.join(app.getPath("userData"), "macrodeck-profiles.json");

  list(): SavedBoardProfile[] {
    try {
      if (!fs.existsSync(this.profilesPath)) {
        return [];
      }

      const raw = fs.readFileSync(this.profilesPath, "utf8");
      const parsed = JSON.parse(raw) as SavedBoardProfile[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(request: SaveBoardProfileRequest): SavedBoardProfile[] {
    const profiles = this.list();
    const now = new Date().toISOString();
    const nextProfile: SavedBoardProfile = {
      id: crypto.randomUUID(),
      name: request.name.trim(),
      createdAt: now,
      updatedAt: now,
      layers: request.layers,
      settings: request.settings
    };

    const next = [nextProfile, ...profiles].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    this.write(next);
    return next;
  }

  get(profileId: string): SavedBoardProfile | undefined {
    return this.list().find((profile) => profile.id === profileId);
  }

  private write(profiles: SavedBoardProfile[]): void {
    fs.mkdirSync(path.dirname(this.profilesPath), { recursive: true });
    fs.writeFileSync(this.profilesPath, JSON.stringify(profiles, null, 2), "utf8");
  }
}
