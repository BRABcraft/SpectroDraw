// diagnostic api-worker
export default {
  async fetch(request, env) {
    try {
      // List required bindings used by this worker:
      const required = ['SESSIONS']; // add 'USERS' here if used by this worker
      const missing = required.filter(k => !env || typeof env[k] === 'undefined');

      if (missing.length) {
        const msg = `Misconfigured worker: missing bindings: ${missing.join(', ')}`;
        console.error(msg);
        return addCors(json({ message: msg }, 500), request);
      }

      const url = new URL(request.url);
      const { pathname } = url;

      if (request.method === "OPTIONS") return preflightResponse(request);

      const user = await parseAuth(request, env);

      if (pathname.startsWith("/api/") && !user) {
        return addCors(json({ message: "Unauthorized" }, 401), request);
      }

      if (pathname === "/api/reviews" && request.method === "POST") {
        return addCors(await handleReviewPost(request, user, env), request);
      }
      if (pathname === "/api/reviews" && request.method === "GET") {
        return addCors(await handleReviewList(user, env), request);
      }
      if (pathname === "/api/share/invite" && request.method === "POST") {
        return addCors(await handleShareInvite(request, user, env), request);
      }

      return addCors(new Response("Not Found", { status: 404 }), request);
    } catch (err) {
      console.error("API worker uncaught error:", err);
      return addCors(json({ message: err.message || "Internal server error" }, 500), request);
    }
  },
};

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
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
  headers.set("Access-Control-Allow-Credentials", "true");
  return new Response(response.body, { status: response.status, headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------- simple storage ---------- */
const reviews = [];
const invites = [];

/* ---------- parseAuth with defensive checks ---------- */
async function parseAuth(request, env) {
  // Authorization header fallback
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token) {
      if (!env || typeof env.SESSIONS === 'undefined') {
        const msg = 'parseAuth: env.SESSIONS is undefined';
        console.error(msg);
        throw new Error(msg);
      }
      const stored = await env.SESSIONS.get(token);
      if (stored) {
        try { return JSON.parse(stored); } catch (e) { return { email: stored }; }
      }
    }
  }

  // Cookie session
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!m) return null;
  const token = m[1];
  if (!env || typeof env.SESSIONS === 'undefined') {
    const msg = 'parseAuth: env.SESSIONS is undefined (cookie path)';
    console.error(msg);
    throw new Error(msg);
  }
  const session = await env.SESSIONS.get(token);
  if (!session) return null;
  try { return JSON.parse(session); } catch (e) { return { email: session }; }
}

/* ---------- handlers (unchanged) ---------- */
async function handleReviewPost(request, user, env) {
  const form = await request.formData();
  const rating = parseInt(form.get("rating"), 10);
  const text = (form.get("text") || "").toString().trim();
  if (!rating || rating < 1 || rating > 5) return json({ message: "Invalid rating" }, 400);

  let imageBase64 = null;
  const imageFile = form.get("image");
  if (imageFile && imageFile.arrayBuffer) {
    const buf = await imageFile.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const b64 = btoa(String.fromCharCode(...bytes));
    const mime = imageFile.type || "image/png";
    imageBase64 = `data:${mime};base64,${b64}`;
  }

  const review = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    user: user.email,
    rating,
    text,
    image: imageBase64,
    createdAt: new Date().toISOString(),
  };
  reviews.push(review);
  return json({ success: true, review }, 201);
}

async function handleReviewList(user, env) {
  const userReviews = reviews.filter((r) => r.user === user.email);
  return json({ reviews: userReviews }, 200);
}

async function handleShareInvite(request, user, env) {
  try {
    const { email } = await request.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ message: "Invalid email" }, 400);
    const invite = { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()), from: user.email, to: email, sentAt: new Date().toISOString() };
    invites.push(invite);
    return json({ sent: true, invite }, 200);
  } catch (err) {
    return json({ message: err.message || "Failed to send invite" }, 500);
  }
}
