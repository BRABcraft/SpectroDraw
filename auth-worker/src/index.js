import { hash, compare } from "bcryptjs";
import { nanoid } from "nanoid";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    let response;

    if (url.pathname === "/auth/signup" && request.method === "POST") {
      response = await handleSignup(request, env);
    } else if (url.pathname === "/auth/login" && request.method === "POST") {
      response = await handleLogin(request, env);
    } else if (url.pathname === "/auth/logout" && request.method === "POST") {
      response = await handleLogout();
    } else {
      response = new Response("Not found", { status: 404 });
    }

    // Attach CORS headers to all responses
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
    headers.set("Access-Control-Allow-Credentials", "true");

    return new Response(await response.text(), { status: response.status, headers });
  },
};


/** USERS stored in a KV namespace (simple example) */
async function handleSignup(request, env) {
  const { email, username, password } = await request.json();

  if (!email || !password || !username)
    return new Response("Missing fields", { status: 400 });

  const existing = await env.USERS.get(email);
  if (existing)
    return new Response("Email already registered", { status: 400 });

  const passwordHash = await hash(password, 10);
  const user = { id: nanoid(), email, username, passwordHash };

  await env.USERS.put(email, JSON.stringify(user));

  return json({ user: { email, username } });
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();

  const stored = await env.USERS.get(email);
  if (!stored)
    return new Response("Invalid credentials", { status: 401 });

  const user = JSON.parse(stored);
  const ok = await compare(password, user.passwordHash);
  if (!ok)
    return new Response("Invalid credentials", { status: 401 });

  // Make a fake session token (JWT recommended later)
  const token = nanoid();
  await env.SESSIONS.put(token, JSON.stringify({ email, created: Date.now() }));

  const headers = new Headers({
    "Set-Cookie": `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    "Content-Type": "application/json",
  });

  return new Response(
    JSON.stringify({ user: { email, username: user.username } }),
    { headers }
  );
}

async function handleLogout() {
  const headers = new Headers({
    "Set-Cookie": "session=; Path=/; Max-Age=0",
  });
  return new Response("Logged out", { headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
