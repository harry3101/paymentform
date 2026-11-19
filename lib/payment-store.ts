import { promises as fs } from "fs";
import path from "path";

export type GatewayPaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export interface PaymentOrder {
  orderId: string;
  razorpayOrderId: string | null;
  amount: number;
  currency: string;
  status: GatewayPaymentStatus;
  paymentId: string | null;
  signature: string | null;
  student: {
    fullName: string;
    email: string;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

const STORE_FILE = path.join(process.cwd(), ".data", "payments.json");

type StoreShape = Record<string, PaymentOrder>;

async function ensureStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw) as StoreShape;
  } catch {
    return {};
  }
}

async function writeStore(data: StoreShape): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function savePaymentOrder(order: PaymentOrder): Promise<void> {
  const store = await ensureStore();
  store[order.orderId] = order;
  if (order.razorpayOrderId) {
    store[`rzp:${order.razorpayOrderId}`] = order;
  }
  await writeStore(store);
}

export async function getPaymentByOrderId(
  orderId: string
): Promise<PaymentOrder | null> {
  const store = await ensureStore();
  return store[orderId] ?? null;
}

export async function getPaymentByRazorpayOrderId(
  razorpayOrderId: string
): Promise<PaymentOrder | null> {
  const store = await ensureStore();
  const direct = store[`rzp:${razorpayOrderId}`];
  if (direct) return direct;
  return (
    Object.values(store).find(
      (o) => o && o.razorpayOrderId === razorpayOrderId
    ) ?? null
  );
}

export async function markPaymentPaid(options: {
  orderId?: string;
  razorpayOrderId?: string;
  paymentId: string;
  signature?: string | null;
}): Promise<PaymentOrder | null> {
  const order = options.orderId
    ? await getPaymentByOrderId(options.orderId)
    : options.razorpayOrderId
      ? await getPaymentByRazorpayOrderId(options.razorpayOrderId)
      : null;

  if (!order) return null;

  const updated: PaymentOrder = {
    ...order,
    status: "paid",
    paymentId: options.paymentId,
    signature: options.signature ?? order.signature,
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await savePaymentOrder(updated);
  return updated;
}

export async function markPaymentFailed(options: {
  orderId?: string;
  razorpayOrderId?: string;
}): Promise<PaymentOrder | null> {
  const order = options.orderId
    ? await getPaymentByOrderId(options.orderId)
    : options.razorpayOrderId
      ? await getPaymentByRazorpayOrderId(options.razorpayOrderId)
      : null;

  if (!order) return null;

  const updated: PaymentOrder = {
    ...order,
    status: "failed",
    updatedAt: new Date().toISOString(),
  };

  await savePaymentOrder(updated);
  return updated;
}

export async function markPaymentPending(
  orderId: string
): Promise<PaymentOrder | null> {
  const order = await getPaymentByOrderId(orderId);
  if (!order) return null;
  if (order.status === "paid") return order;

  const updated: PaymentOrder = {
    ...order,
    status: "pending",
    updatedAt: new Date().toISOString(),
  };
  await savePaymentOrder(updated);
  return updated;
}

export function createLocalOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
