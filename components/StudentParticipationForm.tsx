"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PAYMENT_CONFIG, PAYMENT_SESSION_KEY } from "@/lib/config";
import {
  createPaymentRef,
  createSubmissionId,
  saveSubmission,
  type PaymentStatus,
} from "@/lib/storage";
import {
  buildUpiDeepLink,
  formatAmountINR,
  isValidIndianPhone,
  normalizeIndianPhone,
} from "@/lib/upi";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  college: string;
  courseYear: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  college: "",
  courseYear: "",
  notes: "",
};

type PaymentPhase = "idle" | "awaiting" | "success" | "cancelled";

export default function StudentParticipationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const amountLabel = useMemo(
    () => formatAmountINR(PAYMENT_CONFIG.AMOUNT),
    []
  );

  const paymentConfirmed = paymentPhase === "success";

  // Restore payment session + honor URL callback params on return from UPI apps
  useEffect(() => {
    const statusParam = searchParams.get("payment");
    const refParam = searchParams.get("ref");

    // Demo / callback simulation:
    //   ?payment=success&ref=PAYXXX  → mark paid
    //   ?payment=cancelled           → mark cancelled
    if (statusParam === "success") {
      const stored =
        typeof window !== "undefined"
          ? sessionStorage.getItem(PAYMENT_SESSION_KEY)
          : null;
      let ref = refParam;
      if (!ref && stored) {
        try {
          ref = (JSON.parse(stored) as { paymentRef?: string }).paymentRef ?? null;
        } catch {
          /* ignore */
        }
      }
      markPaymentSuccess(ref ?? createPaymentRef());
      // Clean URL so refresh doesn't re-trigger
      router.replace("/", { scroll: false });
      return;
    }

    if (statusParam === "cancelled" || statusParam === "failed") {
      setPaymentPhase("cancelled");
      setIsPaying(false);
      router.replace("/", { scroll: false });
      return;
    }

    // Restore in-progress / completed payment from sessionStorage
    try {
      const raw = sessionStorage.getItem(PAYMENT_SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        paymentRef?: string;
        status?: PaymentStatus | "awaiting";
      };
      if (data.paymentRef) setPaymentRef(data.paymentRef);
      if (data.status === "paid") setPaymentPhase("success");
      else if (data.status === "awaiting") setPaymentPhase("awaiting");
    } catch {
      /* ignore corrupt session */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function markPaymentSuccess(ref: string) {
    setPaymentRef(ref);
    setPaymentPhase("success");
    setIsPaying(false);
    sessionStorage.setItem(
      PAYMENT_SESSION_KEY,
      JSON.stringify({ paymentRef: ref, status: "paid", at: Date.now() })
    );
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!form.phone.trim()) {
      next.phone = "Phone number is required.";
    } else if (!isValidIndianPhone(form.phone)) {
      next.phone = "Enter a valid 10-digit Indian mobile number.";
    }
    if (!form.college.trim()) next.college = "College / school name is required.";
    if (!form.courseYear.trim()) next.courseYear = "Course / year is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handlePay() {
    // Validate basics before opening UPI so payee gets meaningful context
    if (!validate()) {
      document
        .getElementById("student-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const ref = createPaymentRef();
    setPaymentRef(ref);
    setIsPaying(true);
    setPaymentPhase("awaiting");
    setSubmitError(null);

    sessionStorage.setItem(
      PAYMENT_SESSION_KEY,
      JSON.stringify({ paymentRef: ref, status: "awaiting", at: Date.now() })
    );

    const deepLink = buildUpiDeepLink({ transactionRef: ref });

    /*
     * Open UPI apps via Intent / deep link.
     * On mobile this launches the UPI chooser.
     * After paying, the student returns to the browser — we cannot reliably
     * get a native callback from plain UPI links, so we:
     *   1) keep "awaiting" state in sessionStorage
     *   2) offer "I have paid" + "Simulate Successful Payment" for demo
     *   3) support ?payment=success URL param for callback simulation
     *
     * PRODUCTION: integrate a payment gateway (Razorpay UPI Intent / PhonePe /
     * Cashfree) that provides verified server-side callbacks / webhooks.
     */
    window.location.href = deepLink;

    // Re-enable "I have paid" path after a short delay (user may cancel quickly)
    window.setTimeout(() => setIsPaying(false), 1500);
  }

  function handleConfirmPaid() {
    const ref = paymentRef ?? createPaymentRef();
    markPaymentSuccess(ref);
  }

  function handleSimulateSuccess() {
    const ref = paymentRef ?? createPaymentRef();
    markPaymentSuccess(ref);
  }

  function handleResetPayment() {
    setPaymentPhase("idle");
    setPaymentRef(null);
    setIsPaying(false);
    sessionStorage.removeItem(PAYMENT_SESSION_KEY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    if (!paymentConfirmed) {
      setSubmitError("Please complete the payment to submit the form.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Persist locally. Optionally also POST to /api/submit when available.
      const record = {
        id: createSubmissionId(),
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: normalizeIndianPhone(form.phone),
        college: form.college.trim(),
        courseYear: form.courseYear.trim(),
        notes: form.notes.trim(),
        amount: PAYMENT_CONFIG.AMOUNT,
        upiId: PAYMENT_CONFIG.UPI_ID,
        paymentStatus: "paid" as const,
        paymentRef,
        createdAt: new Date().toISOString(),
      };

      saveSubmission(record);

      try {
        await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
      } catch {
        // API is optional for demo — localStorage already saved
      }

      sessionStorage.removeItem(PAYMENT_SESSION_KEY);
      setSubmitted(true);
      setForm(INITIAL_FORM);
    } catch {
      setSubmitError("Something went wrong while saving. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="animate-fade-up mx-auto w-full max-w-lg rounded-3xl bg-white/85 p-8 shadow-soft backdrop-blur-sm sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-mint-500/15 animate-check-pop">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-mint-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="font-display text-center text-2xl font-bold text-ink-900">
          Thank you!
        </h2>
        <p className="mt-3 text-center text-ink-700/80">
          Your participation form has been submitted successfully.
          {paymentRef ? (
            <>
              {" "}
              Payment ref: <span className="font-semibold">{paymentRef}</span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="btn-secondary mt-8"
          onClick={() => {
            setSubmitted(false);
            setPaymentPhase("idle");
            setPaymentRef(null);
          }}
        >
          Submit another response
        </button>
      </section>
    );
  }

  return (
    <form
      id="student-form"
      onSubmit={handleSubmit}
      className="animate-fade-up mx-auto w-full max-w-lg space-y-6"
      noValidate
    >
      <section className="rounded-3xl bg-white/85 p-6 shadow-soft backdrop-blur-sm sm:p-8">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Student details
        </h2>
        <p className="mt-1 text-sm text-ink-700/70">
          All fields marked with * are required.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="fullName" className="field-label">
              Full Name *
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              className="field-input"
              placeholder="e.g. Ananya Sharma"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
            />
            {errors.fullName ? (
              <p className="field-error">{errors.fullName}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="email" className="field-label">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="field-input"
              placeholder="you@college.edu"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
            {errors.email ? <p className="field-error">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="phone" className="field-label">
              Phone Number *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              className="field-input"
              placeholder="10-digit Indian mobile"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
            {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
          </div>

          <div>
            <label htmlFor="college" className="field-label">
              College / School Name *
            </label>
            <input
              id="college"
              name="college"
              type="text"
              className="field-input"
              placeholder="Your institution"
              value={form.college}
              onChange={(e) => updateField("college", e.target.value)}
            />
            {errors.college ? (
              <p className="field-error">{errors.college}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="courseYear" className="field-label">
              Course / Year *
            </label>
            <input
              id="courseYear"
              name="courseYear"
              type="text"
              className="field-input"
              placeholder="e.g. B.Tech CSE — 2nd Year"
              value={form.courseYear}
              onChange={(e) => updateField("courseYear", e.target.value)}
            />
            {errors.courseYear ? (
              <p className="field-error">{errors.courseYear}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="notes" className="field-label">
              Additional notes{" "}
              <span className="font-normal text-ink-700/50">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="field-input resize-y"
              placeholder="Anything we should know?"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Payment section */}
      <section className="rounded-3xl border border-mint-500/20 bg-gradient-to-br from-white/95 via-white/90 to-mint-500/10 p-6 shadow-soft backdrop-blur-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Participation fee
            </h2>
            <p className="mt-1 text-sm text-ink-700/70">
              Pay via UPI (GPay, PhonePe, Paytm, and more)
            </p>
          </div>
          <p className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            {amountLabel}
          </p>
        </div>

        <p className="mt-4 rounded-xl bg-ink-50/80 px-3 py-2 text-xs text-ink-700/70">
          UPI ID: <span className="font-semibold text-ink-800">{PAYMENT_CONFIG.UPI_ID}</span>
        </p>

        {paymentConfirmed ? (
          <div
            className="mt-5 flex items-center gap-3 rounded-2xl border border-mint-500/30 bg-mint-500/10 px-4 py-3 animate-fade-up"
            role="status"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-500 text-white animate-check-pop">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <div>
              <p className="font-display font-bold text-mint-600">
                Payment Successful ✅
              </p>
              {paymentRef ? (
                <p className="text-xs text-ink-700/70">Ref: {paymentRef}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary mt-5"
              onClick={handlePay}
              disabled={isPaying || paymentPhase === "awaiting"}
            >
              {isPaying || paymentPhase === "awaiting" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Opening UPI…
                </>
              ) : (
                <>Pay {amountLabel} with UPI</>
              )}
            </button>

            {paymentPhase === "awaiting" || paymentPhase === "cancelled" ? (
              <div className="mt-4 space-y-3 animate-fade-up">
                {paymentPhase === "cancelled" ? (
                  <p className="text-sm font-medium text-coral-600">
                    Payment was not completed. Please try again.
                  </p>
                ) : (
                  <p className="text-sm text-ink-700/80">
                    After finishing payment in your UPI app, return here and
                    confirm below.
                  </p>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleConfirmPaid}
                >
                  I have completed the payment
                </button>

                <button
                  type="button"
                  className="btn-secondary border-dashed text-mint-600"
                  onClick={handleSimulateSuccess}
                >
                  Simulate Successful Payment
                </button>

                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-ink-700/60 underline-offset-2 hover:underline"
                  onClick={handleResetPayment}
                >
                  Cancel / try again
                </button>
              </div>
            ) : null}
          </>
        )}

        {!paymentConfirmed ? (
          <p className="mt-4 text-sm font-medium text-ink-700/70">
            Please complete the payment to submit the form.
          </p>
        ) : null}

        {/*
          Real gateway callback notes:
          - Razorpay: use Checkout + payment.captured webhook, then redirect
            with ?payment=success&ref=<order_id> after server verification.
          - PhonePe / Cashfree: same pattern — verify on server, then set
            session + unlock Submit.
          - Never unlock Submit based only on the user returning from UPI.
        */}
      </section>

      <section className="rounded-3xl bg-white/85 p-6 shadow-soft backdrop-blur-sm sm:p-8">
        {submitError ? (
          <p className="mb-4 text-sm font-medium text-coral-600" role="alert">
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={!paymentConfirmed || isSubmitting}
          aria-disabled={!paymentConfirmed || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Submitting…
            </>
          ) : (
            "Submit Form"
          )}
        </button>

        {!paymentConfirmed ? (
          <p className="mt-3 text-center text-xs text-ink-700/55">
            Submit stays disabled until payment is confirmed.
          </p>
        ) : null}
      </section>
    </form>
  );
}
