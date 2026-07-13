const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle sql.js's wasm binary as an asset so the web build serves it
// same-origin (works on GitHub Pages, no CDN dependency).
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
