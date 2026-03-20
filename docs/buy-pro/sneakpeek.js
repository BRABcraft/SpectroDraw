const openSneakBtn = document.getElementById("sneakPeekButton");
const inlineSneak = document.getElementById("inlineSneak");
const inlineSneakDiv = document.getElementById("inlineSneakDiv");
let sneakOpened = false;
let hasLoadedPro = false;

openSneakBtn.addEventListener("click", () => {
  sneakOpened = !sneakOpened;
  document.getElementById("OR").innerHTML = sneakOpened ? "<br>" : "OR";
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
    document.getElementById("checkout")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
});
document.getElementById("openInNewTab").addEventListener("click",()=>{window.open("./sneakpeek.html", "_blank");});