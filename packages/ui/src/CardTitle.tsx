import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("ssg-section-heading", className)} {...props}>
      {children}
    </h3>
  );
}
