// The React Compiler memoizes the app's own components only. Web code the app reuses (web/src, packages/*) runs
// uncompiled in web, and some of its hooks rely on that: compiling them here broke useReadingQuery at runtime.
module.exports = function config(api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { "react-compiler": { sources: (filename) => filename.includes("/mobile/src/") } }]],
  };
};
