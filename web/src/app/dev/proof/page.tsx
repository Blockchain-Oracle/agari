import type { Metadata } from "next";
import { SectionHeader } from "@/components/chrome";
import { PrintProofReceipt, PROOF, ProofTable } from "@/features/proof";
import "@/features/proof/proof-page.css";
import { STATE_PRINTS, WINDOW_PRINTS } from "./fixtures";

export const metadata: Metadata = { title: `Fixtures · ${PROOF.title}` };

const DEV = {
  window: "A Pyth-primary Window with its RedStone check: open proven then closed, close verified",
  states: "The Pyth close before it is proven (none, posting), a price that does not match, and an attested demo print",
} as const;

/** `/dev/proof`: the proof page's parts over canned prints, no database or chain (the live page is `/proof/<market>`). */
export default function DevProofPage() {
  return (
    <div className="container status-page proof-page">
      <SectionHeader index="00" title={`${PROOF.title} · fixtures`} desc={PROOF.intro} />
      <div className="status-report">
        <SectionHeader index="01" title={DEV.window} />
        <ProofTable prints={WINDOW_PRINTS} singleSource={false} />
        <div className="proof-prints">
          {WINDOW_PRINTS.map((p) => (
            <PrintProofReceipt key={p.which} print={p} />
          ))}
        </div>
        <SectionHeader index="02" title={DEV.states} />
        <ProofTable prints={STATE_PRINTS} singleSource />
        <div className="proof-prints">
          {STATE_PRINTS.map((p) => (
            <PrintProofReceipt key={p.recordSignature} print={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
