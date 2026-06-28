import { cn } from "@/lib/cn";
import { PLANNING_PAGE_CONTENT_HEADER_CLASS } from "@/lib/app-shell-layout";

type Props = {
  title: string;
  className?: string;
};

/** Schlanke Seitenüberschrift im Content (Dashboard, Kalender). */
export function PlanningPageContentHeader({ title, className }: Props) {
  return (
    <div className={cn(PLANNING_PAGE_CONTENT_HEADER_CLASS, className)}>
      <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground md:text-[0.9375rem]">
        {title}
      </h1>
    </div>
  );
}
