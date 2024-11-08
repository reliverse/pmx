import { existsSync, promises as fs } from "fs-extra";
import { resolve } from "pathe";

import { CLI_TEMP_DIR, writeFileSafe } from "./utils";

export type Storage = {
  lastRunCommand?: string;
};

let storage: Storage | undefined;

const storagePath = resolve(CLI_TEMP_DIR, "_storage.json");

export async function load(
  fn?: (storage: Storage) => Promise<boolean> | boolean,
) {
  if (!storage) {
    storage = existsSync(storagePath)
      ? JSON.parse((await fs.readFile(storagePath, "utf-8")) || "{}") || {}
      : {};
  }

  if (fn) {
    if (await fn(storage!)) {
      await dump();
    }
  }

  return storage!;
}

export async function dump() {
  if (storage) {
    await writeFileSafe(storagePath, JSON.stringify(storage));
  }
}
