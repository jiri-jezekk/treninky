import { redirect } from "next/navigation";

/** Skupinové platby se přestěhovaly do sekce Platby jako Akce. */
export default function SkupinovePlatbyRedirect() {
  redirect("/platby?zalozka=akce");
}
