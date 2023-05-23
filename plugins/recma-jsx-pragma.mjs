export function recmaJsxPragma() {
  return (tree) => {
    if (!tree.comments) tree.comments = [];

    tree.comments.unshift({
      type: "Block",
      value: "@jsxRuntime automatic @jsxImportSource static-jsx",
    });
  };
}
