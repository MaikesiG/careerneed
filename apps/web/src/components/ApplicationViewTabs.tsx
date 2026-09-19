import Link from "next/link";

type ApplicationViewTabsProps = {
  currentView: "list" | "pipeline";
};

const inactiveClassName =
  "inline-flex h-full items-center justify-center rounded-md px-3 text-xs sm:text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";

const activeClassName =
  "inline-flex h-full items-center justify-center rounded-md bg-primary px-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs";

export default function ApplicationViewTabs({ currentView }: ApplicationViewTabsProps) {
  return (
    <nav
      aria-label="Application views"
      className="border-border bg-card inline-flex h-9 sm:h-10 items-center rounded-lg border p-1 text-xs sm:text-sm"
    >
      {currentView === "list" ? (
        <span aria-current="page" className={activeClassName}>
          List
        </span>
      ) : (
        <Link href="/applications" className={inactiveClassName}>
          List
        </Link>
      )}

      {currentView === "pipeline" ? (
        <span aria-current="page" className={activeClassName}>
          Pipeline
        </span>
      ) : (
        <Link href="/applications/board" className={inactiveClassName}>
          Pipeline
        </Link>
      )}
    </nav>
  );
}
