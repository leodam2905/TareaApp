const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch monorepo root so Metro sees all workspace packages
config.watchFolders = [monorepoRoot];

// Only alias packages that are hoisted to root but needed in mobile web
config.resolver.extraNodeModules = {
  "react-native-web": path.resolve(monorepoRoot, "node_modules/react-native-web"),
};

module.exports = config;
