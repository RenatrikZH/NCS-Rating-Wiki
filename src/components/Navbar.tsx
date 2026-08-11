import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    username = profile?.username || null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-brand">NCS</span>
          <span className="text-lg font-semibold text-foreground">Ratings</span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-muted hover:text-foreground transition"
          >
            歌曲
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-muted">
                {username || user.email}
              </span>
              <LogoutButton />
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted hover:text-foreground transition"
              >
                登录
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-brand px-4 py-1.5 font-medium text-black hover:bg-brand-dark transition"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
