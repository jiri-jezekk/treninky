import { redirect } from "next/navigation";

/** Měsíční platba se přestěhovala do sekce Platby. */
export default function PlatbaRedirect() {
  redirect("/platby?zalozka=mesicni");
}
