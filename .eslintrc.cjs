module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  env: { node: true, browser: true, es2022: true },
  ignorePatterns: ["dist", "node_modules", "*.js", "!.eslintrc.cjs"],
};
