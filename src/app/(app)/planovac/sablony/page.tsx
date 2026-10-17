import Link from "next/link";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { DRILL_KIND_LABELS, parseTemplateBlocks } from "@/lib/training-plan";
import { DeleteTemplateButton } from "./DeleteTemplateButton";

export default async function SablonyPage() {
  const userId = await requireUserId();

  const templates = await prisma.planTemplate.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      blocks: true,
      group: { select: { name: true, color: true } },
    },
  });

  return (
    <>
      <p className="mb-5 max-w-prose text-sm text-slate-600">
        Typická stavba hodiny, ze které založíš nový plán. Šablonu uložíš
        z hotového plánu tlačítkem „Jako šablona“.
      </p>

      {templates.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm italic text-slate-500">
          Zatím žádná šablona. Otevři plán, který se ti osvědčil, a ulož ho
          tlačítkem „Jako šablona“.
        </p>
      ) : (
        <ul className="space-y-4">
          {templates.map((t) => {
            const blocks = parseTemplateBlocks(t.blocks);
            const minutes = blocks.reduce((s, b) => s + b.minutes, 0);
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="min-w-0">
                  <h2 className="break-words font-heading text-base font-bold text-slate-800">
                    {t.name}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {t.group && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.group.color }}
                        />
                        {t.group.name}
                      </span>
                    )}
                    <span className="tabular-nums">
                      {blocks.length} {czPlural(blocks.length, "bod", "body", "bodů")} · {minutes}
                      {t.durationMinutes ? ` / ${t.durationMinutes}` : ""} min
                    </span>
                  </p>
                </div>
                <ol className="mt-3 space-y-1 text-sm text-slate-700">
                  {blocks.map((b, i) => (
                    <li key={i} className="flex min-w-0 gap-2">
                      <span className="w-12 shrink-0 tabular-nums text-slate-500">
                        {b.minutes} min
                      </span>
                      <span className="min-w-0 break-words">
                        {b.title}
                        {b.focus && <span className="text-slate-500"> – {b.focus}</span>}
                        <span className="text-xs text-slate-500"> · {DRILL_KIND_LABELS[b.kind]}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/planovac?sablona=${t.id}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover sm:flex-none"
                  >
                    Založit plán
                  </Link>
                  <DeleteTemplateButton templateId={t.id} name={t.name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
