import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PAGER } from "@/lib/copy";
import { Button } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

/** web `usePager`: pages of a fixed size instead of an endless scroll (the owner's 2026-09-04 call). */
export function usePage<T>(items: readonly T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  const from = page * size;
  return { slice: items.slice(from, from + size), page, pages, from, total: items.length, setPage };
}

/** web `Pager`: ← Prev · 1–8 of 20 · Next →, hidden when everything fits on one page. */
export function Pager({ pager, size }: { pager: ReturnType<typeof usePage<unknown>>; size: number }) {
  const { color } = useTheme();
  if (pager.pages <= 1) return null;
  const to = Math.min(pager.from + size, pager.total);
  return (
    <View style={styles.row} accessibilityLabel={PAGER.aria}>
      <Button label={PAGER.prev} variant="ghost" size="sm" block={false} disabled={pager.page === 0} onPress={() => pager.setPage(pager.page - 1)} />
      <Text style={[TYPE.data, { color: color.inkMuted }]}>{PAGER.range(pager.from + 1, to, pager.total)}</Text>
      <Button label={PAGER.next} variant="ghost" size="sm" block={false} disabled={pager.page >= pager.pages - 1} onPress={() => pager.setPage(pager.page + 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
});
