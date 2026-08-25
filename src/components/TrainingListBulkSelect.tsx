"use client";

type Props = {
  formId: string;
  checkboxName: string;
};

export function TrainingListBulkSelect({ formId, checkboxName }: Props) {
  const setAll = (checked: boolean) => {
    const sel = `input[type="checkbox"][name="${checkboxName}"][form="${formId}"]`;
    document.querySelectorAll<HTMLInputElement>(sel).forEach((el) => {
      el.checked = checked;
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setAll(true)}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
      >
        Vybrat vše
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
      >
        Zrušit výběr
      </button>
    </div>
  );
}
