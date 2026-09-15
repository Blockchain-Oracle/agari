import type { Metadata } from "next";
import { ActivityScreen } from "@/features/activity/ActivityScreen";
import { ACTIVITY } from "@/features/activity/copy";

export const metadata: Metadata = { title: ACTIVITY.title };

export default function Page() {
  return <ActivityScreen />;
}
