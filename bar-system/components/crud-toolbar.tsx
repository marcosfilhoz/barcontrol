"use client";

type CrudToolbarProps = {
  title: string;
  subtitle: string;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  createLabel: string;
  onCreateClick: () => void;
};

export function CrudToolbar({
  title,
  subtitle,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  createLabel,
  onCreateClick
}: CrudToolbarProps) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {createLabel}
        </button>
      </div>

      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full max-w-md rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
      />
    </section>
  );
}
