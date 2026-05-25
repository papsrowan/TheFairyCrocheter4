"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface Props {
  href:      string;
  children:  ReactNode;
  className?: string;
}

export function ClickableRow({ href, children, className }: Props) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}
