import type { ElementType, ReactNode } from "react";

export type PageContainerProps = {
  children: ReactNode;
  size?: "default" | "compact" | "narrow" | "wide";
  className?: string;
  as?: ElementType;
};

const maxWidthClasses = {
  default: "max-w-6xl",
  compact: "max-w-5xl",
  narrow: "max-w-3xl",
  wide: "max-w-7xl",
};

export default function PageContainer({
  children,
  size = "default",
  className = "",
  as: Component = "main",
}: PageContainerProps) {
  return (
    <Component
      className={`bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${className}`}
    >
      <div className={`mx-auto w-full ${maxWidthClasses[size]}`}>{children}</div>
    </Component>
  );
}
