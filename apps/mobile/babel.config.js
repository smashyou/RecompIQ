module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-reanimated v4 moved its babel plugin into worklets.
    // Must stay last in the plugin list.
    plugins: ["react-native-worklets/plugin"],
  };
};
