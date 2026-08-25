import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - Telegram webhook
     * - Speedtest endpoints
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - images
     */
    "/((?!api/telegram/webhook|api/speedtest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
