"use client";

import { deleteTemplate } from "@/actions/training-plan";

export function DeleteTemplateButton({
  templateId,
  name,
}: {
  templateId: string;
  name: string;
}) {
  return (
    <form
      action={deleteTemplate.bind(null, templateId)}
      onSubmit={(e) => {
        if (!window.confirm(`Smazat šablonu „${name}“? Plány z ní založené zůstanou.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-1 sm:flex-none"
    >
      <button
        type="submit"
        className="inline-flex min-h-10 w-full items-center justify-center rounded-full border-2 border-red-200 px-4 py-2 font-heading text-sm font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50"
      >
        Smazat
      </button>
    </form>
  );
}
