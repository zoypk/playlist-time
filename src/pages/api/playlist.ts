import type { APIRoute } from "astro";

export const prerender = false;

const WORKER_API_BASE = (import.meta.env.PUBLIC_WORKER_API_BASE ?? "http://127.0.0.1:8788").replace(/\/$/, "");

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const list = requestUrl.searchParams.get("list")?.trim();

  if (!list) {
    return new Response(JSON.stringify({ error: "Missing query param: list=PLAYLIST_ID" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const target = `${WORKER_API_BASE}/api/playlist?list=${encodeURIComponent(list)}`;

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        "user-agent": request.headers.get("user-agent") || "playlist-time-dev-proxy"
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": upstream.headers.get("cache-control") || "no-store"
      }
    });
  } catch {
    return new Response(
      JSON.stringify({
        error:
          "Local API unavailable. Start the Cloudflare function server with `bun run worker:dev` (or set PUBLIC_WORKER_API_BASE)."
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" }
      }
    );
  }
};
