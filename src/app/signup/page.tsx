"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user) {
      // 检查是否需要邮箱验证
      if (data.session) {
        // 无需验证，直接登录
        router.push("/");
        router.refresh();
      } else {
        // 需要邮箱验证
        setSuccess(true);
        setLoading(false);
      }
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold text-like">注册成功</h1>
        <p className="text-muted">
          请检查你的邮箱完成验证，然后登录。
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 font-medium text-black hover:bg-brand-dark transition"
        >
          前往登录
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">注册</h1>
      {error && (
        <div className="mb-4 rounded-md border border-dislike/30 bg-dislike/10 p-3 text-sm text-dislike">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-4 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-4 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-md border border-border bg-surface px-4 py-2 focus:border-brand focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">密码至少 6 位</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-black hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? "注册中..." : "注册"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        已有账号？{" "}
        <Link href="/login" className="text-brand hover:underline">
          登录
        </Link>
      </p>
    </div>
  );
}
