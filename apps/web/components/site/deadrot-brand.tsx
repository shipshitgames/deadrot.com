import { cn } from "@/lib/utils";

const CDN_ORIGIN = "https://cdn.deadrot.com";

type DeadrotBrandProps = {
  className?: string;
  imageClassName?: string;
  markClassName?: string;
  textClassName?: string;
  variant?: "lockup" | "target" | "wordmark";
};

export function DeadrotBrand({
  className,
  imageClassName,
  markClassName,
  textClassName,
  variant = "lockup",
}: DeadrotBrandProps) {
  if (variant === "target") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/deadrot-target-logo-gpt-image-2.webp"
          alt="DEADROT"
          width={500}
          height={500}
          className={cn("h-9 w-9", imageClassName)}
        />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/deadrot-wordmark-gpt-image-2.webp"
          alt="DEADROT"
          width={1120}
          height={450}
          className={cn("h-8 w-auto", imageClassName)}
        />
      </span>
    );
  }

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
