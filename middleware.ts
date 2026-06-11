import { type NextRequest } from "next/server";
import { updateSession } from "./app/lib/supabase/middleware";

// Root middleware: keeps Supabase auth session fresh on every request
// and redirects unauthenticated users away from protected routes (/library, /creator, /upload, /profile).
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Match all routes except static assets, images, and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
