export { Stop } from "react-native-svg";

const RGBA = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i;
const HEX8 = /^#([0-9a-f]{6})([0-9a-f]{2})$/i;

/**
 * A gradient stop's paint, as `<Stop offset="0" {...stopPaint(t.wash)} />`. react-native-svg reads a stop's props
 * straight off the element and replaces the colour's alpha with `stopOpacity` (1 by default), so an `rgba()` colour
 * painted solid: the Trader Edge page went vermilion and the Markets cards' 2 % wash went white to black. This moves
 * the alpha into `stopOpacity`, times any `opacity` given.
 */
export function stopPaint(color: string, opacity = 1): { stopColor: string; stopOpacity: number } {
  const c = color.trim();
  if (c === "transparent") return { stopColor: "black", stopOpacity: 0 };
  const rgba = RGBA.exec(c);
  if (rgba) {
    const a = rgba[4] === undefined ? 1 : rgba[4].endsWith("%") ? Number.parseFloat(rgba[4]) / 100 : Number(rgba[4]);
    return { stopColor: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, stopOpacity: a * opacity };
  }
  const hex = HEX8.exec(c);
  if (hex) return { stopColor: `#${hex[1]}`, stopOpacity: (Number.parseInt(hex[2] ?? "ff", 16) / 255) * opacity };
  return { stopColor: c, stopOpacity: opacity };
}
