"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/states";

/** The canvas chart never renders on the server; the skeleton holds its place until the client bundle lands. */
export const PriceChart = dynamic(() => import("./PriceChart.client").then((m) => m.PriceChartClient), {
  ssr: false,
  loading: () => <LoadingState shape="chart" />,
});
