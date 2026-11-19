import { STORAGE_KEY } from "./config";

export type PaymentStatus = "pending" | "paid" | "failed";

export interface SubmissionRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  courseYear: string;
  notes: string;
  amount: number;
  upiId: string;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  createdAt: string;
}

export function loadSubmissions(): SubmissionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SubmissionRecord[];
  } catch {
    return [];
  }
}

export function saveSubmission(record: SubmissionRecord): void {
  const existing = loadSubmissions();
  existing.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function createSubmissionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPaymentRef(): string {
  return `PAY${Date.now().toString(36).toUpperCase()}`;
}
