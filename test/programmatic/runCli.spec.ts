import type { MockInstance } from "vitest";

import fs from "fs-extra";
import { tmpdir } from "node:os";
import path from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Runner } from "../../src";

import {
  AGENTS,
  parseNa,
  parseNi,
  parseNlx,
  parseNu,
  parseNun,
  runCli,
} from "../../src";

let basicLog: MockInstance;
let errorLog: MockInstance;
let warnLog: MockInstance;
let infoLog: MockInstance;

function runCliTest(
  fixtureName: string,
  agent: string,
  runner: Runner,
  args: string[],
) {
  return async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), "pmx-"));
    const fixture = path.join(__dirname, "..", "fixtures", fixtureName, agent);
    await fs.copy(fixture, cwd);

    await runCli(
      async (agent, _, ctx) => {
        // we override the args to be test specific
        return runner(agent, args, ctx);
      },
      {
        programmatic: true,
        cwd,
        args,
      },
    ).catch((e) => {
      // it will always throw if ezspawn is mocked
      if (e.command) {
        expect(e.command).toMatchSnapshot();
      } else {
        expect(e.message).toMatchSnapshot();
      }
    });
  };
}

beforeAll(() => {
  basicLog = vi.spyOn(console, "log");
  warnLog = vi.spyOn(console, "warn");
  errorLog = vi.spyOn(console, "error");
  infoLog = vi.spyOn(console, "info");

  vi.mock("tinyexec", async (importOriginal) => {
    const mod = (await importOriginal()) as any;
    return {
      ...mod,
      x: (cmd: string, args?: string[]) => {
        // break execution flow for easier snapshotting
        // eslint-disable-next-line no-throw-literal
        throw { command: [cmd, ...(args ?? [])].join(" ") };
      },
    };
  });
});

afterAll(() => {
  vi.resetAllMocks();
});

const agents = [...AGENTS, "unknown"];
const fixtures = ["lockfile", "packager"];

// matrix testing of: fixtures x agents x commands
fixtures.forEach((fixture) =>
  describe(fixture, () =>
    agents.forEach((agent) =>
      describe(agent, () => {
        /** pa */
        it("na", runCliTest(fixture, agent, parseNa, []));
        it("na run foo", runCliTest(fixture, agent, parseNa, ["run", "foo"]));

        /** pi */
        it("pi", runCliTest(fixture, agent, parseNi, []));
        it("pi foo", runCliTest(fixture, agent, parseNi, ["foo"]));
        it("pi foo -D", runCliTest(fixture, agent, parseNi, ["foo", "-D"]));
        it("pi --frozen", runCliTest(fixture, agent, parseNi, ["--frozen"]));
        it("pi -g foo", runCliTest(fixture, agent, parseNi, ["-g", "foo"]));

        /** plx */
        it("plx", runCliTest(fixture, agent, parseNlx, ["foo"]));

        /** pu */
        it("pu", runCliTest(fixture, agent, parseNu, []));
        it("pu -i", runCliTest(fixture, agent, parseNu, ["-i"]));

        /** pun */
        it("pun foo", runCliTest(fixture, agent, parseNun, ["foo"]));
        it("pun -g foo", runCliTest(fixture, agent, parseNun, ["-g", "foo"]));

        it("no logs", () => {
          expect(basicLog).not.toHaveBeenCalled();
          expect(warnLog).not.toHaveBeenCalled();
          expect(errorLog).not.toHaveBeenCalled();
          expect(infoLog).not.toHaveBeenCalled();
        });
      }),
    )),
);
