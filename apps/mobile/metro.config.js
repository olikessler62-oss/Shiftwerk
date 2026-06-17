const { loadMobileEnv } = require("./load-mobile-env");
loadMobileEnv();

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// npm workspaces: dependencies are hoisted to the repo root (e.g. react-native-web).
config.watchFolders = [
  workspaceRoot,
  ...config.watchFolders.filter(
    (folder) => path.basename(folder) !== 'web'
  ),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Mobile does not import the Next.js app; keep Metro from crawling apps/web/.next.
const buildArtifactBlockList = [
  /[\\/]\.next[\\/].*/,
  /[\\/]\.turbo[\\/].*/,
  // Do not block `node_modules/**/dist` (e.g. react-native-web/dist).
  /[\\/]apps[\\/][^\\/]+[\\/]dist[\\/].*/,
  /[\\/]packages[\\/][^\\/]+[\\/]dist[\\/].*/,
];

config.resolver.blockList = config.resolver.blockList
  ? [config.resolver.blockList, ...buildArtifactBlockList]
  : buildArtifactBlockList;

module.exports = config;
