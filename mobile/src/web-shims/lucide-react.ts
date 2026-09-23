/**
 * Stands in for `lucide-react` wherever a web content module the app reuses names an icon (how-it-works content.ts,
 * sessions.ts): those modules keep icon components beside their words. The phone never renders a lucide icon — each
 * native screen draws SF Symbols / Material Symbols — so every named export resolves to one inert component instead
 * of bundling the whole DOM icon set.
 */
const Inert = () => null;

module.exports = new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : Inert) });
