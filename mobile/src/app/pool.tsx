import { Redirect } from "expo-router";

/** `/pool` — web's `app/pool/page.tsx`: the liquidity page is now the default tab on /earn. */
export default function Pool() {
  return <Redirect href="/earn" />;
}
