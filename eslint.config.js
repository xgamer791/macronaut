const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      // False positive: the package resolves fine via TS/Metro but its
      // exports map confuses eslint-plugin-import's node resolver.
      'import/no-unresolved': ['error', { ignore: ['^@expo/vector-icons'] }],
    },
  },
]);
