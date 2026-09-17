"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

const copy = {
  login: {
    eyebrow: "Welcome back",
    title: "Continue your job search.",
    description: "Log in to view your applications, resumes, and next follow-ups.",
    submit: "Log in",
    pending: "Logging in…",
    endpoint: "/auth/login",
    alternativePrompt: "New to CareerNeed?",
    alternativeHref: "/register",
    alternativeLabel: "Create an account",
  },
  register: {
    eyebrow: "Create your workspace",
    title: "Start tracking with clarity.",
    description:
      "Create an account to organize opportunities, applications, resumes, and follow-ups.",
    submit: "Create account",
    pending: "Creating account…",
    endpoint: "/auth/register",
    alternativePrompt: "Already have an account?",
    alternativeHref: "/login",
    alternativeLabel: "Log in",
  },
} as const;

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/todo";
  }

  return value;
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = copy[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch(content.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        setErrorMessage(
          await getApiErrorMessage(
            response,
            mode === "login" ? "Unable to log in. Please try again." : "Unable to create account."
          )
        );
        return;
      }

      const user = await refreshUser();

      if (!user) {
        setErrorMessage(
          "Your account was created, but the session could not be verified. Try logging in."
        );
        return;
      }

      router.replace(getSafeNextPath(searchParams.get("next")));
    } catch {
      setErrorMessage("Unable to reach CareerNeed. Check that the API is running and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-sm sm:p-8">
        <Link
          href="/"
          className="text-foreground hover:text-primary focus-visible:ring-primary rounded-md text-lg font-bold tracking-tight transition focus-visible:ring-2 focus-visible:outline-none"
        >
          CareerNeed
        </Link>

        <p className="text-primary mt-8 text-xs font-semibold tracking-[0.18em] uppercase">
          {content.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">{content.description}</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary mt-2 w-full rounded-lg border px-3 py-2.5 text-sm transition outline-none focus:ring-2"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-semibold" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary mt-2 w-full rounded-lg border px-3 py-2.5 text-sm transition outline-none focus:ring-2"
              placeholder="At least 12 characters"
            />
            {mode === "register" ? (
              <p className="text-muted-foreground mt-2 text-xs">Use at least 12 characters.</p>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              className="border-error-border bg-error-background text-destructive rounded-lg border px-3 py-2 text-sm"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background w-full rounded-lg px-4 py-3 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? content.pending : content.submit}
          </button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          {content.alternativePrompt}{" "}
          <Link
            href={content.alternativeHref}
            className="text-primary focus-visible:ring-primary rounded-sm font-semibold hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
          >
            {content.alternativeLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
