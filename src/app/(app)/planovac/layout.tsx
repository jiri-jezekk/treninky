import { PlannerTabs } from "./PlannerTabs";

export default function PlanovacLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
          Plánovač
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
      </div>
      <PlannerTabs />
      {children}
    </div>
  );
}
