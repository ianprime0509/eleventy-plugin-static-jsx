/**
 * @typedef {import("estree-jsx").ExportNamedDeclaration} ExportNamedDeclaration
 */

export function recmaExportFrontmatter() {
  return (tree, file) => {
    const data = file.data.frontmatter;
    if (data) {
      /** @type ExportNamedDeclaration */
      const exportNode = {
        type: "ExportNamedDeclaration",
        declaration: {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: {
                type: "Identifier",
                name: "data",
              },
              init: {
                type: "CallExpression",
                callee: {
                  type: "MemberExpression",
                  object: {
                    type: "Identifier",
                    name: "JSON",
                  },
                  property: {
                    type: "Identifier",
                    name: "parse",
                  },
                  computed: false,
                },
                arguments: [
                  {
                    type: "Literal",
                    value: JSON.stringify(data),
                  },
                ],
              },
            },
          ],
        },
      };
      tree.body.push(exportNode);
    }
  };
}
