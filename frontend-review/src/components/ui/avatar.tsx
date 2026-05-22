import { cn } from "../../lib/utils";

type AvatarProps = {
  label: string;
  className?: string;
};

export function Avatar({ label, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground",
        className,
      )}
    >
      {label}
    </div>
  );
}
