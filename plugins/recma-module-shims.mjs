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
          return transformExportAllDeclaration(child);
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
      return [
        decl.declaration,
        ...getDeclaredIdentifiers(decl.declaration).map((id) =>
          exportAssignment(id, id)
        ),
      ];
    } else if (decl.source !== null) {
      const importId = importIdGenerator();
      return [
        {
          type: "VariableDeclaration",
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
          })
        ),
      ];
    } else {
      return [
        ...decl.specifiers.map(({ exported, local }) =>
          exportAssignment(exported, local)
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
        decl.declaration.id = exportIdGenerator();
      }
      return [
        decl.declaration,
        exportAssignment(
          { type: "Identifier", name: "default" },
          decl.declaration.id
        ),
      ];
    } else {
      return [
        exportAssignment(
          { type: "Identifier", name: "default" },
          decl.declaration
        ),
      ];
    }
  }

  /**
   * @param {ExportAllDeclaration} decl
   * @param {() => Identifier} importIdGenerator
   * @param {() => Identifier} exportIdGenerator
   * @returns {Array<Statement>}
   */
  function transformExportAllDeclaration() {
    // TODO
    return [];
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
