"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";

export function SubmitButton({ children, pendingLabel, className = "", variant = "primary", size = "md" }: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
