// AC Control relay: Cloudflare Worker (v2).
//   /sensibo/*      -> Sensibo API (home.sensibo.com), CORS added
//   /fglair/signin  -> FGLair (US) sign-in; the app id/secret live here, not in the web page
//   /fglair/refresh -> FGLair token refresh
//   /fglair/api/*   -> FGLair (US) device API, limited to the few paths the app needs
// Only answers requests from the allowed origin.
const ALLOWED_ORIGIN = "https://voodoovid.github.io";

const FG_USER = "https://user-field.aylanetworks.com";
const FG_ADS = "https://ads-field.aylanetworks.com/apiv1/";
const FG_APP = { app_id: "CJIOSP-id", app_secret: "CJIOSP-Vb8MQL_lFiYQ7DKjN0eCFXznKZE" };
const FG_ALLOWED = [
  /^devices\.json$/,
  /^dsns\/[A-Za-z0-9_-]+\/properties\.json$/,
  /^properties\/[A-Za-z0-9_-]+\/datapoints\.json$/,
];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    const url = new URL(request.url);
    const reply = (upstream) => {
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      return new Response(upstream.body, { status: upstream.status, headers });
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (url.pathname === "/ping") return new Response("ok", { headers: cors });

    // ---- Sensibo ----
    if (url.pathname.startsWith("/sensibo/")) {
      const target = "https://home.sensibo.com/api" + url.pathname.slice("/sensibo".length) + url.search;
      const init = { method: request.method, headers: { "Content-Type": "application/json" } };
      if (!["GET", "HEAD"].includes(request.method)) init.body = await request.text();
      return reply(await fetch(target, init));
    }

    // ---- FGLair (Hawaii) ----
    if (url.pathname === "/fglair/signin" && request.method === "POST") {
      let b; try { b = await request.json(); } catch (e) { return json({ error: "Bad request" }, 400); }
      if (!b.email || !b.password) return json({ error: "Email and password required" }, 400);
      const up = await fetch(FG_USER + "/users/sign_in.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { email: b.email, password: b.password, application: FG_APP } }),
      });
      return reply(up);
    }
    if (url.pathname === "/fglair/refresh" && request.method === "POST") {
      let b; try { b = await request.json(); } catch (e) { return json({ error: "Bad request" }, 400); }
      if (!b.refresh_token) return json({ error: "refresh_token required" }, 400);
      const up = await fetch(FG_USER + "/users/refresh_token.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { refresh_token: b.refresh_token } }),
      });
      return reply(up);
    }
    if (url.pathname.startsWith("/fglair/api/")) {
      const path = url.pathname.slice("/fglair/api/".length);
      if (!FG_ALLOWED.some((re) => re.test(path))) return json({ error: "Path not allowed" }, 403);
      const auth = request.headers.get("Authorization");
      if (!auth) return json({ error: "No token" }, 401);
      const init = { method: request.method, headers: { "Content-Type": "application/json", Authorization: auth } };
      if (!["GET", "HEAD"].includes(request.method)) init.body = await request.text();
      return reply(await fetch(FG_ADS + path + url.search, init));
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
