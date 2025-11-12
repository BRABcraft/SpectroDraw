// diagnostic api-worker + upload-to-R2 handler
export default {
  async fetch(request, env) {
    try {
      // List required bindings used by this worker:
      const required = ['SESSIONS', 'IMAGES', 'USERS', 'REVIEWS']; // IMAGES should be your R2 binding (or an object with .put())
      const missing = required.filter(k => !env || typeof env[k] === 'undefined');

      if (missing.length) {
        const msg = `Misconfigured worker: missing bindings: ${missing.join(', ')}`;
        console.error(msg);
        return addCors(json({ message: msg }, 500), request);
      }

      const url = new URL(request.url);
      const { pathname } = url;

      if (request.method === "OPTIONS") return preflightResponse(request);

      // get a simple user representation from headers/cookies/KV (no localStorage on workers)
      const user = await parseAuth(request, env);

      // Protect /api/* routes as before
      if (pathname.startsWith("/api/") && !user) {
        return addCors(json({ message: "Unauthorized request.header:" + (request.headers.get("X-Spectrodraw-User") || request.headers.get("X-User-Email")) + "; env: " + env }, 401), request);
      }
      // upload endpoint (no /api prefix so you can call POST /upload directly)
      if (pathname === "/upload" && request.method === "POST") {
        return addCors(await handleUpload(request, user, env), request);
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
      if (pathname === "/auth/session" && request.method === "POST") {
        return addCors(await handleSessionCreate(request, env), request);
      }
			if ((request.method === 'GET' || request.method === 'HEAD') && pathname.startsWith('/pins/')) {
				return addCors(await handleGetPin(request, env, pathname), request);
			}
			if (pathname === "/api/claim" && request.method === "POST") {
        return addCors(await handleClaimPost(request, user, env), request);
      }
      if (pathname === "/api/products" && request.method === "GET") {
        return addCors(await handleProductList(request, user, env), request);
      }
      if (request.method === 'GET' && pathname === '/spectrodraw-pro/pro-ui-kv') {
        return addCors(await handleKVProUI(request, env), request);
      }
      if (pathname === "/api/pro-token" && request.method === "POST") {
        return addCors(await handleProToken(request, env), request);
      }

      try {
        console.log('STATIC_CHECK start ->', { method: request.method, url: request.url, pathname, host: request.headers.get('host') });

        // Is __STATIC_CONTENT bound?
        const hasStaticBinding = !!env.__STATIC_CONTENT && typeof env.__STATIC_CONTENT.fetch === 'function';
        console.log('STATIC_CHECK __STATIC_CONTENT bound?', hasStaticBinding);

        if (!hasStaticBinding) {
          console.warn('STATIC_CHECK: __STATIC_CONTENT binding missing or not fetchable');
        } else {
          // Attempt to fetch the static asset using the original request
          let assetResp;
          try {
            assetResp = await env.__STATIC_CONTENT.fetch(request);
          } catch (fetchErr) {
            // Log fetch error
            console.error('STATIC_CHECK: __STATIC_CONTENT.fetch threw error:', String(fetchErr));
            assetResp = null;
          }

          console.log('STATIC_CHECK: assetResp status:', assetResp ? assetResp.status : '(no response)');

          // If asset found (2xx or 3xx), return it with CORS
          if (assetResp && assetResp.status >= 200 && assetResp.status < 400) {
            console.log('STATIC_CHECK: returning static asset for', pathname);
            return addCors(assetResp, request);
          } else {
            console.log('STATIC_CHECK: no static asset served for', pathname);
          }
        }
      } catch (err) {
        console.error('STATIC_CHECK: unexpected error:', err);
      }

      // final fallback 404
      return addCors(new Response("Not Found", { status: 404 }), request);
    } catch (err) {
      console.error("API worker uncaught error:", err);
      return addCors(json({ message: err.message || "Internal server error" }, 500), request);
    }
  },
	async scheduled(controller, env, ctx) {
    try {
      console.log("Scheduled cleanup started");
      await cleanupOldPins(env);
      console.log("Scheduled cleanup finished");
    } catch (err) {
      console.error("Scheduled cleanup error:", err);
    }
  }
};

function preflightResponse(request) {
  const origin = request.headers.get("Origin") || "*";
  // If the browser lists requested headers in Access-Control-Request-Headers, echo them back.
  const reqHeaders = request.headers.get("Access-Control-Request-Headers");
  // Allow at minimum these headers plus any requested ones:
  const allowedHeaders = reqHeaders || "Content-Type,Authorization,X-Spectrodraw-User";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      // either echo requested headers or provide the list including your custom header
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    },
  });
}

