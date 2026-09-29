const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The website and native apps bundle the same policy content.
config.watchFolders = [...new Set([
  ...(config.watchFolders || []),
  path.resolve(__dirname, '../../shared'),
])];

module.exports = config;
