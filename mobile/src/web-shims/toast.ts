import { pushToast } from "~/components/toast/store";

/** Stands in for web/src/lib/toast.ts: the same two tones, rendered by the app's Toaster. */
export const notify = {
  neutral: (title: string, description?: string) => pushToast({ title, description, tone: "neutral" }),
  warning: (title: string, description?: string) => pushToast({ title, description, tone: "warning" }),
};
