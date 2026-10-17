import { redirect } from "next/navigation";

/** Knihovna cvičení se přestěhovala do Plánovače. */
export default function CviceniRedirect() {
  redirect("/planovac/cviceni");
}
