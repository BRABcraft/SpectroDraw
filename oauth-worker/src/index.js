export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Capture the 'state' param
    const state = url.searchParams.get("state");

    if (url.pathname === "/login" || url.pathname === "/login/") {
      const redirect_uri = `${url.origin}/callback`;
      const client_id = env.GOOGLE_CLIENT_ID;
      const scope = "openid email profile";

      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("client_id", client_id);
      googleAuthUrl.searchParams.set("redirect_uri", redirect_uri);
      googleAuthUrl.searchParams.set("scope", scope);
      googleAuthUrl.searchParams.set("prompt", "select_account"); // always show account chooser
      if (state) googleAuthUrl.searchParams.set("state", state); // Forward the state

      return Response.redirect(googleAuthUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      // Handle user cancel: redirect back to Google account chooser
      if (!code) {
        const redirect_uri = `${url.origin}/callback`;
        const client_id = env.GOOGLE_CLIENT_ID;
        const scope = "openid email profile";

        const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        googleAuthUrl.searchParams.set("response_type", "code");
        googleAuthUrl.searchParams.set("client_id", client_id);
        googleAuthUrl.searchParams.set("redirect_uri", redirect_uri);
        googleAuthUrl.searchParams.set("scope", scope);
        googleAuthUrl.searchParams.set("prompt", "select_account");
        if (state) googleAuthUrl.searchParams.set("state", state);

        return Response.redirect(googleAuthUrl.toString(), 302);
      }

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

      // Fetch user info
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Return small HTML page to notify parent and redirect back to original URL
      const html = `
        <html>
          <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:60px;">
            <script>
              (function() {
                const user = ${JSON.stringify(userInfo)};
                const returnTo = ${state ? JSON.stringify(decodeURIComponent(state)) : "null"};
                if (window.opener) {
                  window.opener.postMessage({ type: 'oauth-success', user, returnTo }, '*');
                  window.close();
                } else if (returnTo) {
                  window.location.href = returnTo;
                } else {
                  window.location.href = 'https://spectrodraw.com';
                }
              })();
            </script>
            <p>You can close this window.</p>
          </body>
        </html>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Welcome to your OAuth worker!");
  },
};