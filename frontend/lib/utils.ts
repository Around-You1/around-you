import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn merges conditional class names and de-duplicates Tailwind utilities.
// Referenced across the shadcn/ui primitives as `@/lib/utils`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
