import prompts, { type Choice, type PromptType } from "@posva/prompts";
import { Fzf } from "fzf";
import process from "node:process";

import { getPackageJSON } from "../fs";
import { parseNun } from "../parse";
import { runCli } from "../runner";
import { exclude } from "../utils";

await runCli(async (agent, args, ctx) => {
  const isInteractive = !args.length && !ctx?.programmatic;

  if (isInteractive || args[0] === "-m") {
    const pkg = getPackageJSON(ctx);

    const allDependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    const raw = Object.entries(allDependencies);

    if (!raw.length) {
      console.error("No dependencies found");
      return;
    }

    const fzf = new Fzf(raw, {
      selector: ([dep, version]) => `${dep} ${version}`,
      casing: "case-insensitive",
    });

    const choices: Choice[] = raw.map(([dependency, version]) => ({
      title: dependency,
      value: dependency,
      description: version?.toString(),
    }));

    const isMultiple = args[0] === "-m";

    const type: PromptType = isMultiple
      ? "autocompleteMultiselect"
      : "autocomplete";

    if (isMultiple) {
      args = exclude(args, "-m");
    }

    try {
      const { depsToRemove } = await prompts({
        type,
        name: "depsToRemove",
        choices,
        instructions: false,
        message: `remove ${isMultiple ? "dependencies" : "dependency"}`,
        async suggest(input: string, choices: Choice[]) {
          const results = fzf.find(input);
          return results.map((r) => choices.find((c) => c.value === r.item[0]));
        },
      });

      if (!depsToRemove) {
        process.exitCode = 1;
        return;
      }

      const isSingleDependency = typeof depsToRemove === "string";

      if (isSingleDependency) {
        args.push(depsToRemove);
      } else {
        args.push(...depsToRemove);
      }
    } catch {
      process.exit(1);
    }
  }

  return parseNun(agent, args, ctx);
});
