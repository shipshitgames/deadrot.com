import type { CardProps } from "./Card";
import { cn } from "./cn";

export function CardBody({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("ssg-card-body", className)} {...props}>
      {children}
    </div>
  );
}
