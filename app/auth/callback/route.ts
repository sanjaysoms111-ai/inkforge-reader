import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

// OAuth / email-link callback — exchanges the code for a session cookie then redirects.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Preserve the original destination (e.g. /library after login)
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Supabase auth callback exchange error", error);
  }

  // Auth failed — send back to login with a hint
  return NextResponse.redirect(`${origin}/login?error=Unable+to+sign+in`);
}
