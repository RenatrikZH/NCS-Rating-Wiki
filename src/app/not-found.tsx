import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-6xl font-bold text-brand">404</h1>
      <p className="mt-4 text-lg text-muted">页面不存在</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-brand px-4 py-2 font-medium text-black hover:bg-brand-dark transition"
      >
        返回首页
      </Link>
    </div>
  );
}
