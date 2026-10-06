import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/guest-booking/health
 * Quick sanity-check: verifies firebase-admin can initialise correctly.
 * Returns the specific error message if credentials are missing or wrong.
 */
export async function GET() {
  try {
    const { firebaseAdminDb } = await import("../../../../lib/firebase-admin");
    // Minimal Firestore call to confirm connectivity
    await firebaseAdminDb.collection("_health").limit(1).get();
    return NextResponse.json({ ok: true, message: "Firebase Admin connected ✓" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
