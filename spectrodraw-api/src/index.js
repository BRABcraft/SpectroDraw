export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Helper for JSON responses
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    // Helper for CORS (if used from local dev)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
      });
    }

    // Very simple mock auth
    const user = parseAuth(request);
    if (pathname.startsWith("/api/") && !user) {
      return json({ message: "Unauthorized" }, 401);
    }

    // Routes
    if (pathname === "/api/reviews" && request.method === "POST") {
      return handleReviewPost(request, user, env);
    }

    if (pathname === "/api/share/invite" && request.method === "POST") {
      return handleShareInvite(request, user, env);
    }

    if (pathname === "/api/reviews" && request.method === "GET") {
      return handleReviewList(user, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

/* --------------------------- Mock Database ---------------------------- */
// You can replace these with D1 or KV later
const reviews = [];
const invites = [];

/* ----------------------------- Utilities ----------------------------- */

function parseAuth(request) {
  // In a real setup, you'd verify a session cookie or JWT.
  // For now, treat any cookie "user_email" as authenticated.
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/user_email=([^;]+)/);
  if (!match) return null;
  return { email: decodeURIComponent(match[1]) };
}

/* ----------------------------- Handlers ------------------------------ */

async function handleReviewPost(request, user, env) {
  try {
    const form = await request.formData();
    const rating = parseInt(form.get("rating"), 10);
    const text = (form.get("text") || "").toString().trim();

    if (!rating || rating < 1 || rating > 5)
      return json({ message: "Invalid rating" }, 400);

    // Optional image handling
    let imageBase64 = null;
    const imageFile = form.get("image");
    if (imageFile && imageFile.name && imageFile.arrayBuffer) {
      const buf = await imageFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const b64 = btoa(String.fromCharCode(...bytes));
      const mime = imageFile.type || "image/png";
      imageBase64 = `data:${mime};base64,${b64}`;
    }

    const review = {
      id: crypto.randomUUID(),
      user: user.email,
      rating,
      text,
      image: imageBase64,
      createdAt: new Date().toISOString(),
    };
    reviews.push(review);

    return json({ success: true, review });
  } catch (err) {
    return json({ message: err.message || "Error saving review" }, 500);
  }
}

async function handleShareInvite(request, user, env) {
  try {
    const { email } = await request.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return json({ message: "Invalid email" }, 400);

    const invite = {
      id: crypto.randomUUID(),
      from: user.email,
      to: email,
      sentAt: new Date().toISOString(),
    };
    invites.push(invite);

    // In a real app: send email via MailChannels, Resend, or SendGrid here.

    return json({ sent: true, invite });
  } catch (err) {
    return json({ message: err.message || "Failed to send invite" }, 500);
  }
}

async function handleReviewList(user, env) {
  // Return all reviews for the logged-in user
  const userReviews = reviews.filter((r) => r.user === user.email);
  return new Response(JSON.stringify({ reviews: userReviews }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
