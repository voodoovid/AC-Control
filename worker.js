// AC Control relay: Cloudflare Worker. Forwards /sensibo/* to the Sensibo API and adds CORS headers.
// Only answers requests from the allowed origin and only talks to home.sensibo.com.
const ALLOWED_ORIGIN = "https://voodoovid.github.io";

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    const url = new URL(request.url);
    if (url.pathname === "/ping") return new Response("ok", { headers: cors });
    if (!url.pathname.startsWith("/sensibo/")) return new Response("Not found", { status: 404, headers: cors });

    const target = "https://home.sensibo.com/api" + url.pathname.slice("/sensibo".length) + url.search;
    const init = { method: request.method, headers: { "Content-Type": "application/json" } };
    if (!["GET", "HEAD"].includes(request.method)) init.body = await request.text();
    const upstream = await fetch(target, init);
    const headers = new Headers(cors);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
