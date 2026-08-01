module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      require.resolve("./scripts/babel-plugin-cap-font-scaling"),
      "react-native-reanimated/plugin",
    ],
  };
};
