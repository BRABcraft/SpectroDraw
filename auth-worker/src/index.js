import { hash, compare } from "bcryptjs";
import { nanoid } from "nanoid";

const COOKIE_DOMAIN = ".spectrodraw.com"; // production: ".spectrodraw.com". For dev remove Domain or set to your dev host

// Configure allowed origins for CORS / CSRF protection.
// Only requests from these Origins will be allowed to send credentials.
// Add localhost entries for local dev as needed (e.g. "http://127.0.0.1:5173")
const ALLOWED_ORIGINS = new Set([
  "https://spectrodraw.com",
  "https://www.spectrodraw.com",
  "https://app.spectrodraw.com",
  "http://127.0.0.1:5500"
  // "http://127.0.0.1:5173", // dev: uncomment if you need it locally
]);

// Session lifetime (seconds)
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Preflight
      if (request.method === "OPTIONS") {
        return preflightResponse(request);
      }

      // Basic origin check for state-changing endpoints (simple CSRF protection)
      // We'll require a valid Origin header for POST requests that modify state.
      if (request.method === "POST") {
        const origin = request.headers.get("Origin");
        if (!isAllowedOrigin(origin)) {
          return json({ message: "Forbidden" }, 403);
        }
      }

      let response;
      if (url.pathname === "/auth/signup" && request.method === "POST") {
        response = await handleSignup(request, env);
      } else if (url.pathname === "/auth/login" && request.method === "POST") {
        response = await handleLogin(request, env);
      } else if (url.pathname === "/auth/logout" && request.method === "POST") {
        response = await handleLogout(request, env);
      } else if (url.pathname === "/auth/session" && request.method === "POST") {
        // Create server-side session from OAuth postMessage flow
        response = await handleCreateSessionFromOAuth(request, env);
      } else if (url.pathname === "/auth/status" && request.method === "GET") {
        response = await handleStatus(request, env);
      } else {
        response = new Response("Not found", { status: 404 });
      }

      return addCors(response, request);
    } catch (err) {
      // Log internal errors but don't leak messages to clients
      console.error("Unhandled error:", err);
      return json({ message: "Internal server error" }, 500);
    }
  },
};

/* ---------- Helpers ---------- */

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

function preflightResponse(request) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin : null;

  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    // No allow-origin (or set null) — disallow credentials
    headers["Access-Control-Allow-Origin"] = "null";
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

function addCors(response, request) {
  // Ensure CORS headers on every response (including errors)
  const origin = request.headers.get("Origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin : null;

  const headers = new Headers(response.headers);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
  } else {
    headers.set("Access-Control-Allow-Origin", "null");
  }

  // NOTE: response.body may be a stream; using text() is safe here because handlers return small JSON/text
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

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function getClientIP(request) {
  // Cloudflare sets CF-Connecting-IP; fallback to x-forwarded-for if present
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
}

/* ---------- KV key helpers ---------- */
/* Keep keys namespaced so keys are not ambiguous and to avoid accidental collisions. */
function userKey(email) {
  return `user:${email}`;
}
function sessionKey(token) {
  return `session:${token}`;
}
function loginFailKey(ip, email) {
  // optional rate limiting / brute-force tracking (if RATE_LIMITS binding exists)
  const safeEmail = email ? email.replace(/@/g, "_at_") : "unknown";
  return `fail:login:${ip}:${safeEmail}`;
}

/* Simple helper: if env.RATE_LIMITS exists (KV), use it to throttle repeated failures.
   If not present, these functions return false (no rate-limiting). */
async function recordFailedLogin(env, ip, email) {
  if (!env.RATE_LIMITS) return;
  try {
    const key = loginFailKey(ip, email);
    const cur = await env.RATE_LIMITS.get(key);
    const count = cur ? parseInt(cur, 10) : 0;
    const next = count + 1;
    // store with TTL 15 minutes
    await env.RATE_LIMITS.put(key, String(next), { expirationTtl: 60 * 15 });
    return next;
  } catch (e) {
    console.error("rate-limit store failed", e);
  }
}
async function clearFailedLogins(env, ip, email) {
  if (!env.RATE_LIMITS) return;
  try {
    const key = loginFailKey(ip, email);
    await env.RATE_LIMITS.delete(key);
  } catch (e) {
    console.error("rate-limit clear failed", e);
  }
}
async function getFailedLoginCount(env, ip, email) {
  if (!env.RATE_LIMITS) return 0;
  try {
    const key = loginFailKey(ip, email);
    const cur = await env.RATE_LIMITS.get(key);
    return cur ? parseInt(cur, 10) : 0;
  } catch (e) {
    console.error("rate-limit read failed", e);
    return 0;
  }
}

/* ---------- Handlers ---------- */

async function handleSignup(request, env) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!email || !username || !password) return json({ message: "Missing fields" }, 400);
    if (!validateEmail(email)) return json({ message: "Invalid email" }, 400);
    if (password.length < 8) return json({ message: "Password must be at least 8 characters" }, 400);

    const existing = await env.USERS.get(userKey(email));
    if (existing) {
      // It's okay to reveal that email is registered at signup — but if you prefer to avoid enumeration,
      // return a generic message instead.
      return json({ message: "Email already registered" }, 400);
    }

    const passwordHash = await hash(password, 12); // increase rounds slightly
    const user = { id: nanoid(), email, username, passwordHash, created: Date.now() };
    await env.USERS.put(userKey(email), JSON.stringify(user));

    // Optionally send verification email here (not implemented)

    return json({ user: { email: user.email, username: user.username } }, 201);
  } catch (err) {
    console.error("signup error:", err);
    return json({ message: "Signup failed" }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = body.password || "";

    if (!email || !password) return json({ message: "Missing credentials" }, 400);

    const ip = getClientIP(request);
    const fails = await getFailedLoginCount(env, ip, email);
    if (fails >= 10) {
      // Too many attempts from this IP/email combo — temporarily block
      return json({ message: "Too many login attempts. Try again later." }, 429);
    }

    const stored = await env.USERS.get(userKey(email));
    if (!stored) {
      // Generic response to avoid revealing which part failed
      await recordFailedLogin(env, ip, email);
      return json({ message: "Invalid credentials" }, 401);
    }

    const user = JSON.parse(stored);
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      await recordFailedLogin(env, ip, email);
      return json({ message: "Invalid credentials" }, 401);
    }

    // Successful login: clear failure counter
    await clearFailedLogins(env, ip, email);

    const token = nanoid();
    const sessionData = { email: user.email, username: user.username, created: Date.now() };
    // store with TTL
    if (env.SESSIONS) {
      // use KV put with expirationTtl when available
      try {
        await env.SESSIONS.put(sessionKey(token), JSON.stringify(sessionData), { expirationTtl: SESSION_TTL });
      } catch (e) {
        // Some runtimes may not support expirationTtl; fall back to plain put
        await env.SESSIONS.put(sessionKey(token), JSON.stringify(sessionData));
      }
    } else {
      // If no SESSIONS KV bound, still try to put (will throw) — we keep code robust
      await env.SESSIONS.put(sessionKey(token), JSON.stringify(sessionData));
    }

    // Build cookie; for prod use Domain=.spectrodraw.com. For dev you may remove Domain to allow localhost.
    const cookieParts = [
      `session=${token}`,
      `Path=/`,
      `Max-Age=${SESSION_TTL}`,
      `HttpOnly`,
      `SameSite=Lax`, // Lax reduces CSRF risk while still allowing typical top-level navigation flows
      `Secure`,
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
    console.error("login error:", err);
    return json({ message: "Login failed" }, 500);
  }
}

