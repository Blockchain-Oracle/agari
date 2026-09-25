import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono";
import { Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora";
import { useFonts } from "expo-font";

/**
 * The faces web loads in lib/fonts.ts, keyed by the names theme/type.ts uses. Noto Serif JP ships as a subset
 * (Latin, kana and the 36 kanji web renders) as web's `subsets: ["latin"]` does; the full face is 7.6 MB a weight.
 */
const FACES = {
  Sora_700Bold,
  Sora_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  NotoSerifJP_500Medium: require("../../assets/fonts/NotoSerifJP-500Medium-subset.ttf"),
  NotoSerifJP_700Bold: require("../../assets/fonts/NotoSerifJP-700Bold-subset.ttf"),
};

/** True once every face is ready (or failed: the system face stands in rather than holding the splash forever). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
