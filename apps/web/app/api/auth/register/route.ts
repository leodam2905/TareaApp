import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7, "Phone number is required"),
  password: z.string().min(8),
  role: z.enum(["CUSTOMER", "HANDYMAN"]),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = rateLimit(`register:${ip}`, 5, 3_600_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many registrations from this IP. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        latitude: data.latitude,
        longitude: data.longitude,
        ...(data.role === "HANDYMAN" && {
          handymanProfile: {
            create: { hourlyRate: 50 },
          },
        }),
      },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(token);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tarea.app";
    const dashPath = data.role === "HANDYMAN" ? "/handyman/dashboard" : "/customer/dashboard";
    sendEmail(
      user.email,
      "Welcome to Tarea!",
      `Welcome, ${user.name.split(" ")[0]}!`,
      `You're all set. ${data.role === "HANDYMAN" ? "Complete your profile and start earning." : "Browse services and book a handyman in minutes."}`,
      { label: "Go to Dashboard", url: `${appUrl}${dashPath}` },
    ).catch(() => {});

    return NextResponse.json({ id: user.id, name: user.name, role: user.role }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
