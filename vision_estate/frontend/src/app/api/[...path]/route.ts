import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (
    !path.length ||
    path.some((s) => !s || s === "." || s === ".." || /[/\\]/.test(s))
  )
    return NextResponse.json({ detail: "Invalid API path." }, { status: 400 });
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin)
      return NextResponse.json(
        { detail: "Cross-origin requests are not accepted." },
        { status: 403 },
      );
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const name of ["cookie", "authorization", "idempotency-key", "x-assessment-token"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.text();
  if (body && new TextEncoder().encode(body).length > 32768)
    return NextResponse.json(
      { detail: "Request is too large." },
      { status: 413 },
    );
  try {
    const upstream = await fetch(
      (process.env.API_INTERNAL_URL || "http://127.0.0.1:3001") +
        "/v1/" +
        path.map(encodeURIComponent).join("/") +
        req.nextUrl.search,
      {
        method: req.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      },
    );
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
    for (const cookie of upstream.headers.getSetCookie())
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch {
    return NextResponse.json(
      {
        detail:
          "The service is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
