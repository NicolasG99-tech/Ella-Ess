export function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-3 w-full overflow-hidden rounded-full bg-stone-200"
      >
        <div
          className="h-full rounded-full bg-amber-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-stone-600">{label}</span>
    </div>
  );
}
