// CommonJS on purpose: Turbopack treats its exports as dynamic, so any named import resolves (to undefined)
// instead of failing the build. Only optional dependencies we never execute are aliased here.
module.exports = {};
