import { Suspense } from "react";
import StudentParticipationForm from "@/components/StudentParticipationForm";
import { PAYMENT_CONFIG } from "@/lib/config";
import { formatAmountINR } from "@/lib/upi";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 animate-fade-up text-center sm:mb-10">
        <p className="mb-3 inline-flex items-center rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-700/70 backdrop-blur">
          Open registration
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Student Participation Form
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-ink-700/75">
          Fill in your details, pay{" "}
          <span className="font-semibold text-ink-800">
            {formatAmountINR(PAYMENT_CONFIG.AMOUNT)}
          </span>{" "}
          via UPI, then submit your registration.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-lg rounded-3xl bg-white/70 p-10 text-center text-sm text-ink-700/60 shadow-soft">
            Loading form…
          </div>
        }
      >
        <StudentParticipationForm />
      </Suspense>

      <footer className="mt-10 text-center text-xs text-ink-700/45">
        Payments go to {PAYMENT_CONFIG.UPI_ID}. Use a mobile UPI app to complete
        payment.
      </footer>
    </main>
  );
}
