import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// In-memory registry: userId → Set<controller>
const clients = new Map<string, Set<ReadableStreamDefaultController>>();

export function notifyUser(userId: string, event: { type: string; data: object }) {
  const controllers = clients.get(userId);
  if (!controllers) return;
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const ctrl of Array.from(controllers)) {
    try { ctrl.enqueue(payload); } catch { /* client disconnected */ }
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const userId = user.id;
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId)!.add(controller);

      // Flush unread count on connect
      prisma.notification.count({ where: { userId, isRead: false } }).then(count => {
        try { ctrl.enqueue(`event: unread\ndata: ${JSON.stringify({ count })}\n\n`); } catch { /**/ }
      });

      // Keep-alive every 25s
      const keepAlive = setInterval(() => {
        try { ctrl.enqueue(": ping\n\n"); } catch { clearInterval(keepAlive); }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        clients.get(userId)?.delete(controller);
        if (clients.get(userId)?.size === 0) clients.delete(userId);
        try { ctrl.close(); } catch { /**/ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
