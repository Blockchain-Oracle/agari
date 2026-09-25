import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, type ReactElement } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";
import { useTheme } from "~/theme";
import { haptic } from "./haptics";

/**
 * Pull to refresh, the one phone-only gesture the app keeps over web (the owner's call, 09-25): the same accent
 * spinner and selection tick on every page. With no `onRefresh` it refetches every query the page has on screen,
 * since the page is what the reader asked to be fresh. The spinner holds until the refetch settles.
 */
export function usePullRefresh(onRefresh?: () => Promise<unknown> | void, enabled = true): ReactElement<RefreshControlProps> {
  const { color } = useTheme();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const run = useCallback(async () => {
    setRefreshing(true);
    haptic.select();
    try {
      await (onRefresh ? onRefresh() : client.invalidateQueries());
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, client]);
  return <RefreshControl refreshing={refreshing} onRefresh={() => void run()} enabled={enabled} tintColor={color.accent} colors={[color.accent]} />;
}