function addCors(response, request) {
  const headers = new Headers(response.headers || {});
  const origin = request && request.headers ? request.headers.get("Origin") : null;
  headers.set("Access-Control-Allow-Origin", origin || "*");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
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

/* ---------- simplified parseAuth ---------- */
/*
  Note: Workers cannot access browser localStorage. If the client stores user info
  in localStorage, send it to the worker (e.g. as a header or cookie).
  This function supports:
    1) X-Spectrodraw-User header (JSON or plain email)
    2) spectrodraw_user cookie (URL-encoded JSON or plain email)
    3) session cookie checked against env.SESSIONS (if available)
*/
async function parseAuth(request, env) {
  try {
    // 1) header (dev-friendly; client can send localStorage value here)
    const header = request.headers.get("X-Spectrodraw-User") || request.headers.get("X-User-Email");
    if (header) {
      try {
        return JSON.parse(header);
      } catch (e) {
        return { email: header };
      }
    }

    // 2) spectrodraw_user cookie (URL-encoded JSON or plain string)
    const cookieHeader = request.headers.get("Cookie") || "";
    const m = cookieHeader.match(/(?:^|; )spectrodraw_user=([^;]+)/);
    if (m && m[1]) {
      const decoded = decodeURIComponent(m[1]);
      try {
        return JSON.parse(decoded);
      } catch (e) {
        return { email: decoded };
      }
    }

    // 3) session cookie -> lookup in env.SESSIONS (if configured)
    const sm = cookieHeader.match(/(?:^|; )session=([^;]+)/);
    if (sm && sm[1] && env && typeof env.SESSIONS !== "undefined") {
      const token = sm[1];
      const stored = await env.SESSIONS.get(token);
      if (stored) {
        try { return JSON.parse(stored); } catch (e) { return { email: stored }; }
      } else {
        console.warn("parseAuth: session token not found in SESSIONS");
      }
    }

    // nothing found
    return null;
  } catch (err) {
    console.error("parseAuth unexpected error:", err);
    return null;
  }
}
async function handleProToken(request, env) {
  try {
    // parseAuth supports X-Spectrodraw-User header, spectrodraw_user cookie, or session cookie
    const user = await parseAuth(request, env);
    if (!user || !user.email) {
      return json({ message: "Unauthorized" }, 401);
    }

    if (!env || typeof env.USERS === "undefined" || typeof env.SESSIONS === "undefined") {
      return json({ message: "Server misconfigured: USERS or SESSIONS KV not available" }, 500);
    }

    const email = String(user.email).trim().toLowerCase();

    // Check that this email has a recorded claim for SpectroDraw Pro
    // (this mirrors the existing handleClaimPost/store format)
    const claimRaw = await env.USERS.get(`product:${email}`);
    if (!claimRaw) return json({ message: "Not authorized for Pro" }, 403);

    // optional: validate product field inside stored claim
    try {
      const parsed = JSON.parse(claimRaw);
      if (parsed && parsed.product && parsed.product !== "SpectroDraw Pro") {
        return json({ message: "Not authorized for Pro" }, 403);
      }
    } catch (e) {
      // if parsing fails, continue (we already checked existence)
    }

    // Create a short-lived token and store in SESSIONS KV under pro-token:<token>
    const token = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2,10);
    const ttl = parseInt(env.PRO_UI_TOKEN_TTL || "300", 10); // seconds; default 300s = 5min
    const key = `pro-token:${token}`;

    // Store token value (we store a small JSON so you can inspect who it's for)
    await env.SESSIONS.put(key, JSON.stringify({ email, created: Date.now() }), { expirationTtl: ttl });

    return json({ token, expiresIn: ttl }, 200);
  } catch (err) {
    console.error("handleProToken error:", err);
    return json({ message: err.message || "Failed to create token" }, 500);
  }
}
async function handleKVProUI(request, env) {
  try {
    // Require a valid ephemeral token to serve the Pro HTML.
    const reqUrl = new URL(request.url);
    const token = reqUrl.searchParams.get('t') || request.headers.get('X-Pro-Token');
    if (!token) {
      return addCors(new Response('Unauthorized', { status: 401 }), request);
    }

    if (!env || typeof env.SESSIONS === "undefined") {
      return addCors(new Response('Server misconfigured', { status: 500 }), request);
    }

    const tokenKey = `pro-token:${token}`;
    const tokRaw = await env.SESSIONS.get(tokenKey);
    if (!tokRaw) {
      // token missing or expired
      return addCors(new Response('Unauthorized or token expired', { status: 401 }), request);
    }
    const kvBindingName = '__spectrodraw-api-workers_sites_assets';
    const kv = env && env[kvBindingName];

    if (!kv || typeof kv.get !== 'function') {
      console.error('handleKVProUI: KV binding not configured or wrong binding name:', kvBindingName);
      return addCors(new Response('Server misconfigured', { status: 500 }), request);
    }

    // Helper: return Response with html and proper headers
    function htmlResponse(htmlBody) {
      const headers = new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0'
      });
      return addCors(new Response(htmlBody, { status: 200, headers }), request);
    }

    // 1) If explicit env key provided, try that first
    const envKey = env && env.PRO_UI_KEY;
    if (envKey) {
      try {
        const maybe = await kv.get(envKey);
        if (maybe) {
          console.debug('handleKVProUI: served via env.PRO_UI_KEY ->', envKey);
          return htmlResponse(maybe.toString());
        } else {
          console.debug('handleKVProUI: env.PRO_UI_KEY set but key missing in KV:', envKey);
        }
      } catch (e) {
        console.warn('handleKVProUI: error reading env.PRO_UI_KEY from KV:', e);
      }
    }

    // 2) Look for pointer key (recommended deployment pattern)
    const pointerKey = 'pro-bundles/pro-ui.current';
    try {
      const pointerVal = await kv.get(pointerKey);
      if (pointerVal) {
        // pointerVal might be either:
        //  - the actual HTML content (if you choose to write the HTML to the pointer key)
        //  - or the name of the current hashed key (e.g. "pro-bundles/pro-ui.6ca2075a67.html")
        // Heuristic: if it looks like HTML, treat as content; else treat as a key name.
        const str = pointerVal.toString();
        if (/<\s*html[\s>]/i.test(str) || str.trim().startsWith('<!doctype') || str.trim().startsWith('<html')) {
          console.debug('handleKVProUI: pointer key contains HTML content ->', pointerKey);
          return htmlResponse(str);
        } else {
          // treat pointerVal as the key name; try to fetch it
          try {
            const candidate = await kv.get(str);
            if (candidate) {
              console.debug('handleKVProUI: pointer key pointed to hashed key ->', str);
              return htmlResponse(candidate.toString());
            } else {
              console.debug('handleKVProUI: pointer key pointed to non-existent key:', str);
            }
          } catch (e) {
            console.warn('handleKVProUI: error resolving pointer target key:', e);
          }
        }
      } else {
        console.debug('handleKVProUI: pointer key not present:', pointerKey);
      }
    } catch (e) {
      console.warn('handleKVProUI: failed to read pointer key:', e);
    }

    // 3) Fallback: list keys with prefix and pick a candidate (best effort)
    try {
      // list keys with prefix 'pro-bundles/pro-ui' (limit tuned; increase if you store many versions)
      const list = await kv.list({ prefix: 'pro-bundles/pro-ui', limit: 1000 });
      const names = (list && list.keys && list.keys.length) ? list.keys.map(k => k.name) : [];

      // filter to .html files and exclude obvious non-ui assets
      const htmlNames = names.filter(n => typeof n === 'string' && /\.html$/i.test(n) && /pro-ui/i.test(n));
      if (htmlNames.length === 0) {
        console.warn('handleKVProUI: no pro-ui keys found in KV under prefix pro-bundles/pro-ui');
        return addCors(new Response('Pro UI not available', { status: 404 }), request);
      }

      // If exactly one candidate, use it
      if (htmlNames.length === 1) {
        const only = htmlNames[0];
        const val = await kv.get(only);
        if (val) return htmlResponse(val.toString());
      }

      // Multiple candidates -> pick "best" candidate by heuristics:
      //  - prefer keys containing ".latest." or "-latest" (if present)
      //  - otherwise prefer the longest name (often hashed names include extra characters)
      //  - otherwise pick last after sorting (deterministic fallback)
      let chosen = null;

      const latestMatch = htmlNames.find(n => /(\.latest\.|-latest|\-current)/i.test(n));
      if (latestMatch) chosen = latestMatch;
      if (!chosen) {
        // choose by length (longer names often include hash; this is heuristic)
        htmlNames.sort((a,b) => b.length - a.length);
        chosen = htmlNames[0];
      }
      if (!chosen) {
        htmlNames.sort();
        chosen = htmlNames[htmlNames.length - 1];
      }

      if (chosen) {
        try {
          const val = await kv.get(chosen);
          if (val) {
            console.debug('handleKVProUI: selected candidate key via heuristic ->', chosen);
            return htmlResponse(val.toString());
          } else {
            console.warn('handleKVProUI: chosen candidate missing when fetched:', chosen);
          }
        } catch (e) {
          console.warn('handleKVProUI: error fetching chosen candidate:', e);
        }
      }

      // if all else fails:
      console.warn('handleKVProUI: failed to resolve a usable pro-ui key from KV candidates', htmlNames);
      return addCors(new Response('Pro UI not available', { status: 404 }), request);
    } catch (e) {
      console.error('handleKVProUI: error while listing KV keys:', e);
      return addCors(new Response('Internal server error', { status: 500 }), request);
    }

  } catch (err) {
    console.error('handleKVProUI unexpected error:', err);
    return addCors(new Response('Internal server error', { status: 500 }), request);
  }
}

