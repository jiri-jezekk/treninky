/** Společné vizuální styly — světlé pozadí, prvky jen v rámečku. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-800">{title}</h1>
      {description && (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      )}
    </div>
  );
}
