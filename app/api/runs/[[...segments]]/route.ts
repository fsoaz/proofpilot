import { isLoopbackHost, workerUrl } from "../../../../shared/local";

type Context = { params: Promise<{ segments?: string[] }> };

async function proxy(request: Request, context: Context) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!isLoopbackHost(host) || (origin !== null && origin !== `http://${host}`)) {
    return Response.json({ error: "Use the local dashboard." }, { status: 403 });
  }
  const { segments = [] } = await context.params;
  const path = segments.map(encodeURIComponent).join("/");
  const destination = `${workerUrl}/runs${path ? "/" + path : ""}`;
  try {
    const write = request.method === "POST";
    const worker = await fetch(destination, {
      method: request.method,
      body: write ? await request.text() : undefined,
      headers: write ? { "Content-Type": request.headers.get("content-type") ?? "" } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return new Response(worker.body, { status: worker.status, headers: worker.headers });
  } catch {
    return Response.json({ error: "The local worker is unavailable." }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
