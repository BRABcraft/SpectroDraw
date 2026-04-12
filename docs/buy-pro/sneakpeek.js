const openSneakBtn = document.getElementById("sneakPeekButton");
const inlineSneak = document.getElementById("inlineSneak");
let sneakOpened = false;
let hasLoadedPro = false;

openSneakBtn.addEventListener("click", () => {
  sneakOpened = !sneakOpened;
  openSneakBtn.style.display = sneakOpened ? "none" : "flex";
  inlineSneakDiv.style.display = sneakOpened ? "block" : "none";

  if (!hasLoadedPro && sneakOpened) loadPro();
});

async function loadPro() {
  if (window.__spectrodraw_pro_loading) return;
  window.__spectrodraw_pro_loading = true;

  // create and show loader container
  const loaderContainer = document.createElement("div");
  loaderContainer.className = "loader-container";
  loaderContainer.innerHTML = `
    <span>Loading SpectroDraw Pro, please wait...</span>
    <div class="loader"></div>
  `;
  inlineSneak.appendChild(loaderContainer);

  const KV_URL = 'https://api.spectrodraw.com/load-sneak-peak';

  // helper to cleanup
  let cleaned = false;
  function cleanup(success) {
    if (cleaned) return;
    cleaned = true;
    try { loaderContainer.remove(); } catch(e){}
    window.__spectrodraw_pro_loading = false;
    if (success) hasLoadedPro = true;
    // remove event listener
    try { window.removeEventListener('spectrodraw-pro-ready', onReady); } catch(e){}
  }

  // event handler when bootstrap indicates iframe loaded
  function onReady(ev) {
    console.log('spectrodraw-pro-ready', ev && ev.detail);
    cleanup(true);
  }

  // fallback in case load event never fires
  const readyTimeout = setTimeout(() => {
    console.warn('sneak-peak ready timeout — cleaning up anyway');
    cleanup(true); // still mark as loaded to avoid repeated tries, or set false if you prefer
  }, 15000); // 15s

  window.addEventListener('spectrodraw-pro-ready', onReady, { once: true });

  try {
    const res = await fetch(KV_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('KV fetch failed: ' + res.status);

    // IMPORTANT: read as arrayBuffer (preserve bytes)
    const arr = await res.arrayBuffer();
    const blob = new Blob([arr], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    const scriptEl = document.createElement('script');
    scriptEl.src = blobUrl;
    scriptEl.onload = () => {
      // bootstrap loaded in parent; do not cleanup here — wait for 'spectrodraw-pro-ready'
      URL.revokeObjectURL(blobUrl);
      console.log('bootstrap script loaded; waiting for iframe ready event...');
    };
    scriptEl.onerror = (e) => {
      console.error('Error executing fetched bundle', e);
      URL.revokeObjectURL(blobUrl);
      clearTimeout(readyTimeout);
      cleanup(false);
    };
    document.head.appendChild(scriptEl);
  } catch (err) {
    console.error('loadPro error:', err);
    clearTimeout(readyTimeout);
    cleanup(false);
  }
}
window.addEventListener("keydown", function(e) {
  if (
    e.code === "Space" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) &&
    !document.activeElement.isContentEditable
  ) {
    e.preventDefault();
  }
});
window.addEventListener('message', function (ev) {
  const msg = ev && ev.data;
  if (msg && msg.type === 'spectrodraw:continueToCheckout') {
    gtag("event","continuetocheckout_frominlinesneakpeek");
    window.open("./checkout/", "_blank");
  }
});
window.addEventListener("message", function (ev) {
  if (ev.data?.type === "spectrodraw:mousedown") {
    console.log("a");
    gtag("event","prosneakpeek_mousedown");
  }
});
document.getElementById("openInNewTab").addEventListener("click",()=>{window.open("./sneakpeek.html", "_blank");});
window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "spectrodraw-upgrade-intent") return;

  const reason = event.data.reason;

  showUpgradeModal(reason);
});

// ==============================
// UPGRADE MODAL (HIGH CONVERSION)
// ==============================

function showUpgradeModal(reason) {
  let modal = document.getElementById("upgradeModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "upgradeModal";

    Object.assign(modal.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999999
    });

    modal.innerHTML = `
      <div style="
        background:#0f1720;
        padding:28px;
        border-radius:16px;
        max-width:420px;
        width:90%;
        text-align:center;
        border:1px solid rgba(255,255,255,0.08);
      ">
        <h2 style="margin-top:0;">Unlock SpectroDraw Pro</h2>
        <p style="color:#cfd8e7;">
          Export your work, remove watermark, and access full features.
        </p>

        <button id="upgradeBtn" style="
          margin-top:16px;
          padding:12px 16px;
          border:none;
          border-radius:10px;
          background:linear-gradient(90deg,#4f46e5,#9333ea,#ec4899);
          color:white;
          font-weight:800;
          cursor:pointer;
        ">
          Upgrade Now
        </button>

        <div style="margin-top:10px;">
          <button id="closeUpgrade" style="
            background:none;
            border:none;
            color:#9aa4b2;
            cursor:pointer;
          ">Maybe later</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("upgradeBtn").onclick = () => {
      // 🔥 Hook this to your checkout
      window.location.href = "/pricing";
    };

    document.getElementById("closeUpgrade").onclick = () => {
      modal.remove();
    };
  }
}