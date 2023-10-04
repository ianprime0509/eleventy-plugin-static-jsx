import { Parser } from "acorn";
import acornJsx from "acorn-jsx";
import { fromEstree } from "esast-util-from-estree";

export function recmaJsxParse() {
  this.Parser = (content) =>
    fromEstree(
      Parser.extend(acornJsx()).parse(content, {
        ecmaVersion: "latest",
        sourceType: "module",
      }),
    );
}
