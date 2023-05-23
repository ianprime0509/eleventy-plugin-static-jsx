module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  env: {
    node: true,
  },
  overrides: [
    {
      files: ["**/*.mjs"],
      parserOptions: {
        sourceType: "module",
      },
    },
  ],
};
