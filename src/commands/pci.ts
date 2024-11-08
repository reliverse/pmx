import { parseNi } from "../parse";
import { runCli } from "../runner";

await runCli(
  (agent, _, hasLock) => parseNi(agent, ["--frozen-if-present"], hasLock),
  { autoInstall: true },
);
