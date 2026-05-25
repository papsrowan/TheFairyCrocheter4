import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusion des classes Tailwind avec résolution des conflits */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
