import { cn } from "@/lib/utils";

const CDN_ORIGIN = "https://cdn.deadrot.com";

type DeadrotBrandProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function DeadrotBrand({ className, markClassName, textClassName }: DeadrotBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${CDN_ORIGIN}/branding/deadrot-mark.svg`}
        alt=""
        aria-hidden="true"
        className={cn("h-8 w-8 shrink-0", markClassName)}
      />
      <span className={cn("font-display font-bold uppercase leading-none tracking-normal text-bone", textClassName)}>
        Dead<span className="text-blood">rot</span>
      </span>
    </span>
  );
}
