import { NextResponse } from "next/server";
import { markPaymentFailed, markPaymentPaid } from "@/lib/payment-store";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * POST /api/payment/webhook
 *
 * Razorpay webhook receiver (automatic server-side confirmation).
 * Configure in Razorpay Dashboard → Webhooks:
 *   URL: https://<your-domain>/api/payment/webhook
 *   Events: payment.captured, payment.failed, order.paid
 *
 * The frontend does not call this — Razorpay does. The UI picks up
 * success by polling GET /api/payment/status after the student returns.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
        order?: {
          entity?: {
            id?: string;
            status?: string;
          };
        };
      };
    };

    const eventName = event.event || "";
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;

    if (
      eventName === "payment.captured" ||
      eventName === "order.paid" ||
      payment?.status === "captured"
    ) {
      const razorpayOrderId = payment?.order_id || order?.id;
      const paymentId = payment?.id;

      if (razorpayOrderId && paymentId) {
        await markPaymentPaid({
          razorpayOrderId,
          paymentId,
        });
      }
    }

    if (eventName === "payment.failed") {
      const razorpayOrderId = payment?.order_id;
      if (razorpayOrderId) {
        await markPaymentFailed({ razorpayOrderId });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook payload" },
      { status: 400 }
    );
  }
}
