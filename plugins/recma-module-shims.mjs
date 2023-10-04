/**
 * @typedef {import("estree-jsx").Program} Program
 * @typedef {import("estree-jsx").Statement} Statement
 * @typedef {import("estree-jsx").Declaration} Declaration
 * @typedef {import("estree-jsx").Identifier} Identifier
 * @typedef {import("estree-jsx").AwaitExpression} AwaitExpression
 * @typedef {import("estree-jsx").ImportDeclaration} ImportDeclaration
 * @typedef {import("estree-jsx").ExportNamedDeclaration} ExportNamedDeclaration
 * @typedef {import("estree-jsx").ExportDefaultDeclaration} ExportDefaultDeclaration
 * @typedef {import("estree-jsx").ExportAllDeclaration} ExportAllDeclaration
 * @typedef {import("estree-jsx").VariableDeclaration} VariableDeclaration
 * @typedef {import("estree-jsx").VariableDeclarator} VariableDeclarator
 *
 * @typedef RecmaModuleShimsOptions
 * @property {string} [importName="__import"]
 * @property {string} [exportsName="__exports"]
 */
// TODO: consider import assertions at some point
// See https://github.com/xtuc/acorn-import-assertions for an option for parsing

/**
 * @type {import("unified").Plugin<[RecmaModuleShimsOptions]|[], Program>}
 */
