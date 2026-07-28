import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // server.js and lib/*.cjs run outside the bundler, in CommonJS.
    files: ["**/*.cjs", "server.js", "lib/socket-bridge.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
