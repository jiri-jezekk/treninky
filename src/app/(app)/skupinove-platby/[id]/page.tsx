import { redirect } from "next/navigation";

/** Staré odkazy na detail skupinové platby vedou na nový detail akce. */
export default async function SkupinovaPlatbaDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/platby/akce/${id}`);
}
