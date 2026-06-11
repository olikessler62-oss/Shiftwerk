const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Mobile does not import the Next.js app; keep Metro from crawling apps/web/.next.
config.watchFolders = config.watchFolders.filter(
  (folder) => path.basename(folder) !== 'web'
);

const buildArtifactBlockList = [
  /[\\/]\.next[\\/].*/,
  /[\\/]\.turbo[\\/].*/,
  /[\\/]dist[\\/].*/,
];

config.resolver.blockList = config.resolver.blockList
  ? [config.resolver.blockList, ...buildArtifactBlockList]
  : buildArtifactBlockList;

module.exports = config;
