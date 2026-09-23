import { createMMKV } from "react-native-mmkv";

/** The app's synchronous key-value store: what localStorage is to web (theme, remembered choices, the intent journal). */
export const storage = createMMKV({ id: "agari" });
