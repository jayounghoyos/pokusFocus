import clsx from "clsx";

export function Check({
  checked,
  onChange,
  size = 18,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: number;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{ width: size, height: size }}
      className={clsx(
        "flex-shrink-0 inline-flex items-center justify-center rounded-[5px] border transition-colors",
        checked
          ? "bg-focus-work border-focus-work text-zinc-50"
          : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500",
      )}
    >
      {checked && (
        <svg
          viewBox="0 0 14 14"
          width={size * 0.72}
          height={size * 0.72}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 7 6 10 11 4" />
        </svg>
      )}
    </button>
  );
}
