"use client";

import { useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import { DisclosureClose } from "./Disclosure";

export function SubmitButton({ children, pendingLabel, className = "", variant = "primary", size = "md" }: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  const close = useContext(DisclosureClose);
  const wasPending = useRef(false);

  // When a submission finishes, fold away the disclosure this form sits in.
  // No-op for forms that aren't inside one.
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
    } else if (wasPending.current) {
      wasPending.current = false;
      close?.();
    }
  }, [pending, close]);

  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
