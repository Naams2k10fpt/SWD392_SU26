const services = {
  auth: process.env.AUTH_BASE_URL || "http://localhost:5000",
  wallet: process.env.WALLET_BASE_URL || "http://localhost:5040",
} as const;

type Context = { params: Promise<{ service: string; path: string[] }> };

async function proxy(request: Request, context: Context) {
  const { service, path } = await context.params;
  const baseUrl = services[service as keyof typeof services];
  if (!baseUrl) return Response.json({ message: "Unknown backend service" }, { status: 404 });

  const incoming = new URL(request.url);
  const target = new URL(path.map(encodeURIComponent).join("/"), `${baseUrl.replace(/\/$/, "")}/`);
  target.search = incoming.search;

  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Backend proxy error:", error);
    return Response.json({ message: "Không thể kết nối backend service" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
