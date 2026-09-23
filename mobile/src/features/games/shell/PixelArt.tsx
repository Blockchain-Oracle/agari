import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "~/theme";

/**
 * web's `features/games/art/PixelArt.tsx`: the games' arts as pixel grids, painted with theme tokens so they
 * are ours, flip with the theme and carry no raw colour. Each row's runs of one colour are merged into one
 * rect, so edges stay square at any size.
 */
type Token = "profit" | "loss" | "accent" | "markGlyph" | "ground" | "borderStrong";

interface MarkProps {
  /** Width in points; the height follows the grid's aspect. */
  size: number;
  /** Given, the mark is announced as an image with this label; omitted, it is decoration. */
  title?: string;
}

interface Run {
  x: number;
  y: number;
  w: number;
  token: Token;
}

/** Each row's runs of one colour, as one rect apiece. */
function pixelRuns(rows: readonly string[], palette: Readonly<Record<string, Token>>): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const token = palette[row[x]!];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end += 1;
      if (token) runs.push({ x, y, w: end - x, token });
      x = end;
    }
  });
  return runs;
}

function Pixels({ rows, palette, size, title }: { rows: readonly string[]; palette: Readonly<Record<string, Token>>; size: number; title?: string }) {
  const { color } = useTheme();
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const runs = pixelRuns(rows, palette);
  return (
    <View
      accessible={title !== undefined}
      accessibilityRole={title ? "image" : undefined}
      accessibilityLabel={title}
      importantForAccessibility={title ? "yes" : "no-hide-descendants"}
    >
      <Svg width={size} height={(size * height) / width} viewBox={`0 0 ${width} ${height}`}>
        {runs.map((run) => (
          <Rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={color[run.token]} />
        ))}
      </Svg>
    </View>
  );
}

/** The bull: horns up, the UP colour. Reacts to an upward lean. */
export function BullMark({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ G: "profit", W: "markGlyph", K: "ground" }} rows={[
    "....W......W....",
    "....WW....WW....",
    ".....GGGGGG.....",
    "....GGGGGGGG....",
    "...GGKGGGGKGGG..",
    "...GGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "..GGGGGWWGGGGG..",
    "..GGGGGWWGGGGG..",
    "...GGGGGGGGGG...",
    "....GGGGGGGG....",
    ".....GG..GG.....",
    ".....GG..GG.....",
    "................",
  ]} />;
}

/** The bear: round ears, the DOWN colour. Reacts to a downward lean. */
export function BearMark({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ R: "loss", W: "markGlyph", K: "ground" }} rows={[
    "..RR........RR..",
    ".RRRR......RRRR.",
    ".RRRRRRRRRRRRRR.",
    "..RRRRRRRRRRRR..",
    "..RRKRRRRRRKRR..",
    "..RRRRRRRRRRRR..",
    "..RRRRRWWWRRRR..",
    "..RRRRRWKWRRRR..",
    "...RRRRRWRRRR...",
    "....RRRRRRRR....",
    ".....RR..RR.....",
    ".....RR..RR.....",
    "................",
  ]} />;
}

/** The coin at rest: the brand's one spark of colour, with a glint. */
export function CoinMark({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ V: "accent", W: "markGlyph", K: "ground" }} rows={[
    ".....VVVVVV.....",
    "...VVVVVVVVVV...",
    "..VVWWVVVVVVVV..",
    ".VVWVVVVVVVVVVV.",
    ".VVVVVVKKVVVVVV.",
    "VVVVVVKKKKVVVVVV",
    "VVVVVKKVVKKVVVVV",
    "VVVVVKKVVKKVVVVV",
    "VVVVVKKVVKKVVVVV",
    "VVVVVVKKKKVVVVVV",
    ".VVVVVVKKVVVVVV.",
    ".VVVVVVVVVVVVVV.",
    "..VVVVVVVVVVVV..",
    "...VVVVVVVVVV...",
    ".....VVVVVV.....",
  ]} />;
}

/** The card back: a bordered plate with the mark in the middle, what peeks behind the deck. */
export function CardBack({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ B: "borderStrong", V: "accent", W: "markGlyph" }} rows={[
    "BBBBBBBBBBBBBBBB",
    "B..............B",
    "B.B..........B.B",
    "B..............B",
    "B......VV......B",
    "B.....VVVV.....B",
    "B....VVWWVV....B",
    "B...VVVWWVVV...B",
    "B...VVVWWVVV...B",
    "B....VVWWVV....B",
    "B.....VVVV.....B",
    "B......VV......B",
    "B..............B",
    "B.B..........B.B",
    "B..............B",
    "BBBBBBBBBBBBBBBB",
  ]} />;
}

/** The searching banner: a bull and a bear, and the question between them. */
export function SearchingBanner({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ G: "profit", R: "loss", V: "accent", W: "markGlyph", K: "ground" }} rows={[
    ".W....W..............VVVV...............RR......RR..",
    ".WW..WW.............VV..VV..............RRRR..RRRR..",
    "..GGGGGG................VV..............RRRRRRRRRR..",
    ".GGGGGGGG..............VV................RRRRRRRR...",
    ".GGKGGGKG.............VV.................RRKRRRKR...",
    ".GGGGGGGG.............VV.................RRRRRRRR...",
    ".GGGGWWGG.................................RRRWWWRR...",
    "..GGGGGG..............VV..................RRRWKWRR...",
    "...GG.GG..............VV...................RRRRRR....",
    "....................................................",
  ]} />;
}

/** The locked-in mark: a padlock, closed, in the brand's colour. */
export function LockedInMark({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ V: "accent", K: "ground" }} rows={[
    "....VVVV....",
    "...VV..VV...",
    "...VV..VV...",
    "...VV..VV...",
    ".VVVVVVVVVV.",
    ".VVVVVVVVVV.",
    ".VVVVKKVVVV.",
    ".VVVVKKVVVV.",
    ".VVVVVKVVVV.",
    ".VVVVVVVVVV.",
    ".VVVVVVVVVV.",
    "..VVVVVVVV..",
  ]} />;
}

/** The season's trophy: a cup in vermilion with a white gleam, on the same grid as the coin. */
export function TrophyMark({ size, title }: MarkProps) {
  return <Pixels size={size} title={title} palette={{ v: "accent", w: "markGlyph", i: "ground", s: "borderStrong" }} rows={[
    "..iiiiiiiiii..",
    ".ivvvvvvvvvvi.",
    "iivvwvvvvvvvii",
    "isvvwvvvvvvvsi",
    "isvvvvvvvvvvsi",
    ".iivvvvvvvvii.",
    "..iivvvvvvii..",
    "...iivvvvii...",
    "....iivvii....",
    ".....ivvi.....",
    ".....ivvi.....",
    "....iivvii....",
    "...ivvvvvvi...",
    "..iiiiiiiiii..",
  ]} />;
}
