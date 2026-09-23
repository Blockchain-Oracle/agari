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
  const { name } = useTheme();
  const glyph = MARK_GLYPHS[slug];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={16} fill={hex} />
      {glyph?.ring && name === "dark" ? <Circle cx={16} cy={16} r={15.5} fill="none" stroke="rgba(255, 255, 255, 0.22)" strokeWidth={1} /> : null}
      {glyph ? (
        <Path d={glyph.d} transform={glyphTransform(glyph)} fill="#FFFFFF" />
      ) : (
        <SvgText x={16} y={21.5} fill="#FFFFFF" fontFamily={FONT.headingHeavy} fontSize={monogram.length > 2 ? 11 : 15} textAnchor="middle">{monogram}</SvgText>
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

function BasketDisc({ basket, size }: { basket: Basket; size: number }) {
  const cell = size / 2;
  return (
    <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2, backgroundColor: basket.brand.hex }]}>
      {basketClusterCells(basket).map((c) =>
        c.kind === "member" ? (
          <AssetDisc key={c.symbol} asset={c.symbol} size={cell} />
        ) : (
          <View key="more" style={[styles.more, { width: cell, height: cell }]}>
            <Text style={{ color: "#FFFFFF", fontFamily: FONT.headingHeavy, fontSize: cell * 0.42 }}>+{c.count}</Text>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  generic: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: -3, bottom: -2, paddingHorizontal: 2, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cluster: { flexDirection: "row", flexWrap: "wrap", overflow: "hidden" },
  more: { alignItems: "center", justifyContent: "center" },
});
