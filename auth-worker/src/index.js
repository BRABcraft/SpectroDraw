import { hash, compare } from "bcryptjs";
import { nanoid } from "nanoid";

const COOKIE_DOMAIN = ".spectrodraw.com"; // production: ".spectrodraw.com". For dev remove Domain or set to your dev host

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === "OPTIONS") {
      return preflightResponse(request);
    }

    let response;
    if (url.pathname === "/auth/signup" && request.method === "POST") {
      response = await handleSignup(request, env);
    } else if (url.pathname === "/auth/login" && request.method === "POST") {
      response = await handleLogin(request, env);
    } else if (url.pathname === "/auth/logout" && request.method === "POST") {
      response = await handleLogout(request);
    } else if (url.pathname === "/auth/session" && request.method === "POST") {
      // Create server-side session from OAuth postMessage flow
      response = await handleCreateSessionFromOAuth(request, env);
    } else if (url.pathname === "/auth/status" && request.method === "GET") {
      response = await handleStatus(request, env);
    } else {
      response = new Response("Not found", { status: 404 });
    }

    return addCors(response, request);
  },
};

/* ---------- Helpers ---------- */

function preflightResponse(request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

function addCors(response, request) {
  // Ensure CORS headers on every response (including errors)
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
  headers.set("Access-Control-Allow-Credentials", "true");
  // NOTE: response.body may be a stream; using text() is safe here because our handlers return small JSON/text
  return response.text().then((bodyText) => {
    return new Response(bodyText, { status: response.status, headers });
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------- KV / SESSIONS usage ---------- */
/* Assumes env.USERS and env.SESSIONS are bound in your worker environment. */

/* ---------- Handlers ---------- */

async function handleSignup(request, env) {
  try {
    const { email, username, password } = await request.json();
    if (!email || !username || !password) return json({ message: "Missing fields" }, 400);

    const existing = await env.USERS.get(email.toLowerCase());
    if (existing) return json({ message: "Email already registered" }, 400);

    const passwordHash = await hash(password, 10);
    const user = { id: nanoid(), email: email.toLowerCase(), username, passwordHash };
    await env.USERS.put(user.email, JSON.stringify(user));

    return json({ user: { email: user.email, username: user.username } }, 201);
  } catch (err) {
    return json({ message: err.message || "Signup failed" }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ message: "Missing credentials" }, 400);

    const stored = await env.USERS.get(email.toLowerCase());
    if (!stored) return json({ message: "Invalid credentials" }, 401);
    const user = JSON.parse(stored);

    const ok = await compare(password, user.passwordHash);
    if (!ok) return json({ message: "Invalid credentials" }, 401);

    const token = nanoid();
    await env.SESSIONS.put(token, JSON.stringify({ email: user.email, username: user.username, created: Date.now() }));

    // Build cookie; for prod use Domain=.spectrodraw.com. For dev you may remove Domain to allow localhost.
    const cookieParts = [
      `session=${token}`,
      `Path=/`,
      `Max-Age=${60 * 60 * 24 * 30}`, // 30 days; adjust
      `HttpOnly`,
      `SameSite=None`,
      `Secure`
    ];
    if (COOKIE_DOMAIN) cookieParts.push(`Domain=${COOKIE_DOMAIN}`);

    const headers = new Headers({
      "Set-Cookie": cookieParts.join("; "),
      "Content-Type": "application/json",
    });

    return new Response(JSON.stringify({ user: { email: user.email, username: user.username } }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return json({ message: err.message || "Login failed" }, 500);
  }
}

async function handleLogout(request) {
  // Clear cookie client-side by expiring it
  const cookieParts = [
    `session=; Path=/; Max-Age=0; HttpOnly; SameSite=None; Secure`
  ];
  if (COOKIE_DOMAIN) cookieParts.push(`Domain=${COOKIE_DOMAIN}`);
  const headers = new Headers({ "Set-Cookie": cookieParts.join("; "), "Content-Type": "text/plain" });
  return new Response("Logged out", { status: 200, headers });
}

async function handleCreateSessionFromOAuth(request, env) {
  try {
    const body = await request.json();
    const email = (body.email || "").toLowerCase();
    const username = body.username || "";

    if (!email) return json({ message: "Missing email" }, 400);

    // Optionally ensure user exists; create if not:
    const existing = await env.USERS.get(email);
    if (!existing) {
      // create lightweight user record (no password)
      const createdUser = { id: nanoid(), email, username, oauth: true };
      await env.USERS.put(email, JSON.stringify(createdUser));
    }

    const token = nanoid();
    await env.SESSIONS.put(token, JSON.stringify({ email, username, created: Date.now() }));

    const cookieParts = [
      `session=${token}`,
      `Path=/`,
      `Max-Age=${60 * 60 * 24 * 30}`,
      `HttpOnly`,
      `SameSite=None`,
      `Secure`
    ];
    if (COOKIE_DOMAIN) cookieParts.push(`Domain=${COOKIE_DOMAIN}`);

    const headers = new Headers({
      "Set-Cookie": cookieParts.join("; "),
      "Content-Type": "application/json",
    });

    return new Response(JSON.stringify({ success: true, email, username }), { status: 200, headers });
  } catch (err) {
    return json({ message: err.message || "Failed to create session" }, 500);
  }
}

async function handleStatus(request, env) {
  // Return whether a session cookie is present and valid
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!m) return json({ loggedIn: false }, 200);
  const token = m[1];
  const stored = await env.SESSIONS.get(token);
  if (!stored) return json({ loggedIn: false }, 200);
  try {
    const sess = JSON.parse(stored);
    return json({ loggedIn: true, user: { email: sess.email, username: sess.username } }, 200);
  } catch (e) {
    return json({ loggedIn: true }, 200);
  }
}