export function recmaModuleShims({
  importFunction = "__import",
  exportsObject = "__exports",
} = {}) {
  /** @type {Identifier} */
  const importFunctionId = {
    type: "Identifier",
    name: importFunction,
  };
  /** @type {Identifier} */
  const exportsObjectId = {
    type: "Identifier",
    name: exportsObject,
  };

  const importIdGenerator = idGenerator("__import");
  const exportIdGenerator = idGenerator("__export");
  const tempIdGenerator = idGenerator("__temp");

  return (tree) => {
    const imports = [];
    const convertedBody = tree.body.flatMap((child) => {
      switch (child.type) {
        case "ImportDeclaration":
          imports.push(transformImportDeclaration(child, importIdGenerator));
          return [];
        case "ExportNamedDeclaration":
          return transformExportNamedDeclaration(child, importIdGenerator);
        case "ExportDefaultDeclaration":
          return transformExportDefaultDeclaration(child, exportIdGenerator);
        case "ExportAllDeclaration":
          return transformExportAllDeclaration(
            child,
            importIdGenerator,
            tempIdGenerator,
          );
        default:
          return [child];
      }
    });
    tree.body = [...imports, ...convertedBody];
  };

  /**
   * @param {string} prefix
   * @returns {() => Identifier}
   */
  function idGenerator(prefix) {
    let i = 0;
    return () => ({ type: "Identifier", name: prefix + i++ });
  }

  /**
   * @param {ImportDeclaration} decl
   * @param {() => Identifier} importIdGenerator
   * @returns {Statement}
   */
  function transformImportDeclaration(decl, importIdGenerator) {
    const importId = importIdGenerator();

    /** @type {Array<VariableDeclarator>} */
    const declarations = [
      {
        type: "VariableDeclarator",
        id: importId,
        init: awaitImport(decl.source),
      },
    ];
    for (const spec of decl.specifiers) {
      switch (spec.type) {
        case "ImportSpecifier":
          declarations.push({
            type: "VariableDeclarator",
            id: spec.local,
            init: {
              type: "MemberExpression",
              object: importId,
              property: spec.imported,
              computed: false,
            },
          });
          break;
        case "ImportDefaultSpecifier":
          declarations.push({
            type: "VariableDeclarator",
            id: spec.local,
            init: {
              type: "MemberExpression",
              object: importId,
              property: {
                type: "Identifier",
                name: "default",
              },
              computed: false,
            },
          });
          break;
        case "ImportNamespaceSpecifier":
          declarations.push({
            type: "VariableDeclarator",
            id: spec.local,
            init: importId,
          });
          break;
      }
    }

    return {
      type: "VariableDeclaration",
      kind: "const",
      declarations,
    };
  }

  /**
   * @param {ExportNamedDeclaration} decl
   * @param {() => Identifier} importIdGenerator
   * @returns {Array<Statement>}
   */
  function transformExportNamedDeclaration(decl, importIdGenerator) {
    if (decl.declaration !== null) {
      // e.g. export const a = 2;
      return [
        decl.declaration,
        ...getDeclaredIdentifiers(decl.declaration).map((id) =>
          exportAssignment(id, id),
        ),
      ];
    } else if (decl.source !== null) {
      // e.g. export { a, b as c } from "some-module";
      const importId = importIdGenerator();
      return [
        {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: importId,
              init: awaitImport(decl.source),
            },
          ],
        },
        ...decl.specifiers.map(({ exported, local }) =>
          exportAssignment(exported, {
            type: "MemberExpression",
            object: importId,
            property: local,
            computed: false,
          }),
        ),
      ];
    } else {
      // e.g. export { a, b as c };
      return [
        ...decl.specifiers.map(({ exported, local }) =>
          exportAssignment(exported, local),
        ),
      ];
    }
  }

  /**
   * @param {ExportDefaultDeclaration} decl
   * @param {() => Identifier} exportIdGenerator
   * @returns {Array<Statement>}
   */
  function transformExportDefaultDeclaration(decl, exportIdGenerator) {
    if (
      decl.declaration.type === "FunctionDeclaration" ||
      decl.declaration.type === "ClassDeclaration"
    ) {
      if (decl.declaration.id === null) {
        // e.g. export default function () {}
        // Currently, we generate a name for the function/class to make the
        // logic simpler.
        decl.declaration.id = exportIdGenerator();
      }
      return [
        decl.declaration,
        exportAssignment(
          { type: "Identifier", name: "default" },
          decl.declaration.id,
        ),
      ];
    } else {
      // e.g. export default a;
      return [
        exportAssignment(
          { type: "Identifier", name: "default" },
          decl.declaration,
        ),
      ];
    }
  }

  /**
   * @param {ExportAllDeclaration} decl
   * @param {() => Identifier} importIdGenerator
   * @param {() => Identifier} tempIdGenerator
   * @returns {Array<Statement>}
   */
  function transformExportAllDeclaration(
    decl,
    importIdGenerator,
    tempIdGenerator,
  ) {
    if (decl.exported !== null) {
      // e.g. export * as ns from "some-module";
      return [exportAssignment(decl.exported, awaitImport(decl.source))];
    } else {
      // e.g. export * from "some-module";
      // We have to exclude the default import, which makes this a bit more
      // complicated.
      const tempIdDefault = tempIdGenerator();
      const tempIdRest = tempIdGenerator();
      return [
        {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: {
                type: "ObjectPattern",
                properties: [
                  {
                    type: "Property",
                    kind: "init",
                    method: false,
                    shorthand: false,
                    computed: false,
                    key: {
                      type: "Identifier",
                      name: "default",
                    },
                    value: tempIdDefault,
                  },
                  {
                    type: "RestElement",
                    argument: tempIdRest,
                  },
                ],
              },
              init: awaitImport(decl.source),
            },
          ],
        },
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: {
              type: "MemberExpression",
              computed: false,
              object: {
                type: "Identifier",
                name: "Object",
              },
              property: {
                type: "Identifier",
                name: "assign",
              },
            },
            arguments: [exportsObjectId, tempIdRest],
          },
        },
      ];
    }
  }

  /**
   * @param {Identifier} source
   * @returns {AwaitExpression}
   */
  function awaitImport(source) {
    return {
      type: "AwaitExpression",
      argument: {
        type: "CallExpression",
        callee: importFunctionId,
        arguments: [source],
      },
    };
  }

  /**
   * @param {Identifier} name
   * @param {Expression} expr
   * @returns {Statement}
   */
  function exportAssignment(name, expr) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "MemberExpression",
          object: exportsObjectId,
          property: name,
          computed: false,
        },
        right: expr,
      },
    };
  }

  /**
   * @param {Declaration} decl
   * @returns {Array<Identifier>}
   */
  function getDeclaredIdentifiers(decl) {
    switch (decl.type) {
      case "ClassDeclaration":
        return [decl.id];
      case "FunctionDeclaration":
        return [decl.id];
      case "VariableDeclaration":
        return decl.declarations.map((d) => d.id);
      default:
        throw new Error(`Unrecognized declaration type: ${decl.type}`);
    }
  }
}
