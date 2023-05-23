import { buildJsx } from "estree-util-build-jsx";

export function recmaJsxBuild() {
  return (tree) => {
    buildJsx(tree);
  };
}