async function handleLogout(request, env) {
  try {
    // Attempt to delete session from KV (server-side)
    const cookie = request.headers.get("Cookie") || "";
    const m = cookie.match(/(?:^|; )session=([^;]+)/);
    if (m) {
      const token = m[1];
      try {
        await env.SESSIONS.delete(sessionKey(token));
      } catch (e) {
        // ignore deletion errors but log
        console.error("Failed to delete session KV:", e);
      }
    }

    // Clear cookie client-side by expiring it
    const cookieParts = [
      `session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    ];
    if (COOKIE_DOMAIN) cookieParts.push(`Domain=${COOKIE_DOMAIN}`);
    const headers = new Headers({ "Set-Cookie": cookieParts.join("; "), "Content-Type": "text/plain" });
    return new Response("Logged out", { status: 200, headers });
  } catch (err) {
    console.error("logout error:", err);
    return json({ message: "Logout failed" }, 500);
  }
}

async function handleCreateSessionFromOAuth(request, env) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const username = (body.username || "").trim();

    if (!email) return json({ message: "Missing email" }, 400);

    // Optionally ensure user exists; create if not:
    const existing = await env.USERS.get(userKey(email));
    if (!existing) {
      // create lightweight user record (no password)
      const createdUser = { id: nanoid(), email, username, oauth: true, created: Date.now() };
      await env.USERS.put(userKey(email), JSON.stringify(createdUser));
    }

    const token = nanoid();
    const sessionData = { email, username, created: Date.now() };
    try {
      await env.SESSIONS.put(sessionKey(token), JSON.stringify(sessionData), { expirationTtl: SESSION_TTL });
    } catch (e) {
      await env.SESSIONS.put(sessionKey(token), JSON.stringify(sessionData));
    }

    const cookieParts = [
      `session=${token}`,
      `Path=/`,
      `Max-Age=${SESSION_TTL}`,
      `HttpOnly`,
      `SameSite=None`, // OAuth flows often require SameSite=None — set to None for this flow
      `Secure`,
    ];
    if (COOKIE_DOMAIN) cookieParts.push(`Domain=${COOKIE_DOMAIN}`);

    const headers = new Headers({
      "Set-Cookie": cookieParts.join("; "),
      "Content-Type": "application/json",
    });

    return new Response(JSON.stringify({ success: true, email, username }), { status: 200, headers });
  } catch (err) {
    console.error("oauth session error:", err);
    return json({ message: "Failed to create session" }, 500);
  }
}

async function handleStatus(request, env) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const m = cookie.match(/(?:^|; )session=([^;]+)/);
    if (!m) return json({ loggedIn: false }, 200);
    const token = m[1];
    const stored = await env.SESSIONS.get(sessionKey(token));
    if (!stored) return json({ loggedIn: false }, 200);
    try {
      const sess = JSON.parse(stored);
      return json({ loggedIn: true, user: { email: sess.email, username: sess.username } }, 200);
    } catch (e) {
      console.error("session parse error:", e);
      return json({ loggedIn: true }, 200);
    }
  } catch (err) {
    console.error("status error:", err);
    return json({ message: "Status check failed" }, 500);
  }
}

/* ---------- Utilities ---------- */

function validateEmail(email) {
  // simple email validation (do not rely on regex alone for business logic)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
