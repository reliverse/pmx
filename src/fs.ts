import fs from "fs-extra";
import process from "node:process";
import { resolve } from "pathe";

import type { RunnerContext } from "./runner";

export function getPackageJSON(ctx?: RunnerContext): any {
  const cwd = ctx?.cwd ?? process.cwd();
  const path = resolve(cwd, "package.json");

  if (fs.existsSync(path)) {
    try {
      const raw = fs.readFileSync(path, "utf-8");
      const data = JSON.parse(raw);
      return data;
    } catch (e) {
      if (!ctx?.programmatic) {
        console.warn("Failed to parse package.json");
        process.exit(1);
      }

      throw e;
    }
  }
}
