"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Live password criteria validation
  const criteria = useMemo(() => {
    return [
      {
        label: "At least 12 characters",
        met: password.length >= 12,
      },
      {
        label: "Passwords match",
        met: confirmPassword.length > 0 && password === confirmPassword,
      },
    ];
  }, [password, confirmPassword]);

  const canSubmit = password.length >= 12 && password === confirmPassword && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setIsTokenInvalid(true);
      return;
    }

    if (password.length < 12) {
      setErrorMessage("Password must be at least 12 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage(null);
    setIsTokenInvalid(false);
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: password,
          confirm_password: confirmPassword,
        }),
      });

      if (!response.ok) {
        const errorDetail = await getApiErrorMessage(
          response,
          "Unable to reset password. Please try again."
        );
        setErrorMessage(errorDetail);

        if (
          response.status === 400 ||
          errorDetail.toLowerCase().includes("expired") ||
          errorDetail.toLowerCase().includes("invalid")
        ) {
          setIsTokenInvalid(true);
        }
        return;
      }

      setIsSuccess(true);
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
              Credential Security
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Set a strong, fresh password for your account.
            </h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">
              Ensure your job search data, resume archives, and personal contacts remain safe and
              private.
            </p>
          </div>

          {/* Value Proposition Cards */}
          <div className="space-y-3.5">
            <div className="border-border bg-card/85 hover:border-primary/40 flex items-start gap-3.5 rounded-xl border p-4 shadow-xs backdrop-blur-sm transition">
              <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Argon2id Hashing</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Your password is encrypted with industry-standard memory-hard Argon2 hashing.
                </p>
              </div>
            </div>

            <div className="border-border bg-card/85 hover:border-primary/40 flex items-start gap-3.5 rounded-xl border p-4 shadow-xs backdrop-blur-sm transition">
              <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Lock className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Session Revocation</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Updating your password automatically signs out any old or compromised devices.
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

      {/* Right side: Form Container */}
      <div className="relative flex flex-1 flex-col justify-between overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        {/* Top Navbar */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary focus-visible:ring-offset-background hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Sign In</span>
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
          {/* Missing or Invalid Token State */}
          {!token || isTokenInvalid ? (
            <div className="space-y-6">
              <div className="bg-destructive/10 text-destructive border-destructive/20 flex size-12 items-center justify-center rounded-2xl border shadow-xs">
                <AlertCircle className="size-6" />
              </div>

              <div>
                <p className="text-destructive text-xs font-bold tracking-widest uppercase">
                  Invalid or Expired Link
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  Password reset link expired
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {errorMessage ??
                    "This password reset link is invalid or has expired. Password reset links can only be used once and expire after 30 minutes."}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href="/forgot-password"
                  className="bg-primary text-primary-foreground hover:shadow-primary/20 focus-visible:ring-primary focus-visible:ring-offset-background group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md transition-all hover:opacity-95 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <KeyRound className="size-4" />
                  <span>Request a new reset link</span>
                </Link>

                <Link
                  href="/login"
                  className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary flex w-full items-center justify-center rounded-xl border py-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="space-y-6">
              <div className="bg-success/10 text-success border-success/20 flex size-12 items-center justify-center rounded-2xl border shadow-xs">
                <CheckCircle2 className="size-6" />
              </div>

              <div>
                <p className="text-primary text-xs font-bold tracking-widest uppercase">
                  Password Updated
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  You&apos;re ready to sign in
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Your password has been changed successfully. All previous sessions have been
                  signed out for your security. Please log in with your new password.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="bg-primary text-primary-foreground hover:shadow-primary/20 focus-visible:ring-primary focus-visible:ring-offset-background group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md transition-all hover:opacity-95 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span>Sign in to CareerNeed</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ) : (
            /* Reset Password Form */
            <div>
              <div className="text-center sm:text-left">
                <p className="text-primary text-xs font-bold tracking-widest uppercase">
                  Account Security
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  Choose a new password
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Please enter a new password for your CareerNeed account.
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
                {/* New Password Field */}
                <div>
                  <label
                    className="text-foreground block text-xs font-semibold"
                    htmlFor="new-password"
                  >
                    New password
                  </label>
                  <div className="border-border bg-card focus-within:border-primary focus-within:ring-primary/20 relative mt-1.5 flex items-center rounded-xl border shadow-2xs transition focus-within:ring-3">
                    <div className="text-muted-foreground pointer-events-none pl-3.5">
                      <Lock className="size-4" />
                    </div>
                    <input
                      id="new-password"
                      name="new_password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={12}
                      required
                      autoFocus
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="text-foreground placeholder:text-muted-foreground w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                      placeholder="At least 12 characters"
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
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    className="text-foreground block text-xs font-semibold"
                    htmlFor="confirm-password"
                  >
                    Confirm new password
                  </label>
                  <div className="border-border bg-card focus-within:border-primary focus-within:ring-primary/20 relative mt-1.5 flex items-center rounded-xl border shadow-2xs transition focus-within:ring-3">
                    <div className="text-muted-foreground pointer-events-none pl-3.5">
                      <Lock className="size-4" />
                    </div>
                    <input
                      id="confirm-password"
                      name="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="text-foreground placeholder:text-muted-foreground w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                      placeholder="Re-enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-primary mr-2.5 rounded-md p-1 transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="space-y-1.5 pt-1">
                  {criteria.map((criterion, idx) => (
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-primary text-primary-foreground hover:shadow-primary/20 focus-visible:ring-primary focus-visible:ring-offset-background group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md transition-all hover:opacity-95 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    <>
                      <span>Reset password</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Alternative Link Footer */}
              <div className="border-border text-muted-foreground mt-7 border-t pt-5 text-center text-xs">
                <Link
                  href="/login"
                  className="text-primary focus-visible:ring-primary rounded-xs font-semibold transition hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* Privacy notice */}
          <p className="text-muted-foreground/80 mt-6 text-center text-[11px] leading-relaxed">
            Protecting your account with strong authentication and cryptographic security.
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
