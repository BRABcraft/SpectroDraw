export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      const redirect_uri = `${url.origin}/callback`;
      const client_id = env.GOOGLE_CLIENT_ID;
      const scope = "openid email profile";
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}`;
      return Response.redirect(googleAuthUrl, 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing authorization code", { status: 400 });

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      // Extract user info
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Redirect back to your app with user data (encoded)
      const redirectTo = `https://spectrodraw.com?user=${encodeURIComponent(JSON.stringify(userInfo))}`;
      return Response.redirect(redirectTo, 302);
    }

    return new Response("Welcome to your OAuth worker!");
  },
};
