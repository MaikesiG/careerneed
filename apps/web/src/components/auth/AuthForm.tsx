"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import ThemeToggle from "@/components/ThemeToggle";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

const copy = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in to CareerNeed",
    description: "Access your application pipeline, active follow-ups, and resume versions.",
    submit: "Sign in",
    pending: "Signing in…",
    endpoint: "/auth/login",
    alternativePrompt: "Don't have an account?",
    alternativeHref: "/register",
    alternativeLabel: "Create an account",
  },
  register: {
    eyebrow: "Get started",
    title: "Create your workspace",
    description: "Start organizing your job search with clarity, velocity, and focus.",
    submit: "Create account",
    pending: "Creating account…",
    endpoint: "/auth/register",
    alternativePrompt: "Already have an account?",
    alternativeHref: "/login",
    alternativeLabel: "Sign in",
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = copy[mode];
  const nextParam = searchParams.get("next");
  const nextQuery = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";

  // Password criteria for register mode
  const passwordCriteria = useMemo(() => {
    return [
      {
        label: "At least 12 characters",
        met: password.length >= 12,
      },
    ];
  }, [password]);

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
            mode === "login"
              ? "Invalid email or password. Please try again."
              : "Unable to create account. Please check your details."
          )
        );
        return;
      }

      const user = await refreshUser();

      if (!user) {
        setErrorMessage(
          "Account verified, but the session could not be established. Please try logging in."
        );
        return;
      }

      router.replace(getSafeNextPath(nextParam));
    } catch {
      setErrorMessage(
        "Unable to reach CareerNeed API. Please ensure the backend server is running."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen w-full">
      {/* Left side: Brand Showcase Panel (Visible on Desktop lg+) */}
      <div className="border-border bg-card/60 relative hidden min-h-screen flex-col justify-between overflow-hidden border-r p-10 lg:flex lg:w-1/2 xl:p-14">
        {/* Background Ambient Glow & Grid Lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,oklch(from_var(--primary)_l_c_h_/_0.20),transparent_45%),radial-gradient(circle_at_80%_80%,oklch(from_var(--primary)_l_c_h_/_0.15),transparent_40%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_90%)] [background-size:3.5rem_3.5rem] opacity-35"
        />

        {/* Top Logo */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group focus-visible:ring-primary focus-visible:ring-offset-background flex items-center gap-2.5 rounded-lg transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="bg-primary text-primary-foreground shadow-primary/25 flex size-9 items-center justify-center rounded-xl shadow-md transition group-hover:scale-105">
              <Briefcase className="size-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">CareerNeed</span>
          </Link>
          <span className="border-border bg-muted/60 text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
            Workspace
          </span>
        </div>

        {/* Center Feature Highlights */}
        <div className="my-auto max-w-lg space-y-8 py-8">
          <div>
            <div className="bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="size-3.5" />
              Career Operating System
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Turn every opportunity into your next career breakthrough.
            </h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">
              Stay organized, maintain follow-up cadence, and track job applications across every
              stage from first contact to signed offer.
            </p>
          </div>

          {/* Value Proposition Cards */}
          <div className="space-y-3.5">
            <div className="border-border bg-card/85 hover:border-primary/40 flex items-start gap-3.5 rounded-xl border p-4 shadow-xs backdrop-blur-sm transition">
              <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Layers className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Visual Pipeline Tracker</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Kanban board, status timelines, and comprehensive notes for every company.
                </p>
              </div>
            </div>

            <div className="border-border bg-card/85 hover:border-primary/40 flex items-start gap-3.5 rounded-xl border p-4 shadow-xs backdrop-blur-sm transition">
              <div className="bg-warning/15 text-warning mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Clock className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Never Miss a Follow-up</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Actionable daily To-Do lists that highlight pending reach-outs before leads cool
                  off.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Security Banner */}
        <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-5 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-4" />
            <span>Secure session authentication & local data isolation</span>
          </div>
          <p>© {new Date().getFullYear()} CareerNeed</p>
        </div>
      </div>

      {/* Right side: Auth Form Container */}
      <div className="relative flex flex-1 flex-col justify-between overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        {/* Top Navbar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary focus-visible:ring-offset-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Home</span>
          </Link>

          {/* Mobile Brand Logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg shadow-sm">
              <Briefcase className="size-3.5" />
            </div>
            <span className="text-sm font-bold tracking-tight">CareerNeed</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Form Card */}
        <div className="mx-auto my-auto w-full max-w-md py-6">
          {/* Mode Switcher Tabs */}
          <div className="border-border bg-muted/60 mb-6 flex rounded-xl border p-1">
            <Link
              href={`/login${nextQuery}`}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition ${
                mode === "login"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </Link>
            <Link
              href={`/register${nextQuery}`}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition ${
                mode === "register"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </Link>
          </div>

          {/* Heading */}
          <div className="text-center sm:text-left">
            <p className="text-primary text-xs font-bold tracking-widest uppercase">
              {content.eyebrow}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              {content.title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {content.description}
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage ? (
            <div
              className="border-error-border bg-error-background text-destructive mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4.5 shrink-0" />
              <div className="flex-1 text-xs leading-normal font-medium">{errorMessage}</div>
            </div>
          ) : null}

          {/* Form */}
          <form className="mt-6 space-y-4.5" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div>
              <label className="text-foreground block text-xs font-semibold" htmlFor="email">
                Email address
              </label>
              <div className="border-border bg-card focus-within:border-primary focus-within:ring-primary/20 relative mt-1.5 flex items-center rounded-xl border shadow-2xs transition focus-within:ring-3">
                <div className="text-muted-foreground pointer-events-none pl-3.5">
                  <Mail className="size-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="text-foreground placeholder:text-muted-foreground w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                  placeholder="you@example.com"
                  autoFocus={mode === "login"}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-foreground block text-xs font-semibold" htmlFor="password">
                  Password
                </label>
                {mode === "login" ? (
                  <Link
                    href="/forgot-password"
                    className="text-primary focus-visible:ring-primary rounded-xs text-xs font-medium transition hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Forgot password?
                  </Link>
                ) : null}
              </div>

              <div className="border-border bg-card focus-within:border-primary focus-within:ring-primary/20 relative mt-1.5 flex items-center rounded-xl border shadow-2xs transition focus-within:ring-3">
                <div className="text-muted-foreground pointer-events-none pl-3.5">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={12}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="text-foreground placeholder:text-muted-foreground w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                  placeholder={mode === "register" ? "At least 12 characters" : "••••••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-primary mr-2.5 rounded-md p-1 transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password checklist for register */}
              {mode === "register" ? (
                <div className="mt-2.5 space-y-1.5">
                  {passwordCriteria.map((criterion, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 text-xs transition ${
                        criterion.met ? "text-success font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {criterion.met ? (
                        <CheckCircle2 className="size-3.5 shrink-0" />
                      ) : (
                        <Circle className="size-3.5 shrink-0" />
                      )}
                      <span>{criterion.label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Remember Me Option on Login */}
            {mode === "login" && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="border-border text-primary focus:ring-primary size-4 rounded-sm accent-[var(--primary)]"
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    Keep me signed in on this device
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || (mode === "register" && password.length < 12)}
              className="bg-primary text-primary-foreground hover:shadow-primary/20 focus-visible:ring-primary focus-visible:ring-offset-background group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md transition-all hover:opacity-95 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{content.pending}</span>
                </>
              ) : (
                <>
                  <span>{content.submit}</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Alternative Link Footer */}
          <div className="border-border text-muted-foreground mt-7 border-t pt-5 text-center text-xs">
            {content.alternativePrompt}{" "}
            <Link
              href={`${content.alternativeHref}${nextQuery}`}
              className="text-primary focus-visible:ring-primary rounded-xs font-semibold transition hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {content.alternativeLabel}
            </Link>
          </div>

          {/* Privacy / Terms footer notice */}
          <p className="text-muted-foreground/80 mt-6 text-center text-[11px] leading-relaxed">
            By signing in, you agree to CareerNeed&apos;s workspace policies. Your session is
            protected by HTTP-only cookies.
          </p>
        </div>

        {/* Bottom spacer for mobile */}
        <div className="text-muted-foreground py-2 text-center text-[11px] lg:hidden">
          © {new Date().getFullYear()} CareerNeed
        </div>
      </div>
    </div>
  );
}
