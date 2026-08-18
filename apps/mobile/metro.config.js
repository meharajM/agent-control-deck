const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const appRoot = __dirname;
const workspaceRoot = path.resolve(appRoot, '../..');
const config = getDefaultConfig(appRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(appRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  'react-native-zeroconf': path.resolve(appRoot, 'node_modules/react-native-zeroconf'),
  '@expo/metro-runtime': path.resolve(appRoot, 'node_modules/@expo/metro-runtime'),
};

module.exports = config;
