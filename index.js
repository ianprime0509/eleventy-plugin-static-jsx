"use strict";

module.exports = function (eleventyConfig) {
  const extension = {
    outputFileExtension: "html",
    read: false,
    async compile(_content, inputFile) {
      const { RawHtml, h } = await import("static-jsx");
      const { default: evaluateAndCompilePath } = await import(
        "./evaluate.mjs"
      );
      const { default: component } = await evaluateAndCompilePath(inputFile);

      return (data) => {
        const children = [];
        if (data.content !== undefined) {
          children.push(new RawHtml(data.content));
        }

        return h(
          component.bind(eleventyConfig.javascriptFunctions),
          data,
          ...children,
        ).html;
      };
    },
    async getData(inputFile) {
      const { default: evaluate } = await import("./evaluate.mjs");
      const { data } = await evaluate(inputFile);
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
  };

  eleventyConfig.addTemplateFormats("jsx");
  eleventyConfig.addExtension("jsx", extension);
  eleventyConfig.addTemplateFormats("mdx");
  eleventyConfig.addExtension("mdx", extension);
};
