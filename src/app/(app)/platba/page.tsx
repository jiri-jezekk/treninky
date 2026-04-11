import { redirect } from "next/navigation";

export default function PlatbaIndexPage() {
  const d = new Date();
  redirect(`/platba/${d.getFullYear()}/${d.getMonth() + 1}`);
}
