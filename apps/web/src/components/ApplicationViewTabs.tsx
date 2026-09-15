import Link from "next/link";

type ApplicationViewTabsProps = {
  currentView: "list" | "pipeline";
};

const inactiveClassName =
  "rounded-md px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";

const activeClassName =
  "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground";

export default function ApplicationViewTabs({ currentView }: ApplicationViewTabsProps) {
  return (
    <nav
      aria-label="Application views"
      className="inline-flex rounded-lg border border-border bg-card p-1"
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
