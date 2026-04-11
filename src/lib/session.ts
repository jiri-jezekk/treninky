import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/prihlaseni");
  return id;
}
