import { test } from "uvu";
import * as assert from "uvu/assert";

import { Parser } from "acorn";
import { fromEstree } from "esast-util-from-estree";
import { unified } from "unified";
import { VFile } from "vfile";

import { recmaModuleShims } from "./recma-module-shims.mjs";
import { recmaStringify } from "./recma-stringify.mjs";

// TODO: the transform is still missing some cases and the transformed code is
// probably not as efficient/nice as it could be.

// One thing which I'm not entirely sure about is something like
//
// export let a;
// // some time later...
// a = 2;
//
// Need to check how this (and other mutable exports) are supposed to behave.
// Maybe not worth supporting?

testTransform(
  "no imports or exports",
  `const i = 2;

function f(j) {
  return 1 + j;
}
`,
  `const i = 2;

function f(j) {
  return 1 + j;
}
`,
);

testTransform(
  "named imports",
  `import { a, b } from "module";`,
  `const __import0 = await __import("module"), a = __import0.a, b = __import0.b;`,
);

testTransform(
  "named imports with renaming",
  `import { a as c, b as d } from "module";`,
  `const __import0 = await __import("module"), c = __import0.a, d = __import0.b;`,
);

testTransform(
  "default import",
  `import something from "module";`,
  `const __import0 = await __import("module"), something = __import0.default;`,
);

testTransform(
  "default import and named imports",
  `import something, { a, b as d } from "module";`,
  `const __import0 = await __import("module"), something = __import0.default, a = __import0.a, d = __import0.b;`,
);

testTransform(
  "import all",
  `import * as ns from "module";`,
  `const __import0 = await __import("module"), ns = __import0;`,
);

testTransform(
  "import all and default",
  `import main, * as mod from "module";`,
  `const __import0 = await __import("module"), main = __import0.default, mod = __import0`,
);

testTransform(
  "import for side-effects",
  `import "module";`,
  `const __import0 = await __import("module");`,
);

// TODO
testTransform(
  "dynamic import",
  `const mod = await import("module");`,
  `const mod = await __import("module");`,
  { skip: true },
);

// TODO
testTransform(
  "dynamic import without promise",
  `const promise = import("module");`,
  `const promise = __import("module");`,
  { skip: true },
);

testTransform(
  "export single var declaration",
  `export var a = 2;`,
  `var a = 2;
__exports.a = a;`,
);

testTransform(
  "export multiple var declaration",
  `export var a = 2 + 2, b = call({ a: 7 });`,
  `var a = 2 + 2, b = call({ a: 7 });
__exports.a = a;
__exports.b = b;`,
);

testTransform(
  "export single let declaration",
  `export let something = 8 * f(5);`,
  `let something = 8 * f(5);
__exports.something = something;`,
);

testTransform(
  "export multiple let delcaration",
  `export let a = 1, b = 2, c = 3;`,
  `let a = 1, b = 2, c = 3;
__exports.a = a;
__exports.b = b;
__exports.c = c;`,
);

testTransform(
  "export single const declaration",
  `export const a = 8;`,
  `const a = 8;
__exports.a = a;`,
);

testTransform(
  "export multiple const declaration",
  `export const a1 = 5, a2 = 8;`,
  `const a1 = 5, a2 = 8;
__exports.a1 = a1;
__exports.a2 = a2;`,
);

// TODO
testTransform(
  "export with array destructuring",
  `export const [a, b] = [1, 2];`,
  `const [a, b] = [1, 2];
__exports.a = a;
__exports.b = b;`,
  { skip: true },
);

// TODO
testTransform(
  "exports with object destructuring",
  `export const { a, b: c } = obj;`,
  `const { a, b: c } = obj;
__exports.a = a;
__exports.c = c;`,
  { skip: true },
);

testTransform(
  "export function",
  `export function a(i, j) {
  return Math.sin(i + j);
}`,
  `function a(i, j) {
  return Math.sin(i + j);
}
__exports.a = a;`,
);

testTransform(
  "export class",
  `export class Component {
  constructor(a = 2) {
    this.a = a;
  }

  render() {
    return "a = " + this.a;
  }
}`,
  `class Component {
  constructor(a = 2) {
    this.a = a;
  }

  render() {
    return "a = " + this.a;
  }
}
__exports.Component = Component;`,
);

testTransform(
  "export names",
  `const a = 1, b = 2, c = 3;
export { a, b, c };`,
  `const a = 1, b = 2, c = 3;
__exports.a = a;
__exports.b = b;
__exports.c = c;`,
);

testTransform(
  "export and rename names",
  `const a = 1, c = 2;
export { a as b, c as d };`,
  `const a = 1, c = 2;
__exports.b = a;
__exports.d = c;`,
);

testTransform(
  "export default expression",
  `export default 1 + 1;`,
  `__exports.default = 1 + 1;`,
);

testTransform(
  "export default named function",
  `export default function render() {
  return "123";
}`,
  `function render() {
  return "123";
}
__exports.default = render;`,
);

testTransform(
  "export default anonymous function",
  `export default function () {
  return "123";
}`,
  `function __export0() {
  return "123";
}
__exports.default = __export0;`,
);

testTransform(
  "export default named async function",
  `export default async function f(p) {
  return (await p).stuff;
}`,
  `async function f(p) {
  return (await p).stuff;
}
__exports.default = f;`,
);

testTransform(
  "export default anonymous async function",
  `export default async function (p) {
return (await p).stuff;
}`,
  `async function __export0(p) {
return (await p).stuff;
}
__exports.default = __export0;`,
);

// TODO: tests with generator functions and classes

testTransform(
  "export default through rename",
  `const a = 1;
export { a as default };`,
  `const a = 1;
__exports.default = a;`,
);

testTransform(
  "export all from module",
  `export * from "module";`,
  `const { default: __temp0, ...__temp1 } = await __import("module");
Object.assign(__exports, __temp1);`,
);

testTransform(
  "export all from module with rename",
  `export * as ns from "module";`,
  `__exports.ns = await __import("module");`,
);

testTransform(
  "export select items from module",
  `export { a, b, c } from "module";`,
  `const __import0 = await __import("module");
__exports.a = __import0.a;
__exports.b = __import0.b;
__exports.c = __import0.c;`,
);

testTransform(
  "export select items from module with rename",
  `export { a as b, c as d } from "module";`,
  `const __import0 = await __import("module");
__exports.b = __import0.a;
__exports.d = __import0.c;`,
);

testTransform(
  "export default from module",
  `export { default } from "module";`,
  `const __import0 = await __import("module");
__exports.default = __import0.default;`,
);

testTransform(
  "export default from module with rename",
  `export { default as a } from "module";`,
  `const __import0 = await __import("module");
__exports.a = __import0.default;`,
);

test.run();

function testTransform(name, input, expected, { skip = false } = {}) {
  (skip ? test.skip : test)("name", () => {
    const output = unified()
      .use(recmaParse)
      .use(recmaModuleShims)
      .use(recmaStringify)
      .processSync(new VFile(input));

    // Normalize expected value
    expected = unified()
      .use(recmaParse)
      .use(recmaStringify)
      .processSync(new VFile(expected));

    assert.equal(output.value, expected.value);
  });

  function recmaParse() {
    this.Parser = (content) =>
      fromEstree(
        Parser.parse(content, { ecmaVersion: "latest", sourceType: "module" }),
      );
  }
}
