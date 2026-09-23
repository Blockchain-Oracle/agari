import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { STATUS } from "@/features/status/copy";
import { lagTone } from "@/features/status/protocol";
import { STATUS_KEY, useStatus } from "@/features/status/useStatus";
import { EmptyState, LoadingState, Screen, SectionHeader, Segmented } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { useCheckHistory } from "./history";
import { PipelineRow, StatusBanner } from "./Parts";

type Show = "all" | "issues";

/**
 * `/status` — web StatusScreen.tsx: web's own `useStatus` (the `/api/status` probe, every 30 s), in its three states
 * — loading, unreachable, the report — with the verdict banner, one row per pipeline, and the time it was checked.
 * The phone adds a strip of the checks seen while the screen is open, and a filter to the rows that need a look.
 */
export function StatusScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const reading = useStatus();
  const checks = useCheckHistory(reading);
  const [show, setShow] = useState<Show>("all");
  const refresh = () => client.invalidateQueries({ queryKey: STATUS_KEY });

  const report = () => {
    if (reading === null) return <LoadingState shape="list" label={STATUS.loading} />;
    if (!reading.ok) {
      return <EmptyState why={STATUS.unreachable} detail={reading.error.technical} action={{ label: "Check again", onPress: () => void refresh() }} />;
    }
    const payload = reading.value;
    const issues = payload.pipelines.filter((pipeline) => {
      const tone = lagTone(pipeline);
      return tone === "bad" || tone === "warn";
    });
    const rows = show === "all" ? payload.pipelines : issues;
    return (
      <>
        <StatusBanner payload={payload} checks={checks} />
        <Segmented
          label="Which pipelines"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: STATUS.tableTitle(payload.pipelines.length).replace(/ \(\d+\)$/, ""), count: payload.pipelines.length },
            { value: "issues", label: "Needs a look", count: issues.length },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState why="Nothing needs a look right now." detail="Every required pipeline answered inside its thresholds on the last check." />
        ) : (
          <View>
            {rows.map((pipeline) => (
              <PipelineRow key={pipeline.id} pipeline={pipeline} sessionLabel={payload.session?.label ?? null} checks={checks} />
            ))}
          </View>
        )}
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{STATUS.lastChecked(new Date(payload.checkedAtMs).toLocaleTimeString())}</Text>
      </>
    );
  };

  return (
    <Screen title={STATUS.title} onRefresh={refresh}>
      <SectionHeader index={STATUS.section.index} title={STATUS.section.title} />
      {reading?.ok && reading.stale ? (
        <Text style={[TYPE.caption, styles.stale, { color: color.warning }]}>Showing the last good read; the latest check failed.</Text>
      ) : null}
      {report()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stale: { marginTop: -4 },
});