/* ---------- handlers (unchanged except upload) ---------- */

async function handleUpload(request, user, env) {
  // Accepts multipart/form-data with field 'file'
  // Stores to env.IMAGES (R2 or compatible) and returns { url: "https://cdn..." }
  try {
    // Option: require auth for upload. Uncomment if you want:
    // if (!user) return json({ message: 'Unauthorized' }, 401);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return json({ message: 'Invalid content-type, expected multipart/form-data' }, 400);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file) return json({ message: 'Missing file field (name it "file")' }, 400);

    if (!file.arrayBuffer) {
      return json({ message: 'Uploaded item is not a file' }, 400);
    }

    const buf = await file.arrayBuffer();
		const bytes = new Uint8Array(buf);
		const mime = file.type || 'application/octet-stream';
		const key = `pins/${Date.now()}-${sanitizeFilename((file.name || 'upload').toString())}`;

		// store bytes and metadata in KV
		await env.IMAGES.put(key, bytes, { metadata: { contentType: mime } });
		const host = env.PUBLIC_HOST || request.headers.get('Host') || 'api.spectrodraw.com';
		const hostNoSlash = host.replace(/\/$/, '');
		const scheme = (request.headers.get('X-Forwarded-Proto') || 'https').split(',')[0].trim();
		const publicUrl = `${scheme}://${hostNoSlash}/${key}`;
		return json({ url: publicUrl }, 200);
		
  } catch (err) {
    console.error('handleUpload error:', err);
    return json({ message: err.message || 'Upload failed' }, 500);
  }
}

