"use strict";

const { Module, createRequire } = require("module");
const path = require("path");
const process = require("process");
const vm = require("vm");

const babel = require("@babel/core");

function getModule(inputFile) {
  const filename = path.resolve(process.cwd(), inputFile);
  const scriptModule = new Module(filename, module);
  scriptModule.filename = filename;
  const baseRequire = createRequire(filename);
  scriptModule.require = (id) => {
    if ((id.startsWith("./") || id.startsWith("../")) && id.endsWith(".jsx")) {
      return getModule(path.resolve(path.dirname(filename), id)).exports;
    } else {
      return baseRequire(id);
    }
  };
  const ctx = vm.createContext({
    module: scriptModule,
    exports: scriptModule.exports,
    require: scriptModule.require,
  });

  const { code } = babel.transformFileSync(inputFile, {
    presets: [
      [
        require.resolve("@babel/preset-react"),
        {
          runtime: "automatic",
          importSource: "static-jsx",
        },
      ],
    ],
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  });

  const script = new vm.Script(code, { filename });
  script.runInContext(ctx);
  return scriptModule;
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addTemplateFormats("jsx");
  eleventyConfig.addExtension("jsx", {
    outputFileExtension: "html",
    read: false,
    compile(_content, inputFile) {
      const inputModule = getModule(inputFile);
      // It is important to require the same static-jsx which was required by
      // the temporary module or the RawHtml constructors will be different,
      // resulting in improperly escaped output.
      const { RawHtml, h } = inputModule.require("static-jsx");

      return (data) => {
        const children = [];
        if (data.content !== undefined) {
          children.push(new RawHtml(data.content));
        }

        return h(
          inputModule.exports.render.bind(eleventyConfig.javascriptFunctions),
          data,
          ...children
        ).html;
      };
    },
    async getData(inputFile) {
      const data = getModule(inputFile).exports.data;
      if (data === undefined || data === null) {
        return {};
      } else if (data instanceof Function) {
        return await data();
      } else if (typeof data === "object") {
        return data;
      } else {
        throw new Error(`Unexpected data format: ${data}`);
      }
    },
  });
};
