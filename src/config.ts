import type { Agent } from "@reliverse/pm";

import fs from "fs-extra";
import ini from "ini";
import process from "node:process";
import path from "pathe";

import { detectPMX } from "./detect";

const customPiRcPath = process.env.PI_CONFIG_FILE;
const customNiRcPath = process.env.NI_CONFIG_FILE;

const home =
  process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;

const defaultPiRcPath = path.join(home || "~/", ".pirc");
const defaultNiRcPath = path.join(home || "~/", ".nirc");

const piRcPath = customPiRcPath || defaultPiRcPath;
const niRcPath = customNiRcPath || defaultNiRcPath;

type Config = {
  defaultAgent: Agent | "prompt";
  globalAgent: Agent;
};

const defaultConfig: Config = {
  defaultAgent: "prompt",
  globalAgent: "npm",
};

let config: Config | undefined;

export async function getConfig(): Promise<Config> {
  if (!config) {
    config = Object.assign(
      {},
      defaultConfig,
      fs.existsSync(piRcPath)
        ? ini.parse(fs.readFileSync(piRcPath, "utf-8"))
        : null,
      fs.existsSync(niRcPath)
        ? ini.parse(fs.readFileSync(niRcPath, "utf-8"))
        : null,
    );

    if (process.env.NI_DEFAULT_AGENT) {
      config.defaultAgent = process.env.NI_DEFAULT_AGENT as Agent;
    }

    if (process.env.NI_GLOBAL_AGENT) {
      config.globalAgent = process.env.NI_GLOBAL_AGENT as Agent;
    }

    const agent = await detectPMX({ programmatic: true });
    if (agent) {
      config.defaultAgent = agent;
    }
  }

  return config;
}

export async function getDefaultAgent(programmatic?: boolean) {
  const { defaultAgent } = await getConfig();
  if (defaultAgent === "prompt" && (programmatic || process.env.CI)) {
    return "npm";
  }
  return defaultAgent;
}

export async function getGlobalAgent() {
  const { globalAgent } = await getConfig();
  return globalAgent;
}
