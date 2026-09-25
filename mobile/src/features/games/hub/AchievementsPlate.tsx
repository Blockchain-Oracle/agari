import { achievementsEarned, type Achievement } from "@agari/core/games";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Plate, PlateBody, PlateMeta, PlateTitle, useGamesTokens } from "~/features/games/frame";
import { FONT } from "~/theme";

interface Shelf {
  configured: boolean;
  achievements: readonly Achievement[];
  earned: number;
}

/**
 * web's `AchievementsPlate`: what this wallet has earned from settled records and what the rest take — a locked
 * badge names what it takes at lower contrast rather than hiding. Read from web's `/api/games/achievements`.
 */
export function AchievementsPlate() {
  const { address } = useWalletSession();
  const [shelf, setShelf] = useState<Shelf | null>(null);

  useEffect(() => {
    let live = true;
    const url = address ? `/api/games/achievements?wallet=${address}` : "/api/games/achievements";
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Shelf>) : null))
      .then((next) => {
        if (live && next) setShelf(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [address]);

  const list = shelf?.achievements ?? [];
  const earned = shelf ? achievementsEarned(list) : 0;
  const words = GAMES.achievements;
  return (
    <Plate>
      <PlateTitle>{words.title}</PlateTitle>
      <PlateBody>{shelf?.configured === false ? words.noStore : address ? words.body : words.connect}</PlateBody>
      {list.length > 0 ? (
        <>
          <PlateMeta>{words.count(earned, list.length)}</PlateMeta>
          <View style={styles.list}>
            {list.map((badge) => (
              <Item key={badge.id} badge={badge} />
            ))}
          </View>
        </>
      ) : null}
    </Plate>
  );
}

/** `.gm-ach` / `.gm-ach--on`. */
function Item({ badge }: { badge: Achievement }) {
  const { t, color } = useGamesTokens();
  const on = badge.earned;
  return (
    <View
      style={[styles.ach, { borderColor: on ? t.achOnBorder : t.achBorder, backgroundColor: on ? t.achOnBg : t.achBg }]}
      accessible
      accessibilityLabel={`${badge.title}, ${on ? "earned" : "locked"}. ${badge.how}.`}
    >
      <Text style={[styles.title, { color: on ? color.ink : color.inkSecondary }]}>{badge.title}</Text>
      <Text style={[styles.how, { color: color.inkMuted }]}>{badge.how}</Text>
      {badge.need > 1 && !on ? (
        <Text style={[styles.progress, { color: t.achProgress }]}>
          {badge.have} / {badge.need}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12, gap: 6 },
  ach: { gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1 },
  title: { fontFamily: FONT.heading, fontSize: 12, lineHeight: 19.2 },
  how: { fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
  progress: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
