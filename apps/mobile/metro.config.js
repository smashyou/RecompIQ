// Metro config for the RecompIQ Expo app inside the pnpm + Turborepo monorepo.
//
// Two jobs:
//   1. Make Metro watch the whole repo so it transpiles the source-consumed
//      @peptide/* TypeScript packages (their `exports` point straight at .ts —
//      there is no build step).
//   2. Resolve modules from both the app's node_modules and the workspace root
//      (pnpm hoists the shared store there).
//
// NativeWind wraps the final config to compile global.css → RN styles.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// pnpm symlinks workspace packages; follow them to real paths under the repo.
config.resolver.unstable_enableSymlinks = true;
// With explicit nodeModulesPaths above, don't also walk parent dirs.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
