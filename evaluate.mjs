import path from "node:path";

import { createProcessor as createBaseMdxProcessor } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import { read as readVFile } from "to-vfile";
import { unified } from "unified";

import { recmaExportFrontmatter } from "./plugins/recma-export-frontmatter.mjs";
import { recmaJsxBuild } from "./plugins/recma-jsx-build.mjs";
import { recmaJsxParse } from "./plugins/recma-jsx-parse.mjs";
import { recmaJsxPragma } from "./plugins/recma-jsx-pragma.mjs";
import { recmaModuleShims } from "./plugins/recma-module-shims.mjs";
import { recmaStringify } from "./plugins/recma-stringify.mjs";
import { remarkParseFrontmatter } from "./plugins/remark-parse-frontmatter.mjs";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

export default async function compileAndEvaluatePath(inputPath) {
  const input = await readVFile(inputPath);
  const pipeline = inputPath.endsWith(".mdx")
    ? createMdxProcessor()
    : createJsxProcessor();
  const compiled = await pipeline.process(input);
  return await evaluate(compiled);
}

async function evaluate(compiled) {
  const func = new AsyncFunction("__import", "__exports", compiled.value);
  const exports = {};
  await func(
    async (id) => await transformingImport(id, compiled.path),
    exports
  );
  return exports;
}

async function transformingImport(id, basePath) {
  if (id.startsWith("./") || id.startsWith("../")) {
    const resolvedPath = path.resolve(path.dirname(basePath), id);
    if (id.endsWith(".mdx") || id.endsWith(".jsx")) {
      return await compileAndEvaluatePath(resolvedPath);
    } else {
      return await import(resolvedPath);
    }
  } else {
    return await import(id);
  }
}

function createJsxProcessor({ recmaPlugins } = {}) {
  return unified()
    .use(recmaJsxParse)
    .use(recmaJsxPragma)
    .use(recmaJsxBuild)
    .use(recmaPlugins ?? [])
    .use(recmaModuleShims)
    .use(recmaStringify);
}

function createMdxProcessor({
  recmaPlugins,
  rehypePlugins,
  remarkPlugins,
} = {}) {
  return createBaseMdxProcessor({
    jsxRuntime: "automatic",
    jsxImportSource: "static-jsx",
    recmaPlugins: [
      recmaExportFrontmatter,
      ...(recmaPlugins ?? []),
      recmaModuleShims,
    ],
    rehypePlugins,
    remarkPlugins: [
      remarkFrontmatter,
      remarkParseFrontmatter,
      ...(remarkPlugins ?? []),
    ],
  });
}