function sanitizeFilename(name) {
  // Remove path segments, replace spaces with underscores, remove unsafe chars
  const base = name.split('/').pop().split('\\').pop();
  // keep only safe characters, replace spaces -> _
  return base.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
}

/* ---------- original handlers (unchanged) ---------- */
async function handleReviewPost(request, user, env) {
  const form = await request.formData();
  const rating = parseInt(form.get("rating"), 10);
  const text = (form.get("text") || "").toString().trim();
  if (!rating || rating < 1 || rating > 5) return json({ message: "Invalid rating" }, 400);

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32 KB per chunk
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  let imageBase64 = null;
  const imageFile = form.get("image");
  if (imageFile && imageFile.arrayBuffer) {
    const buf = await imageFile.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
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

  // Store in KV
  await env.REVIEWS.put(review.id, JSON.stringify(review));

  // Optionally, maintain a per-user index of review IDs for easy listing
  const userKey = `user:${user.email.toLowerCase()}:reviews`;
  const existingIdsRaw = await env.REVIEWS.get(userKey);
  let existingIds = [];
  if (existingIdsRaw) {
    try { existingIds = JSON.parse(existingIdsRaw); } catch(e){ existingIds = []; }
  }
  existingIds.push(review.id);
  await env.REVIEWS.put(userKey, JSON.stringify(existingIds));

  return json({ success: true, review }, 201);
}

async function handleReviewList(user, env) {
  const userKey = `user:${user.email.toLowerCase()}:reviews`;
  const idsRaw = await env.REVIEWS.get(userKey);
  let reviewsList = [];
  if (idsRaw) {
    try {
      const ids = JSON.parse(idsRaw);
      for (const id of ids) {
        const reviewRaw = await env.REVIEWS.get(id);
        if (reviewRaw) {
          reviewsList.push(JSON.parse(reviewRaw));
        }
      }
    } catch(e) {
      console.error("Failed to parse reviews for user:", e);
    }
  }
  return json({ reviews: reviewsList }, 200);
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
async function handleSessionCreate(request, env) {
  // expects JSON: { email, username }
  try {
    const body = await request.json();
    const email = (body && body.email) ? body.email : null;
    const username = (body && body.username) ? body.username : null;
    if (!email) return json({ message: "Missing email" }, 400);

    if (!env || typeof env.SESSIONS === "undefined") {
      const msg = "handleSessionCreate: env.SESSIONS is undefined";
      console.error(msg);
      return json({ message: msg }, 500);
    }

    // create a session token
    const token = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

    const session = { email, username, provider: "oauth", created: Date.now() };
    await env.SESSIONS.put(token, JSON.stringify(session));

    // Set cookie for the whole domain so subdomains (api.spectrodraw.com, app.spectrodraw.com) can read it
    // IMPORTANT: For cookies to be sent cross-subdomain, use Domain=.spectrodraw.com (adjust if your domain differs)
    const cookie = `session=${token}; Path=/; Domain=.spectrodraw.com; HttpOnly; Secure; SameSite=Lax`;

    const headers = new Headers({
      "Set-Cookie": cookie,
      "Content-Type": "application/json"
    });

    return new Response(JSON.stringify({ ok: true, user: { email, username } }), { status: 200, headers });
  } catch (err) {
    console.error("handleSessionCreate error:", err);
    return json({ message: err.message || "Failed to create session" }, 500);
  }
}
async function handleGetPin(request, env, pathname) {
  const key = pathname.replace(/^\/+/, '');
  // get value as arrayBuffer
  const arrBuf = await env.IMAGES.get(key, { type: 'arrayBuffer' });
  if (arrBuf === null) return new Response('Not Found', { status: 404 });

  // get metadata separately (get with metadata)
  const meta = await env.IMAGES.get(key, { metadata: true });
  const contentType = (meta && meta.metadata && meta.metadata.contentType) ? meta.metadata.contentType : 'application/octet-stream';

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  // caching - tune as you need
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(arrBuf, { status: 200, headers });
}

//
// Scheduled cleanup: delete pins older than retentionDays (default 30)
// This expects your keys to be in the format `pins/<timestamp>-<name>`
//
async function cleanupOldPins(env) {
  const retentionDays = parseInt(env.IMAGES_RETENTION_DAYS || '1', 10);
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // R2 list pages — iterate through keys with prefix 'pins/'
  let continuation = undefined;
  do {
    const listOpts = { prefix: 'pins/', limit: 1000 };
    if (continuation) listOpts.cursor = continuation;
    const list = await env.IMAGES.list(listOpts);

    if (list && list.objects && list.objects.length) {
      for (const obj of list.objects) {
        // obj.key is 'pins/<timestamp>-...'; try to parse timestamp
        const key = obj.key;
        const m = key.match(/^pins\/(\d+)-/);
        if (!m) {
          // If we can't parse timestamp, skip or decide to delete — here we skip.
          continue;
        }
        const ts = Number(m[1]);
        if (isNaN(ts)) continue;
        if ((now - ts) > retentionMs) {
          try {
            await env.IMAGES.delete(key);
            console.log(`Deleted old pin: ${key}`);
          } catch (err) {
            console.error(`Failed to delete ${key}:`, err);
          }
        }
      }
    }

    continuation = list.truncated ? list.cursor : undefined;
  } while (continuation);
}
async function handleClaimPost(request, user, env) {
  try {
    if (!user || !user.email) return json({ message: "Missing authenticated user email" }, 400);
    if (!env || typeof env.USERS === "undefined") {
      return json({ message: "Server misconfigured: USERS KV not available" }, 500);
    }

    const email = String(user.email).trim().toLowerCase();
    const now = new Date().toISOString();
    const claimKey = `product:${email}`;

    // store per-email claim metadata (overwrite is fine — idempotent)
    await env.USERS.put(claimKey, JSON.stringify({ email, product:"SpectroDraw Pro", price:"Free (early access deal)", claimedAt: now }));

    // maintain an index of claimed emails (JSON array stored at 'products:index')
    const indexKey = 'products:index';
    let idxRaw = await env.USERS.get(indexKey);
    let index = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }
    if (!index.includes(email)) {
      index.push(email);
      // store updated index (best-effort; KV is eventually consistent)
      await env.USERS.put(indexKey, JSON.stringify(index));
    }

    return json({ claimed: true, email, claimedAt: now }, 201);
  } catch (err) {
    console.error('handleClaimPost error:', err);
    return json({ message: err.message || 'Failed to record claim' }, 500);
  }
}

// GET /api/claim  -> return list of products (email + claimedAt)
async function handleProductList(request, user, env) {
  try {
    if (!env || typeof env.USERS === "undefined") {
      return json({ message: "Server misconfigured: USERS KV not available" }, 500);
    }

    const indexKey = 'products:index';
    const idxRaw = await env.USERS.get(indexKey);
    let index = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }

    // fetch each claim metadata (if present)
    const products = [];
    for (const email of index) {
      try {
        const claimRaw = await env.USERS.get(`product:${String(email).toLowerCase()}`);
        if (claimRaw) {
          try {
            products.push(JSON.parse(claimRaw));
            continue;
          } catch (e) { /* fallthrough to fallback */ }
        }
        // fallback entry if specific key missing or parse failed
        products.push({ email, claimedAt: null });
      } catch (e) {
        products.push({ email, claimedAt: null });
      }
    }

    return json({ products }, 200);
  } catch (err) {
    console.error('handleProductList error:', err);
    return json({ message: err.message || 'Failed to list products' }, 500);
  }
}
