const TF_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
self.addEventListener('message', async (ev) => {
  const msg = ev.data || {};
  if (msg && msg.type === 'preload') {
    const modelUrl = msg.modelUrl;
    const idbKey = msg.idbKey || 'basicpitch-v1';
    if (!modelUrl) {
      self.postMessage({ type: 'status', status: 'error', detail: 'no modelUrl supplied' });
      return;
    }
    try {
      if (typeof self.tf === 'undefined') {
        try {
          importScripts(TF_CDN);
        } catch (e) {
          self.postMessage({ type: 'status', status: 'error', detail: 'importScripts(tfjs) failed: ' + String(e) });
          return;
        }
      }
      if (typeof self.tf === 'undefined') {
        self.postMessage({ type: 'status', status: 'error', detail: 'tf not available after importScripts' });
        return;
      }
      try {
        const mdl = await self.tf.loadGraphModel('indexeddb://' + idbKey);
        self.postMessage({ type: 'status', status: 'already', detail: 'model already in indexeddb', idbKey });
        if (mdl && typeof mdl.dispose === 'function') mdl.dispose();
        return;
      } catch (eAlready) {
      }
      self.postMessage({ type: 'status', status: 'loading', detail: 'loading modelUrl ' + modelUrl });
      const graphModel = await self.tf.loadGraphModel(modelUrl);
      try {
        await graphModel.save('indexeddb://' + idbKey);
        self.postMessage({ type: 'status', status: 'saved', detail: 'model saved to indexeddb://' + idbKey, idbKey });
      } catch (saveErr) {
        self.postMessage({ type: 'status', status: 'error', detail: 'save to indexeddb failed: ' + String(saveErr) });
      } finally {
        if (graphModel && typeof graphModel.dispose === 'function') graphModel.dispose();
      }
    } catch (err) {
      self.postMessage({ type: 'status', status: 'error', detail: String(err && err.message ? err.message : err) });
    }
  }
});