// diagnostic api-worker + upload-to-R2 handler
export default {
  async fetch(request, env) {
    try {
      // List required bindings used by this worker:
      const required = ['SESSIONS', 'IMAGES', 'USERS', 'REVIEWS', 'FEEDBACK']; // IMAGES should be your R2 binding (or an object with .put())
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
        // Allow unauthenticated POST /api/orders (create) and POST /api/orders/:id/capture during dev
        const isCreateOrder = (pathname === '/api/orders' && request.method === 'POST');
        const isCaptureOrder = !!pathname.match(/^\/api\/orders\/[^\/]+\/capture$/) && request.method === 'POST';

        if (!(isCreateOrder || isCaptureOrder)) {
          console.warn("Unauthorized request to " + pathname + " from origin: " + (request.headers.get("Origin") || "unknown"));
          return addCors(json({ message: "Unauthorized" }, 401), request);
        }
      }
      // upload endpoint (no /api prefix so you can call POST /upload directly)
      if (pathname === "/upload" && request.method === "POST") {
        return addCors(await handleUpload(request, user, env), request);
      }

      if (pathname === "/api/reviews" && request.method === "POST") {
        return addCors(await handleReviewPost(request, user, env), request);
      }
      if (pathname === "/api/reviews" && request.method === "GET") {
        return addCors(await handleReviewList(request, user, env), request);
      }
      if (pathname === "/api/feedbacks" && request.method === "POST") {
        return addCors(await handleFeedbackPost(request, user, env), request);
      }
      if (pathname === "/api/feedbacks" && request.method === "GET") {
        return addCors(await handleFeedbackList(user, env), request);
      }
      if (pathname === "/api/store-interest" && request.method === "POST") {
        return addCors(await handleStoreInterest(request, user, env), request);
      }
      if (pathname.startsWith("/api/feedbacks/") && pathname.endsWith("/vote") && request.method === "POST") {
        const id = pathname.split("/")[3];
        return addCors(await handleFeedbackVote(request, user, env, id), request);
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
			if (pathname === "/api/make-purchase" && request.method === "POST") {
        return addCors(await handleMakePurchase(request, user, env), request);
      }
			if (pathname === "/check-product-database" && request.method === "POST") {
        return addCors(await checkProductDatabase(request,user,env), request);
      }
      if (pathname === "/api/products" && request.method === "GET") {
        return addCors(await handleProductList(request, user, env), request);
      }
      if (request.method === 'GET' && pathname === '/spectrodraw-pro/pro-ui-kv') {
        return addCors(await handleKVProUI(request, env), request);
      }
      if (request.method === 'GET' && pathname === '/spectrodraw-pro/manifest.json') {
        return addCors(await handleManifestJson(request, env), request);
      }
      if (pathname === "/api/pro-token" && request.method === "POST") {
        return addCors(await handleProToken(request, env), request);
      }
      if (pathname === '/api/orders' && request.method === 'POST') {
        return addCors(await handleApiOrdersCreate(request, env), request);
      }
      const orderCaptureMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/capture$/);
      if (orderCaptureMatch && request.method === 'POST') {
        return addCors(await handleApiOrdersCapture(request, env, orderCaptureMatch[1]), request);
      }
      if (request.method === "GET" && pathname === "/load-sneak-peak") {
        return addCors(await handleSneakPeak(request, env), request);
      }
      if ((request.method === 'GET' || request.method === 'HEAD') && pathname.startsWith('/spectrodraw-pro/')) {
        const kvBindingName = '__spectrodraw-api-workers_sites_assets'; // <-- confirm this name
        const kv = env && env[kvBindingName];
        if (kv && typeof kv.get === 'function') {
          const key = pathname.replace(/^\//, ''); // e.g. "spectrodraw-pro/pro-bundles/..."
          try {
            // If your kv keys are stored as "pro-bundles/..." remove the leading "spectrodraw-pro/"
            const candidateKey = key.replace(/^spectrodraw-pro\//, '');
            // try to get raw bytes
            const arr = await kv.get(candidateKey, { type: 'arrayBuffer' });
            if (arr !== null) {
              // Try to read metadata for Content-Type (if stored)
              let meta = null;
              try { meta = await kv.get(candidateKey, { metadata: true }); } catch (e) {}
              const contentType = meta && meta.metadata && meta.metadata.contentType
                                ? meta.metadata.contentType
                                : guessContentType(candidateKey);
              const headers = new Headers({
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
              });
              if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
              return addCors(new Response(arr, { status: 200, headers }), request);
            }
          } catch (e) {
            console.warn('KV asset fetch error for', candidateKey, e);
            // fallthrough to existing logic
          }
        } else {
          console.warn('KV binding missing for assets:', kvBindingName);
        }
      }
      function guessContentType(key) {
        if (/\.(css)$/i.test(key)) return 'text/css';
        if (/\.(js)$/i.test(key)) return 'application/javascript';
        if (/\.(png)$/i.test(key)) return 'image/png';
        if (/\.(jpg|jpeg)$/i.test(key)) return 'image/jpeg';
        if (/\.(svg)$/i.test(key)) return 'image/svg+xml';
        if (/\.(ico)$/i.test(key)) return 'image/x-icon';
        return 'application/octet-stream';
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
  // If the browser listed requested headers in Access-Control-Request-Headers, echo them back.
  const reqHeaders = request.headers.get("Access-Control-Request-Headers");
  // Default allowed headers (do not include custom user header by default)
  const defaultAllowed = "Content-Type, Authorization";
  const allowedHeaders = reqHeaders || defaultAllowed;

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob: https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com https://*.braintreegateway.com https://apis.google.com",
    "script-src-elem 'self' 'unsafe-inline' blob: https://www.paypal.com https://www.sandbox.paypal.com https://*.paypalobjects.com https://*.braintreegateway.com https://apis.google.com",
    "frame-src https://www.paypal.com https://www.sandbox.paypal.com https://*.braintreegateway.com",
    "worker-src 'self' blob:",
    "connect-src 'self' https://api-m.sandbox.paypal.com https://api-m.paypal.com https://*.paypal.com https://*.paypalobjects.com",
    "img-src 'self' https://*.paypal.com https://*.paypalobjects.com data:",
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'"
  ].join("; ");

  //headers.set("Content-Security-Policy", csp);
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

async function parseAuth(request, env) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";

    // 1) session cookie -> lookup in env.SESSIONS (primary)
    const sm = cookieHeader.match(/(?:^|; )session=([^;]+)/);
    if (sm && sm[1] && env && typeof env.SESSIONS !== "undefined") {
      const token = sm[1];
      try {
        const stored = await env.SESSIONS.get(token);
        if (stored) {
          try { return JSON.parse(stored); } catch (e) { return { email: String(stored) }; }
        } else {
          // session missing/expired — treat as unauthenticated
          console.warn("parseAuth: session token not found in SESSIONS for token:", token);
        }
      } catch (err) {
        console.error("parseAuth: error reading env.SESSIONS:", err);
      }
    }

    // 2) spectrodraw_user cookie (compat fallback; value should be encodeURIComponent(JSON))
    const m = cookieHeader.match(/(?:^|; )spectrodraw_user=([^;]+)/);
    if (m && m[1]) {
      try {
        const decoded = decodeURIComponent(m[1]);
        try { return JSON.parse(decoded); } catch (e) { return { email: decoded }; }
      } catch (err) {
        console.warn("parseAuth: failed to decode spectrodraw_user cookie", err);
      }
    }

    // 3) legacy header ONLY when explicitly allowed via env (dev convenience - disabled by default)
    if (env && String(env.ALLOW_LEGACY_HEADER || "").toLowerCase() === "true") {
      const header = request.headers.get("X-Spectrodraw-User") || request.headers.get("X-User-Email");
      if (header) {
        try { return JSON.parse(header); } catch (e) { return { email: header }; }
      }
    }

    // nothing found
    return null;
  } catch (err) {
    console.error("parseAuth unexpected error:", err);
    return null;
  }
}
async function handleManifestJson(request, env) {
  try {
    const kvBindingName = '__spectrodraw-api-workers_sites_assets'; // change if your binding is different
    const kv = env && env[kvBindingName];

    try {
      const listing = await kv.list({ prefix: 'pro-bundles/', limit: 1000 });
      const keys = (listing && listing.keys) ? listing.keys.map(k => k.name) : [];
      if (!keys.length) return addCors(new Response('Manifest not found', { status: 404 }), request);

      const manifest = {};
      for (const name of keys) {
        // Derive logical name: take portion after last slash
        const logical = name.replace(/^pro-bundles\//, '').replace(/.{11}(?=\.[^.]+$)/, "");
        // If file name contains folder segments (e.g., assets/toothbrush.svg), keep them.
        // Here we map both the logical basename and the full relative path to the hashed key.
        const parts = logical.split('/');
        const basename = parts[parts.length - 1];
        manifest[logical] = name;
        if (!manifest[basename]) manifest[basename] = name;
      }
      const text = JSON.stringify(manifest);
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        // short cache so clients pick up a real manifest after you deploy a proper one
        'Cache-Control': 'public, max-age=10'
      });
      return addCors(new Response(text, { status: 200, headers }), request);
    } catch (e) {
      console.error('handleManifestJson: failed to build manifest from KV listing', e);
      return addCors(new Response('Manifest not available', { status: 404 }), request);
    }
  } catch (err) {
    console.error('handleManifestJson unexpected error:', err);
    return addCors(json({ message: err.message || 'Internal server error' }, 500), request);
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

async function handleReviewList(request, user, env) {
  try {
    const url = new URL(request.url);
    // allow client to request page size; default 10, max 100
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
    const cursor = url.searchParams.get('cursor') || undefined;

    // list that page of keys
    const list = await env.REVIEWS.list({ cursor, limit });
    const keys = (list && Array.isArray(list.keys)) ? list.keys : [];

    // filter out index keys (e.g. user:... keys)
    const reviewKeys = keys.filter(k => !k.name.startsWith('user:')).map(k => k.name);

    // fetch values for this page in parallel (small page size)
    const values = await Promise.all(reviewKeys.map(k => env.REVIEWS.get(k)));

    const reviewsList = [];
    for (let i = 0; i < values.length; i++) {
      const raw = values[i];
      const key = reviewKeys[i];
      if (!raw) continue;
      try {
        reviewsList.push(JSON.parse(raw));
      } catch (e) {
        console.error('Invalid review JSON for key', key, e);
      }
    }

    // return the page and the cursor for the next page (or null)
    const nextCursor = list.cursor || null;
    return json({ reviews: reviewsList, nextCursor }, 200);
  } catch (err) {
    console.error("Failed to list reviews:", err);
    return json({ error: "Failed to load reviews" }, 500);
  }
}
import { EmailMessage } from "cloudflare:email";

async function sendFeedbackCopyEmail(env, feedback) {
  const subject = `New feedback from ${feedback.author || "Anonymous"}`;

  const files =
    (feedback.files || [])
      .map(f => `- ${f.name}`)
      .join("\n") || "None";

  const body = `
A new SpectroDraw feedback was submitted.

Author: ${feedback.author || "Anonymous"}
User: ${feedback.user || "anonymous"}
Created: ${feedback.createdAt}

Message:
${feedback.text}

Files:
${files}
`;

  const rawEmail =
`From: SpectroDraw <no-reply@spectrodraw.com>
To: spectrodraw@gmail.com
Subject: ${subject}
Content-Type: text/plain; charset=utf-8

${body}
`;

  const email = new EmailMessage(
    "no-reply@spectrodraw.com",
    "spectrodraw@gmail.com",
    rawEmail
  );

  await env.FEEDBACK_NOTIFY.send(email);
}
// SERVER: handleFeedbackPost
async function handleFeedbackPost(request, user, env) {
  const form = await request.formData();
  const text = (form.get("text") || "").toString().trim();
  if (!text) return json({ message: "Feedback text required" }, 400);

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  const files = [];
  for (const [key, value] of form.entries()) {
    if (value && typeof value.arrayBuffer === 'function' && (value.name || value.type)) {
      try {
        const buf = await value.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        const mime = value.type || 'application/octet-stream';
        files.push({
          fieldName: key,
          name: value.name || 'file',
          type: mime,
          size: buf.byteLength,
          dataUrl: `data:${mime};base64,${b64}`
        });
      } catch (e) {
        console.warn('file conversion failed', e);
      }
    }
  }

  const feedback = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    user: user?.email || (user?.id ? String(user.id) : 'anonymous'),
    author: user?.displayName || user?.email || 'Anonymous',
    text,
    files,
    score: 0,
    createdAt: new Date().toISOString()
  };

  await env.FEEDBACK.put(feedback.id, JSON.stringify(feedback));

  // per-user index
  const userKey = `user:${String(feedback.user).toLowerCase()}:feedbacks`;
  const existingIdsRaw = await env.FEEDBACK.get(userKey);
  let existingIds = [];
  try { existingIds = existingIdsRaw ? JSON.parse(existingIdsRaw) : []; } catch(e){ existingIds = []; }
  existingIds.push(feedback.id);
  await env.FEEDBACK.put(userKey, JSON.stringify(existingIds));

  // global index
  const allKey = `feedbacks:all`;
  const allRaw = await env.FEEDBACK.get(allKey);
  let allIds = [];
  try { allIds = allRaw ? JSON.parse(allRaw) : []; } catch(e){ allIds = []; }
  allIds.push(feedback.id);
  await env.FEEDBACK.put(allKey, JSON.stringify(allIds));
  try {
    await sendFeedbackCopyEmail(env, feedback);
  } catch (e) {
    console.warn("Feedback email failed:", e);
  }
  return json({ success:true, feedback }, 201);
}
async function handleFeedbackList(user, env) {
  const allKey = `feedbacks:all`;
  const allRaw = await env.FEEDBACK.get(allKey);
  let feedbacks = [];
  if (allRaw) {
    try {
      const ids = JSON.parse(allRaw);
      for (const id of ids) {
        const raw = await env.FEEDBACK.get(id);
        if (raw) {
          try { feedbacks.push(JSON.parse(raw)); } catch(e) { console.warn('parse fail', id, e); }
        }
      }
    } catch (e) {
      console.error('Failed to parse feedbacks:all', e);
    }
  }

  // newest-first
  feedbacks.sort((a,b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));

  // load per-user votes if user present
  let userVotes = {};
  if (user && (user.email || user.id)) {
    const userIdKey = String(user.email || user.id).toLowerCase();
    const votesKey = `user:${userIdKey}:votes`;
    const votesRaw = await env.FEEDBACK.get(votesKey);
    try { userVotes = votesRaw ? JSON.parse(votesRaw) : {}; } catch(e) { userVotes = {}; }
  }

  return json({ feedbacks, userVotes }, 200);
}
async function handleStoreInterest(request, user, env) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      body = {};
    }

    const email = String(body?.email || user?.email || "").trim().toLowerCase();
    if (!email) return json({ message: "Missing email" }, 400);

    const now = new Date().toISOString();

    const indexKey = "interest:index";
    let idxRaw = await env.USERS.get(indexKey);
    let index = [];

    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }

    // prevent duplicates
    if (index.includes(email)) {
      return json({ saved: true, alreadySaved: true, email }, 200);
    }

    index.push(email);
    await env.USERS.put(indexKey, JSON.stringify(index));

    return json({ saved: true, email, savedAt: now }, 201);

  } catch (err) {
    console.error("handleStoreInterest error:", err);
    return json({ message: err.message || "Failed to record interest" }, 500);
  }
}
async function handleFeedbackVote(request, user, env, id) {
  if (!user || !(user.email || user.id)) {
    return json({ message: 'Authentication required' }, 401);
  }
  let body;
  try { body = await request.json(); } catch(e) { body = {}; }
  const requested = Number(body.delta || 0);
  if (![ -1, 0, 1 ].includes(requested)) {
    return json({ message: 'Invalid delta' }, 400);
  }

  const fbRaw = await env.FEEDBACK.get(id);
  if (!fbRaw) return json({ message: 'Not found' }, 404);
  let fb;
  try { fb = JSON.parse(fbRaw); } catch(e){ return json({ message:'Failed to parse feedback' }, 500); }

  const userIdKey = String(user.email || user.id).toLowerCase();
  const votesKey = `user:${userIdKey}:votes`;
  const votesRaw = await env.FEEDBACK.get(votesKey);
  let votes = {};
  try { votes = votesRaw ? JSON.parse(votesRaw) : {}; } catch(e) { votes = {}; }

  const prevVote = Number(votes[id] || 0);

  // If requested equals prevVote, treat it as unvote (no change) — but we allow explicit 0 to unvote.
  let newVote = requested;
  if (requested === prevVote) {
    // toggling same value -> unvote (0)
    newVote = 0;
  }

  // Compute apply delta
  const applyDelta = newVote - prevVote; // could be -2, -1, 0, 1, 2

  // Update score
  fb.score = (Number(fb.score) || 0) + applyDelta;

  // Save feedback atomically
  await env.FEEDBACK.put(id, JSON.stringify(fb));

  // Update user votes map
  if (newVote === 0) {
    delete votes[id];
  } else {
    votes[id] = newVote;
  }
  await env.FEEDBACK.put(votesKey, JSON.stringify(votes));

  // Optionally return updated userVotes and score
  return json({ success: true, id, score: fb.score, userVotes: votes }, 200);
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
    const body = await request.json().catch(() => ({}));
    const email = (body && body.email) ? String(body.email).trim() : null;
    const username = (body && body.username) ? String(body.username).trim() : null;
    if (!email) return json({ message: "Missing email" }, 400);

    if (!env || typeof env.SESSIONS === "undefined") {
      const msg = "handleSessionCreate: env.SESSIONS is undefined";
      console.error(msg);
      return json({ message: msg }, 500);
    }

    // session TTL in seconds (env.SESSION_TTL) or default 30 days
    const ttlSeconds = parseInt(env.SESSION_TTL || String(30 * 24 * 60 * 60), 10);

    // create a secure token
    const token = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (String(Date.now()) + "-" + Math.random().toString(36).slice(2,10));

    const session = { email, username, provider: "oauth", created: Date.now() };

    // Store session with TTL in SESSIONS KV
    try {
      await env.SESSIONS.put(token, JSON.stringify(session), { expirationTtl: ttlSeconds });
    } catch (err) {
      console.error("handleSessionCreate: failed to write session to SESSIONS KV", err);
      return json({ message: "Failed to create session" }, 500);
    }

    // Set cookie attributes for cross-subdomain use
    // Use SameSite=None and Secure for cross-site / cross-subdomain contexts. Include Max-Age for clarity.
    const maxAge = ttlSeconds;
    const domain = env.COOKIE_DOMAIN || ".spectrodraw.com";
    const cookie = `session=${token}; Path=/; Domain=${domain}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;

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
async function checkProductDatabase(request,user,env){
  try {
    const body = await request.json().catch(() => ({email:""}));
    const email = String(body.email).trim().toLowerCase();
    const indexKey = 'products:index';
    let idxRaw = await env.USERS.get(indexKey);
    let index = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }
    return json({hasPro:index.includes(email)},201);
  } catch (err) {
    console.error('checkProductDatabase error:', err);
    return json({ message: err.message}, 500);
  }
}
async function handleMakePurchase(request, user, env) {
  try {
    const body = await request.json().catch(() => ({}));

    // Prefer the user sent by checkout/index.html
    let bodyUser = body?.user || null;
    if (typeof bodyUser === 'string') {
      try {
        bodyUser = JSON.parse(bodyUser);
      } catch {
        bodyUser = { email: bodyUser };
      }
    }

    const bodyEmail = String(bodyUser?.email || '').trim().toLowerCase();
    const authEmail = String(user?.email || '').trim().toLowerCase();

    // Use the request body account first, since that is the account the UI is on.
    const email = bodyEmail || authEmail;

    if (!email) return json({ message: 'Missing user email' }, 400);

    // Optional safety check: warn if cookie/session and body disagree
    if (bodyEmail && authEmail && bodyEmail !== authEmail) {
      console.warn('handleMakePurchase: auth mismatch', {
        bodyEmail,
        authEmail
      });
    }

    const now = new Date().toISOString();
    const claimKey = `product:${email}`;

    await env.USERS.put(
      claimKey,
      JSON.stringify({
        email,
        product: "SpectroDraw Pro",
        price: "$40.00",
        claimedAt: now
      })
    );

    const indexKey = 'products:index';
    let idxRaw = await env.USERS.get(indexKey);
    let index = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }
    if (!index.includes(email)) {
      index.push(email);
      await env.USERS.put(indexKey, JSON.stringify(index));
    }

    return json({ claimed: true, email, claimedAt: now }, 201);
  } catch (err) {
    console.error('handleMakePurchase error:', err);
    return json({ message: err.message || 'Failed to record claim' }, 500);
  }
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

    await env.USERS.put(claimKey, JSON.stringify({ email, product:"SpectroDraw Pro", price:"Free (early access deal)", claimedAt: now }));

    const indexKey = 'products:index';
    let idxRaw = await env.USERS.get(indexKey);
    let index = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw); } catch (e) { index = []; }
      if (!Array.isArray(index)) index = [];
    }
    if (!index.includes(email)) {
      index.push(email);
      await env.USERS.put(indexKey, JSON.stringify(index));
    }

    return json({ claimed: true, email, claimedAt: now }, 201);
  } catch (err) {
    console.error('handleClaimPost error:', err);
    return json({ message: err.message || 'Failed to record claim' }, 500);
  }
}

async function handleProductList(request, user, env) {
  try {
    if (!env || typeof env.USERS === "undefined") {
      return json({ message: "Server misconfigured: USERS KV not available" }, 500);
    }

    const listed = await env.USERS.list({ prefix: 'product:' });
    const products = [];

    for (const key of listed.keys) {
      try {
        const raw = await env.USERS.get(key.name);
        if (raw) {
          products.push(JSON.parse(raw));
        } else {
          const email = key.name.slice('product:'.length);
          products.push({ email, claimedAt: null });
        }
      } catch {
        const email = key.name.slice('product:'.length);
        products.push({ email, claimedAt: null });
      }
    }

    return json({ products }, 200);
  } catch (err) {
    console.error('handleProductList error:', err);
    return json({ message: err.message || 'Failed to list products' }, 500);
  }
}
async function handleSneakPeak(request, env) {
  try {
    const kvBindingName = "SNEAK_PEAK";
    const kv = env && env[kvBindingName];

    if (!kv || typeof kv.get !== "function") {
      console.error("SneakPeak: KV binding missing:", kvBindingName);
      return new Response("Server misconfigured", { status: 500 });
    }

    // Your key name in KV
    const key = "sneak-peak";

    const js = await kv.get(key, { type: "arrayBuffer" });

    if (!js) {
      console.warn("SneakPeak: key not found in KV:", key);
      return new Response("Sneak peak not available", { status: 404 });
    }

    return new Response(js, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "private, no-store, max-age=0"
      }
    });

  } catch (err) {
    console.error("SneakPeak error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
/* ---------- PayPal helpers & handlers ---------- */

async function getPayPalAccessToken(env) {
  // Use btoa to base64 encode client:secret
  const client = env.PAYPAL_CLIENT_ID || '';
  const secret = env.PAYPAL_LIVE_SECRET || '';
  if (!client || !secret) throw new Error('PayPal client id or secret not configured in env');

  const PAYPAL_API = 'https://api-m.paypal.com';
  const creds = btoa(`${client}:${secret}`);

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const jsonData = await res.json();
  if (!res.ok) {
    throw new Error('Failed to get PayPal access token' + JSON.stringify(jsonData));
  }
  return jsonData.access_token;
}

// Compute server-approved amount — DO NOT trust client amounts for production
function computeAmountFromBody(body, env) {
  // Recommended production approach: compute amount using server-side product catalog/DB.
  // Here we provide safeguards and simple patterns to avoid trusting client-sent amounts.
  // - If the request contains items array, you should calculate final amount from your own product prices.
  // - If env.PRICE_DEFAULT exists, use it.
  // - Otherwise, only allow client amount when ALLOW_UNVERIFIED_AMOUNTS === "true".
  if (!body || typeof body !== 'object') throw new Error('Invalid request body');

  // 1) If you provide a fixed default price in Worker env, use that.
  if (env && typeof env.PRICE_DEFAULT !== 'undefined') {
    const amt = String(env.PRICE_DEFAULT);
    if (!/^\d+(\.\d{1,2})?$/.test(amt)) throw new Error('Invalid PRICE_DEFAULT env format');
    return { amount: amt, currency: (body.currency || 'USD') };
  }

  // 2) If items array present — example logic (you must replace this with real product lookups)
  if (Array.isArray(body.items) && body.items.length) {
    // Example pattern: items = [{ id: 'sku-123', qty: 2 }]
    // Attempt to compute by reading env variables PRICE_<ID> or fail
    let total = 0;
    for (const item of body.items) {
      const id = String(item.id || '');
      const qty = parseInt(item.qty || 1, 10) || 1;
      const key = `PRICE_${id.toUpperCase().replace(/[^A-Z0-9_]/g,'_')}`;
      const unitPrice = env && typeof env[key] !== 'undefined' ? Number(String(env[key])) : NaN;
      if (isNaN(unitPrice)) {
        throw new Error(`Missing price for item ${id}. Set env var ${key} or use PRICE_DEFAULT`);
      }
      total += unitPrice * qty;
    }
    return { amount: total.toFixed(2), currency: (body.currency || 'USD') };
  }

  // 3) Allow client-sent amount only for dev/testing if explicitly allowed.
  const allow = String(env && env.ALLOW_UNVERIFIED_AMOUNTS || 'false').toLowerCase() === 'true';
  if (allow && body.amount) {
    const amt = String(body.amount);
    if (!/^\d+(\.\d{1,2})?$/.test(amt)) throw new Error('Invalid amount format');
    return { amount: amt, currency: (body.currency || 'USD') };
  }

  throw new Error('Unable to compute amount server-side. Set PRICE_DEFAULT or supply items and PRICE_<ID> env vars.');
}

async function createPayPalOrderOnPayPal(env, amount, currency='USD') {
  const token = await getPayPalAccessToken(env);
  const PAYPAL_API = 'https://api-m.paypal.com';

  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: currency, value: amount }
    }]
  };

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('create order error', res.status, data);
    throw new Error('Failed to create PayPal order');
  }
  return data;
}

async function capturePayPalOrderOnPayPal(env, orderID) {
  const token = await getPayPalAccessToken(env);
  const PAYPAL_API = 'https://api-m.paypal.com';

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('capture order error', res.status, data);
    throw new Error(`Failed to capture PayPal order: ${JSON.stringify(data)}`);
  }
  return data;
}
// POST /api/orders
async function handleApiOrdersCreate(request, env) {
  try {
    const body = await request.json().catch(() => ({}));

    // Accept client body with `cart: [{ id, quantity }]` or `items: [{ id, qty }]`.
    // Normalize to items array expected by computeAmountFromBody
    if (Array.isArray(body.cart) && !Array.isArray(body.items)) {
      body.items = body.cart.map(it => ({ id: String(it.id || ''), qty: parseInt(it.quantity || it.qty || 1, 10) || 1 }));
    }

    // compute server-approved amount (throws if not allowed / missing prices)
    const { amount, currency } = computeAmountFromBody(body, env);

    // create order on PayPal
    const order = await createPayPalOrderOnPayPal(env, amount, currency);

    // Return the full PayPal order object (client expects order.id)
    return json(order, 200);
  } catch (err) {
    console.error('handleApiOrdersCreate error', err);
    return json({ message: err.message || String(err) || 'Failed to create order' }, 500);
  }
}

// POST /api/orders/:orderID/capture
async function handleApiOrdersCapture(request, env, orderID) {
  try {
    if (!orderID) return json({ message: 'orderID required' }, 400);

    // capture on PayPal
    const capture = await capturePayPalOrderOnPayPal(env, orderID);

    // TODO: update DB, fulfill order, send email, etc. (best place for those)
    // Example (commented): await env.SESSIONS.put(`order:${capture.id}`, JSON.stringify({ capture, createdAt: Date.now() }));

    return json(capture, 200);
  } catch (err) {
    console.error('handleApiOrdersCapture error', err);
    return json({ message: err.message || String(err) || 'Failed to capture order' }, 500);
  }
}