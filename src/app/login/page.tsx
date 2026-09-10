"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, Button, Note } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const next = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("next") ?? "/"
    : "/";
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "")}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) { setState("error"); setMessage(error.message); return; }
    setState("sent");
  }

  async function oauth(provider: "google" | "apple") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  }

  return (
    <div className="shell">
      <main className="flex-1 flex flex-col justify-center gap-4 px-3.5 py-8">
        <div className="flex flex-col gap-1.5 px-1">
          <span className="w-11 h-11 rounded-xl bg-accent text-accent-ink grid place-items-center font-display font-extrabold text-xl">C</span>
          <h1 className="font-display font-extrabold text-2xl mt-2">Circles</h1>
          <p className="text-[14px] text-ink-2">Plans, money, photos and challenges — one place per friend group.</p>
        </div>

        <Card className="p-3.5">
          {state === "sent" ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-display font-bold text-[15.5px]">Check your email</h2>
              <p className="text-[13px] text-ink-2">We sent a sign-in link to {email}. Open it on this device.</p>
            </div>
          ) : (
            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <Field label="Email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Button type="submit" disabled={state === "sending"} className="w-full">
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
              {state === "error" && <p className="text-[13px] text-no">{message}</p>}
            </form>
          )}
        </Card>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => oauth("google")}>Google</Button>
          <Button variant="ghost" className="flex-1" onClick={() => oauth("apple")}>Apple</Button>
        </div>

        <p className="text-[12.5px] text-ink-2 text-center">
          By signing in you agree to the{" "}
          <a href="/terms" className="text-accent">terms of service</a> and{" "}
          <a href="/privacy" className="text-accent">privacy policy</a>.
        </p>
      </main>
    </div>
  );
}
