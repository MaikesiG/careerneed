import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  size?: "default" | "narrow";
  className?: string;
};

const maxWidth = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
};

export default function PageContainer({
  children,
  size = "default",
  className = "",
}: PageContainerProps) {
  return (
    <main className={`min-h-full bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8 ${className}`}>
      <div className={`mx-auto w-full ${maxWidth[size]}`}>{children}</div>
    </main>
  );
}
