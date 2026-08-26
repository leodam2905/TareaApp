import { NextRequest } from "next/server";
import { storeRedirect } from "../route";

// taptarea.com/get/pro — the same hand-out link, for recruiting pros.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return storeRedirect(req, "pro");
}
