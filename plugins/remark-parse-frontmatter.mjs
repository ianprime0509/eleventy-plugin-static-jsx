import yaml from "yaml";

export function remarkParseFrontmatter() {
  return (tree, file) => {
    if (tree.children.length > 0 && tree.children[0].type === "yaml") {
      const [{ value }] = tree.children.splice(0, 1);
      file.data.frontmatter = yaml.parse(value);
    }
  };
}
