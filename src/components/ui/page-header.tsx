import { PrintButton } from "@/components/ui/print-button";
import { formatPrintDate } from "@/lib/format/datetime";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const today = formatPrintDate();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <p className="hidden text-xs text-zinc-600 print:block">
          Hotel Demo · {title} · {today}
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600 print:hidden">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {actions}
        <PrintButton />
      </div>
    </div>
  );
}
