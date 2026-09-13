import { redirect } from "next/navigation";
import { marketsWithNote, NOTE_KIND } from "@/lib/routes";

/** Routing law: retired or moved routes redirect with a one-line note; nothing 404s (UX-DR21). */
export default function NotFound() {
  redirect(marketsWithNote(NOTE_KIND.moved));
}
