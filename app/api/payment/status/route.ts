import { NextResponse } from "next/server";
import {
  getPaymentByOrderId,
  markPaymentFailed,
  markPaymentPaid,
  markPaymentPending,
} from "@/lib/payment-store";
import {
  fetchOrderPayments,
  fetchRazorpayOrderStatus,
  getRazorpayConfig,
} from "@/lib/razorpay";

/**
 * GET /api/payment/status?orderId=...
 *
 * Automatic verification endpoint.
 * Called by the frontend when the student returns to the page (focus /
 * visibility). Re-checks Razorpay order + payments APIs and updates
 * local status. Submit unlocks only when status === "paid".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim();

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "orderId is required" },
      { status: 400 }
    );
  }

  const local = await getPaymentByOrderId(orderId);
  if (!local) {
    return NextResponse.json(
      { ok: false, error: "Payment order not found" },
      { status: 404 }
    );
  }

  // Already confirmed locally
  if (local.status === "paid") {
    return NextResponse.json({
      ok: true,
      status: "paid",
      orderId: local.orderId,
      paymentId: local.paymentId,
      amount: local.amount,
      message: "Payment Successful ✅",
    });
  }

  const { isConfigured } = getRazorpayConfig();
  if (!isConfigured || !local.razorpayOrderId) {
    return NextResponse.json({
      ok: true,
      status: local.status,
      orderId: local.orderId,
      paymentId: local.paymentId,
      amount: local.amount,
      message:
        local.status === "failed"
          ? "Payment failed. Please try again."
          : "Waiting for payment confirmation…",
    });
  }

  try {
    // 1) Ask Razorpay for authoritative order status
    const rzpStatus = await fetchRazorpayOrderStatus(local.razorpayOrderId);

    if (rzpStatus === "paid") {
      const payments = await fetchOrderPayments(local.razorpayOrderId);
      const captured =
        payments.find((p) => p.status === "captured") || payments[0];

      const updated = await markPaymentPaid({
        orderId: local.orderId,
        razorpayOrderId: local.razorpayOrderId,
        paymentId: captured?.id || `rzp_${local.razorpayOrderId}`,
      });

      return NextResponse.json({
        ok: true,
        status: "paid",
        orderId: updated?.orderId ?? local.orderId,
        paymentId: updated?.paymentId,
        amount: local.amount,
        message: "Payment Successful ✅",
      });
    }

    // 2) Check individual payments (captured / authorized / failed)
    const payments = await fetchOrderPayments(local.razorpayOrderId);
    const captured = payments.find(
      (p) => p.status === "captured" || p.status === "authorized"
    );
    if (captured) {
      const updated = await markPaymentPaid({
        orderId: local.orderId,
        razorpayOrderId: local.razorpayOrderId,
        paymentId: captured.id,
      });

      return NextResponse.json({
        ok: true,
        status: "paid",
        orderId: updated?.orderId ?? local.orderId,
        paymentId: captured.id,
        amount: local.amount,
        message: "Payment Successful ✅",
      });
    }

    const failedOnly =
      payments.length > 0 &&
      payments.every((p) => p.status === "failed");

    if (failedOnly) {
      await markPaymentFailed({ orderId: local.orderId });
      return NextResponse.json({
        ok: true,
        status: "failed",
        orderId: local.orderId,
        amount: local.amount,
        message: "Payment failed or was cancelled. Please try again.",
      });
    }

    if (rzpStatus === "attempted") {
      await markPaymentPending(local.orderId);
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      orderId: local.orderId,
      amount: local.amount,
      message:
        "Waiting for payment confirmation. Complete payment in your UPI app, then return to this page.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json(
      {
        ok: true,
        status: local.status,
        orderId: local.orderId,
        amount: local.amount,
        message: `Could not refresh gateway status: ${message}`,
      },
      { status: 200 }
    );
  }
}
