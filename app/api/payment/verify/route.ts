import { NextResponse } from "next/server";
import {
  getPaymentByOrderId,
  getPaymentByRazorpayOrderId,
  markPaymentPaid,
} from "@/lib/payment-store";
import { verifyCheckoutSignature } from "@/lib/razorpay";

/**
 * POST /api/payment/verify
 * Verifies Razorpay Checkout success payload (HMAC signature).
 * This is the primary automatic confirmation path after UPI in Checkout.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = String(body.orderId || "").trim();
    const razorpayOrderId = String(body.razorpay_order_id || "").trim();
    const paymentId = String(body.razorpay_payment_id || "").trim();
    const signature = String(body.razorpay_signature || "").trim();

    if (!razorpayOrderId || !paymentId || !signature) {
      return NextResponse.json(
        { ok: false, error: "Missing payment verification fields." },
        { status: 400 }
      );
    }

    const valid = verifyCheckoutSignature({
      orderId: razorpayOrderId,
      paymentId,
      signature,
    });

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid payment signature." },
        { status: 400 }
      );
    }

    const existing =
      (orderId ? await getPaymentByOrderId(orderId) : null) ||
      (await getPaymentByRazorpayOrderId(razorpayOrderId));

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Payment order not found." },
        { status: 404 }
      );
    }

    if (
      existing.razorpayOrderId &&
      existing.razorpayOrderId !== razorpayOrderId
    ) {
      return NextResponse.json(
        { ok: false, error: "Order mismatch." },
        { status: 400 }
      );
    }

    const updated = await markPaymentPaid({
      orderId: existing.orderId,
      razorpayOrderId,
      paymentId,
      signature,
    });

    return NextResponse.json({
      ok: true,
      status: "paid",
      orderId: updated?.orderId,
      paymentId,
      message: "Payment Successful ✅",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
