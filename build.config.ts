import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: [
    {
      outDir: "dist",
      builder: "mkdist",
      input: "src",
      format: "esm",
      ext: "js",
    },
  ],
  rollup: {
    inlineDependencies: true,
    emitCJS: false,
    esbuild: {
      target: "es2022",
    },
  },
});
