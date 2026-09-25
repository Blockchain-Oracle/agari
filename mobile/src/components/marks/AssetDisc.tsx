import { assetTicker, basketOf, type Basket } from "@agari/core/market";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { MARK_GLYPHS, glyphTransform } from "@/components/icons/asset-marks/paths";
import { assetMonogram, basketClusterCells, TOKEN_BADGE } from "@/features/markets/hero/asset-mark";
import { FONT, useTheme } from "~/theme";

/**
 * web's AssetDisc (features/markets/hero/asset-mark.tsx) in native drawing: the registry brand's own colour and
 * vendored glyph (web's paths.ts), the issuer badge on a share token, a two-by-two cluster for a basket.
 */
export function AssetDisc({ asset, size = 28 }: { asset: string; size?: number }) {
  const basket = basketOf(asset);
  if (basket) return <BasketDisc basket={basket} size={size} />;
  const found = assetTicker(asset);
  const token = found?.token ? TOKEN_BADGE[found.token] : null;
  return (
    <View style={{ width: size, height: size }}>
      {found ? <BrandMark slug={found.ticker.brand.slug} hex={found.ticker.brand.hex} monogram={found.ticker.monogram} size={size} /> : <Generic asset={asset} size={size} />}
      {token ? <TokenBadge text={token} size={size} /> : null}
    </View>
  );
}

function BrandMark({ slug, hex, monogram, size }: { slug: keyof typeof MARK_GLYPHS; hex: string; monogram: string; size: number }) {
  const { name, color } = useTheme();
  const glyph = MARK_GLYPHS[slug];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={16} fill={hex} />
      {glyph?.ring && name === "dark" ? <Circle cx={16} cy={16} r={15.5} fill="none" stroke={color.markRing} strokeWidth={1} /> : null}
      {glyph ? (
        <Path d={glyph.d} transform={glyphTransform(glyph)} fill={color.markGlyph} />
      ) : (
        <SvgText x={16} y={21.5} fill={color.markGlyph} fontFamily={FONT.headingHeavy} fontSize={monogram.length > 2 ? 11 : 15} textAnchor="middle">{monogram}</SvgText>
      )}
    </Svg>
  );
}

function Generic({ asset, size }: { asset: string; size: number }) {
  const { color } = useTheme();
  return (
    <View style={[styles.generic, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.surface2 }]}>
      <Text style={{ color: color.ink, fontFamily: FONT.headingHeavy, fontSize: size * 0.45 }}>{assetMonogram(asset)}</Text>
    </View>
  );
}

function TokenBadge({ text, size }: { text: string; size: number }) {
  const { color } = useTheme();
  const h = Math.max(10, Math.round(size * 0.42));
  return (
    <View style={[styles.badge, { height: h, minWidth: h, borderRadius: h / 2, backgroundColor: color.ink, borderColor: color.ground }]}>
      <Text style={{ color: color.ground, fontFamily: FONT.headingHeavy, fontSize: h * 0.62 }}>{text}</Text>
    </View>
  );
}

/**
 * web's BasketMark (icons.css `.basket-mark`): the members' marks on a two-by-two grid inside a pale disc, 4% padding and
 * gap; a pair sits on the diagonal, a third member centres at half width on the lower row; the "+N" cell wears the
 * basket's colour.
 */
function BasketDisc({ basket, size }: { basket: Basket; size: number }) {
  const { color } = useTheme();
  const pad = size * 0.04;
  const cell = (size - pad * 3) / 2;
  const cells = basketClusterCells(basket);
  const at = (i: number) => {
    if (cells.length === 2) return i === 0 ? { left: pad, top: pad } : { left: pad * 2 + cell, top: pad * 2 + cell };
    if (cells.length === 3 && i === 2) return { left: (size - cell) / 2, top: pad * 2 + cell };
    return { left: pad + (i % 2) * (cell + pad), top: pad + Math.floor(i / 2) * (cell + pad) };
  };
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.markBasket }}>
      {cells.map((c, i) => (
        <View key={c.kind === "member" ? c.symbol : "more"} style={[styles.cell, at(i), { width: cell, height: cell, borderRadius: cell / 2 }]}>
          {c.kind === "member" ? (
            <AssetDisc asset={c.symbol} size={cell} />
          ) : (
            <View style={[styles.more, { width: cell, height: cell, backgroundColor: basket.brand.hex }]}>
              <Text style={{ color: color.markGlyph, fontFamily: FONT.headingHeavy, fontSize: size * 0.34, letterSpacing: -0.02 * size * 0.34 }}>+{c.count}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  generic: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: -3, bottom: -2, paddingHorizontal: 2, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cell: { position: "absolute", overflow: "hidden" },
  more: { alignItems: "center", justifyContent: "center" },
});
