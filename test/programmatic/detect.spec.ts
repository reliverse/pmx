import type { MockInstance } from "vitest";

import fs from "fs-extra";
import { tmpdir } from "node:os";
import path from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AGENTS, detectPMX } from "../../src";

let basicLog: MockInstance;
let errorLog: MockInstance;
let warnLog: MockInstance;
let infoLog: MockInstance;

function detectTest(fixture: string, agent: string) {
  return async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), "pmx-"));
    const dir = path.join(__dirname, "..", "fixtures", fixture, agent);
    await fs.copy(dir, cwd);

    expect(await detectPMX({ programmatic: true, cwd })).toMatchSnapshot();
  };
}

beforeAll(() => {
  basicLog = vi.spyOn(console, "log");
  warnLog = vi.spyOn(console, "warn");
  errorLog = vi.spyOn(console, "error");
  infoLog = vi.spyOn(console, "info");
});

afterAll(() => {
  vi.resetAllMocks();
});

const agents = [...AGENTS, "unknown"];
const fixtures = ["lockfile", "packager"];

// matrix testing of: fixtures x agents
fixtures.forEach((fixture) =>
  describe(fixture, () =>
    agents.forEach((agent) => {
      it(agent, detectTest(fixture, agent));

      it("no logs", () => {
        expect(basicLog).not.toHaveBeenCalled();
        expect(warnLog).not.toHaveBeenCalled();
        expect(errorLog).not.toHaveBeenCalled();
        expect(infoLog).not.toHaveBeenCalled();
      });
    })),
);
