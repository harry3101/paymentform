import { NextResponse } from "next/server";

/**
 * Optional demo API route.
 *
 * In production you would:
 * 1. Validate the payload server-side
 * 2. Verify payment with your gateway (orderId / paymentId)
 * 3. Persist to a database
 * 4. Send a confirmation email
 *
 * For now we acknowledge the submission so the client can optionally POST.
 * Client also stores a copy in localStorage.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.fullName || !body?.email || !body?.phone) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (body.paymentStatus !== "paid") {
      return NextResponse.json(
        { ok: false, error: "Payment not confirmed" },
        { status: 402 }
      );
    }

    // Demo: log to server console. Replace with DB insert.
    console.log("[submission]", {
      id: body.id,
      fullName: body.fullName,
      email: body.email,
      amount: body.amount,
      paymentRef: body.paymentRef,
      at: body.createdAt,
    });

    return NextResponse.json({
      ok: true,
      message: "Submission received",
      id: body.id,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
