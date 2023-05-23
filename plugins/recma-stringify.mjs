import { generate } from "astring";

export function recmaStringify() {
  this.Compiler = (content) => generate(content);
}
