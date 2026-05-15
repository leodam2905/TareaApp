import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPendingToken, signPendingToken } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";

const schema = z.object({ pendingToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { pendingToken } = schema.parse(await req.json());

    const userId = verifyPendingToken(pendingToken);
    if (!userId) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      return NextResponse.json({ error: "No phone number on file." }, { status: 400 });
    }

    await createAndSendOtp(user.id, user.phone, user.email);

    // Issue a fresh 10-min pending token
    return NextResponse.json({ pendingToken: signPendingToken(user.id) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
