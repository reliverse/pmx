import type { Agent, ResolvedCommand } from "@reliverse/pm";
import type { Options as TinyExecOptions } from "tinyexec";

import prompts from "@posva/prompts";
import { AGENTS } from "@reliverse/pm";
import process from "node:process";
import { resolve } from "pathe";
import c from "picocolors";
import { x } from "tinyexec";

import type { DetectOptionsPMX } from "./detect";

import { version } from "../package.json";
import { getDefaultAgent, getGlobalAgent } from "./config";
import { detectPMX } from "./detect";
import { UnsupportedCommand, getCommand } from "./parse";
import { cmdExists, remove } from "./utils";

const DEBUG_SIGN = "?";

export type RunnerContext = {
  programmatic?: boolean;
  hasLock?: boolean;
  cwd?: string;
};

export type Runner = (
  agent: Agent,
  args: string[],
  ctx?: RunnerContext,
) => Promise<ResolvedCommand | undefined> | ResolvedCommand | undefined;

export async function runCli(
  fn: Runner,
  options: DetectOptionsPMX & { args?: string[] } = {},
) {
  const { args = process.argv.slice(2).filter(Boolean) } = options;
  try {
    await run(fn, args, options);
  } catch (error) {
    if (error instanceof UnsupportedCommand && !options.programmatic) {
      console.log(c.red(`\u2717 ${error.message}`));
    }

    if (!options.programmatic) {
      process.exit(1);
    }

    throw error;
  }
}

export async function getCliCommand(
  fn: Runner,
  args: string[],
  options: DetectOptionsPMX = {},
  cwd: string = options.cwd ?? process.cwd(),
) {
  const isGlobal = args.includes("-g");
  if (isGlobal) {
    return await fn(await getGlobalAgent(), args);
  }

  let agent =
    (await detectPMX({ ...options, cwd })) ||
    (await getDefaultAgent(options.programmatic));

  if (agent === "prompt") {
    const result = await prompts({
      name: "agent",
      type: "select",
      message: "Choose the agent",
      choices: AGENTS.filter((i) => !i.includes("@")).map((value) => ({
        title: value,
        value,
      })),
    });

    agent = result.agent;
    if (!agent) {
      return;
    }
  }

  return await fn(agent as Agent, args, {
    programmatic: options.programmatic,
    hasLock: Boolean(agent),
    cwd,
  });
}

export async function run(
  fn: Runner,
  args: string[],
  options: DetectOptionsPMX = {},
) {
  const { detectVolta = true } = options;

  const debug = args.includes(DEBUG_SIGN);
  if (debug) {
    remove(args, DEBUG_SIGN);
  }

  let cwd = options.cwd ?? process.cwd();
  if (args[0] === "-C") {
    cwd = resolve(cwd, args[1] ?? "");
    args.splice(0, 2);
  }

  if (
    args.length === 1 &&
    (args[0]?.toLowerCase() === "-v" || args[0] === "--version")
  ) {
    const getCmd = (a: Agent) =>
      AGENTS.includes(a)
        ? getCommand(a, "agent", ["-v"])
        : { command: a, args: ["-v"] };
    const xVersionOptions: Partial<TinyExecOptions> = {
      nodeOptions: {
        cwd,
      },
      throwOnError: true,
    };
    const getV = (a: string) => {
      const { command, args } = getCmd(a as Agent);
      return x(command, args, xVersionOptions)
        .then((e) => e.stdout)
        .then((e) => (e.startsWith("v") ? e : `v${e}`));
    };
    const globalAgentPromise = getGlobalAgent();
    const globalAgentVersionPromise = globalAgentPromise.then(getV);
    const agentPromise = detectPMX({ ...options, cwd }).then((a) => a || "");
    const agentVersionPromise = agentPromise.then((a) => a && getV(a));
    const nodeVersionPromise = getV("node");

    console.log(`@reliverse/pmx  ${c.cyan(`v${version}`)}`);
    console.log(`node       ${c.green(await nodeVersionPromise)}`);
    const [agent, agentVersion] = await Promise.all([
      agentPromise,
      agentVersionPromise,
    ]);
    if (agent) {
      console.log(`${agent.padEnd(10)} ${c.blue(agentVersion ?? "")}`);
    } else {
      console.log("agent      no lock file");
    }
    const [globalAgent, globalAgentVersion] = await Promise.all([
      globalAgentPromise,
      globalAgentVersionPromise,
    ]);
    console.log(
      `${(`${globalAgent} -g`).padEnd(10)} ${c.blue(globalAgentVersion ?? "")}`,
    );
    return;
  }

  if (args.length === 1 && ["-h", "--help"].includes(args[0] ?? "")) {
    const dash = c.dim("-");
    console.log(
      c.green(c.bold("@reliverse/pmx")) +
        c.dim(` use the right package manager v${version}\n`),
    );
    console.log(`pi    ${dash}  install`);
    console.log(`pr    ${dash}  run`);
    console.log(`plx   ${dash}  execute`);
    console.log(`pu    ${dash}  upgrade`);
    console.log(`pun   ${dash}  uninstall`);
    console.log(`pci   ${dash}  clean install`);
    console.log(`pa    ${dash}  agent alias`);
    console.log(`pi -v ${dash}  show used agent`);
    console.log(`pi -i ${dash}  interactive package management`);
    console.log(
      c.yellow(
        "\ncheck https://github.com/reliverse/pmx for more documentation.",
      ),
    );
    return;
  }

  const command = await getCliCommand(fn, args, options, cwd);

  if (!command) {
    return;
  }

  if (detectVolta && cmdExists("volta")) {
    command.args = ["run", command.command, ...command.args];
    command.command = "volta";
  }

  if (debug) {
    console.log(command);
    return;
  }

  await x(command.command, command.args, {
    nodeOptions: {
      stdio: "inherit",
      cwd,
    },
    throwOnError: true,
  });
}
