// ---------- brush preview helpers (paste once near the top of brushPreview.js) ----------
const __brushPreviewImageCache = {}; // cache name -> HTMLImageElement
const __brushPreviewCanvasCache = {}; // cache name -> offscreen canvas for processed (hue-shifted) image

// Map phaseTextureEl.value (normalized) -> candidate file names in brushPreviewData
const __phaseTextureToNames = {
  static: ["static.png"],
  harmonics: ["harmonics.png"],
  flat: null, // Existing method
  impulsealign: null, // Existing method
  framealignedimpulse: ["expectedAdvance.png"],
  expectedadvance: ["expectedAdvance.png"],
  phasepropagate: ["phasePropagate.png"],
  randomsmall: ["randomSmall.png"],
  harmonicstack: ["harmonics.png"],
  lineardelay: ["linearDelay.png"],
  chirp: ["chirp.png"],
  copyfromref: null, // Existing method
  hopartifact: ["hopArtifact.png"]
};

function __findDataUrlForTexture(textureVal){
  if(!textureVal) return null;
  const key = String(textureVal).toLowerCase();
  const candidates = __phaseTextureToNames[key];
  if(!candidates) return null; // "Existing method" or not mapped
  for(const c of candidates){
    const entry = brushPreviewData.find(b => b.name === c || b.name === c.replace(/\s+/g,''));
    if(entry && entry.dataUrl) return {name: entry.name, dataUrl: entry.dataUrl};
  }
  // try fallback: exact match on name == textureVal + ".png"
  const fallbackName = textureVal + ".png";
  const fallback = brushPreviewData.find(b => b.name === fallbackName);
  if(fallback) return {name: fallback.name, dataUrl: fallback.dataUrl};
  return null;
}

// simple rgb <-> hsl converters (0..255 rgb, h:0..360 s,l:0..1)
function __rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if(max === min){
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max){
      case r: h = ((g - b) / d) + (g < b ? 6 : 0); break;
      case g: h = ((b - r) / d) + 2; break;
      case b: h = ((r - g) / d) + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}
function __hslToRgb(h, s, l){
  h = ((h % 360) + 360) % 360;
  let r, g, b;
  if(s === 0){
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = h / 360;
    r = hue2rgb(p, q, hk + 1/3);
    g = hue2rgb(p, q, hk);
    b = hue2rgb(p, q, hk - 1/3);
  }
  let ret = [r,g,b];
  for (let i = 0; i < 3; i++) ret[i] = Math.round(Math.min(ret[i]*(currentTool==="amplifier"?amp:1),1)*255);
  return ret;
}

// Given a dataUrl string, produce a processed canvas with hue shifted by hueDegrees.
// Caches processed canvases keyed by (name + hueDegrees rounded).
function __getHueShiftedCanvas(name, dataUrl, hueDegrees, callback){
  const cacheKey = `${name}::${Math.round(hueDegrees)}::${amp}`;
  if(__brushPreviewCanvasCache[cacheKey]){
    // return cached canvas async-like via callback for consistent interface
    callback(__brushPreviewCanvasCache[cacheKey]);
    return;
  }

  // ensure we have an HTMLImageElement cached
  let img = __brushPreviewImageCache[name];
  if(img && img.complete){
    if (!img || img.width <= 0 || img.height <= 0) {callback(null);return;}
    // process immediately
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img,0,0);
    try {
      const id = ctx.getImageData(0,0,c.width,c.height);
      const d = id.data;
      for(let i=0;i<d.length;i+=4){
        const r = d[i], g = d[i+1], b = d[i+2];
        const hsl = __rgbToHsl(r,g,b);
        const newH = (hsl[0] + hueDegrees) % 360;
        const rgb = __hslToRgb(newH, hsl[1], hsl[2]);
        d[i] = rgb[0]; d[i+1] = rgb[1]; d[i+2] = rgb[2];
      }
      ctx.putImageData(id,0,0);
      __brushPreviewCanvasCache[cacheKey] = c;
      callback(c);
    } catch(e){
      // security / tainted canvas; fallback - just return image drawn to canvas without pixel ops
      callback(c);
    }
    return;
  }

  // If image not loaded or not cached, create and load
  img = new Image();
  img.onload = () => {
    __brushPreviewImageCache[name] = img;
    if (!img || img.width <= 0 || img.height <= 0) {callback(null);return;}
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img,0,0);
    try {
      const id = ctx.getImageData(0,0,c.width,c.height);
      const d = id.data;
      for(let i=0;i<d.length;i+=4){
        const r = d[i], g = d[i+1], b = d[i+2];
        const hsl = __rgbToHsl(r,g,b);
        const newH = (hsl[0] + hueDegrees) % 360;
        const rgb = __hslToRgb(newH, hsl[1], hsl[2]);
        d[i] = rgb[0]; d[i+1] = rgb[1]; d[i+2] = rgb[2];
      }
      ctx.putImageData(id,0,0);
      __brushPreviewCanvasCache[cacheKey] = c;
      callback(c);
    } catch(e){
      // security / tainted canvas; fallback - return canvas with original image
      callback(c);
    }
  };
  img.onerror = () => {
    // couldn't load; callback null
    callback(null);
  };
  img.src = dataUrl;
}




let prevBrushDims = [10,10,10];
function updateBrushWH() {
  const bw = document.getElementById("brushWidth");
  const bh = document.getElementById("brushHeight");
  const bs = document.getElementById("brushSize");
  const bw1 = document.getElementById("brushWidthInput");
  const bh1 = document.getElementById("brushHeightInput");
  const bs1 = document.getElementById("brushSizeInput");
  if (currentShape === 'image') {
    const iw = images[selectedImage].img.width;
    const ih = images[selectedImage].img.height;
    bw.max = bw1.max = iw*4;
    bh.max = bh1.max = ih*4;
    bs.max = bs1.max = Math.max(iw, ih)*4;
    prevBrushDims = [brushSize, brushWidth, brushHeight];
    bw.value = bw1.value = brushWidth = iw;
    bh.value = bh1.value = brushHeight = ih;
    bs.value = bs1.value = brushSize = Math.max(iw, ih);
  } else if (currentShape === 'stamp') {
    prevBrushDims = [brushSize, brushWidth, brushHeight];
    bw.value = bw1.value = brushWidth = 10;
    bh.value = bh1.value = brushHeight = 100;
    bs.value = bs1.value = brushSize = 100;
  } else {
    bw.max = bh.max = bs.max = bw1.max = bh1.max = bs1.max = 200;
    bs.value = bs1.value = brushSize = prevBrushDims[0];
    bw.value = bw1.value = brushWidth = prevBrushDims[1];
    bh.value = bh1.value = brushHeight = prevBrushDims[2];
  }
}
// ---------- Replace your existing updateBrushPreview function with this ----------
function updateBrushPreview() {
  if (currentShape !== 'image' && currentShape !== 'stamp') prevBrushDims = [brushSize, brushWidth, brushHeight];
  const preview = document.getElementById("strokePreview");
  const pctx = preview.getContext("2d");
  pctx.clearRect(0, 0, preview.width, preview.height);

  const centerX = preview.width / 2;
  const centerY = preview.height / 2;
  const radius = brushSize / 2;
  function th(num) {
    let hex = num.toString(16);
    if (hex.length === 1) {
      hex = '0' + hex;
    }
    return hex;
  }
  function adjustSaturation([r,g,b], factor){
    let avg = Math.max(r,g,b);
    return [r,g,b].map(v => Math.round(avg + (v-avg)*factor));
  }
  let rgb;
  if (currentTool === "amplifier") {
    rgb = adjustSaturation(magPhaseToRGB((amp*25) * brushOpacity, phaseShift),phaseStrength);
  } else if (currentTool === "noiseRemover") {
    rgb = adjustSaturation(magPhaseToRGB(brushOpacity*60, 0),0);
  } else {
    rgb = adjustSaturation(magPhaseToRGB((brushBrightness / 5) * brushOpacity, phaseShift),phaseStrength);
  }

  const color = currentTool === "eraser" ? "#000" : "#"+th(rgb[0])+th(rgb[1])+th(rgb[2]);

  // Helper: compute hue shift degrees from phaseShift (map cycles -> degrees)
  // phaseShift may be in radians or cycles; we'll normalize by 2pi.
  const hueShiftDeg = ( (phaseShift % (Math.PI*2)) / (Math.PI*2) ) * 360;

  // Helper: attempt to get a dataUrl for current phase texture value
  let textureData = null;
  try {
    const texVal = phaseTextureEl.value;
    textureData = __findDataUrlForTexture(texVal);
  } catch (e) {
    textureData = null;
  }

  // Decide whether to use image method or "Existing method" fallback:
  const useImageMethod = !!textureData && (currentTool !== "noiseRemover" && currentTool !== "autotune"); // if textureData is null => existing/simple method

  // If useImageMethod is true and we are in a shape that can use masks, draw image with mask + hue-shift
  const shapeUsesImageMask = (currentShape === "brush" || currentShape === "rectangle" || currentShape === "image" || currentShape === "stamp" || currentShape === "line");

  // For tools that explicitly used the old special drawing behavior, handle these first:
  if (currentShape === "line" && !useImageMethod) {
    // original line logic (existing method)
    if (currentTool === "blur") {
      pctx.save();
      const grad = pctx.createLinearGradient(centerX + blurRadius, centerY + blurRadius, centerX - blurRadius, centerY - blurRadius);
      grad.addColorStop(0, '#000');
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, '#000');
      pctx.strokeStyle = grad;
      pctx.lineWidth = brushSize;
      pctx.shadowColor = grad;
      pctx.shadowBlur = brushSize / 2;
    } else {
      pctx.strokeStyle = color;
      pctx.lineWidth = brushSize/4;
    }
    pctx.beginPath();
    pctx.moveTo(centerX - 20 , centerY + 20);
    pctx.lineTo(centerX + 20, centerY - 20);
    pctx.stroke();
    pctx.restore();
    return;
  }

  if (currentTool === "eraser") {
    // keep existing eraser preview style
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 1;
    pctx.beginPath();
    if (currentShape === "rectangle" || currentShape === "image") {
      pctx.strokeRect(centerX - 30, centerY - 30, 60, 60);
    } else {
      pctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    }
    pctx.stroke();
    return;
  }

  if (currentTool === "blur" && !useImageMethod) {
    // existing blur method
    let gradient = pctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius*(1.5));
    gradient.addColorStop(1-blurRadius/10, 'white');  // center
    gradient.addColorStop(1, 'black');  // edge
    pctx.fillStyle = gradient;
    pctx.lineWidth = 2;
    pctx.beginPath();
    if (currentShape === "rectangle" || currentShape === "image" || currentShape === "stamp") {
      pctx.save(); // Save current context state
      pctx.fillStyle = "white";       // Rectangle color
      pctx.shadowColor = "white";     // Feather color
      pctx.shadowBlur = blurRadius*5; // How soft the edges are
      pctx.shadowOffsetX = 0;
      pctx.shadowOffsetY = 0;
      pctx.fillRect(centerX - 30, centerY - 30, 60, 60);
      pctx.restore();
    } else {
      pctx.arc(centerX, centerY, radius*1.5 - 1, 0, Math.PI * 2);
      pctx.fill();
    }
    return;
  }

  if (currentTool === "amplifier" && !useImageMethod) {
    pctx.font = "12px Arial";
    pctx.fillStyle = "#fff";
    pctx.fillText((amp * brushOpacity).toFixed(1)+"x", centerX-10, centerY+5);
    pctx.strokeStyle = color;
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    pctx.stroke();
    return;
  }

  // Special shapes that had big custom code (note, cloner) are left as original behavior:
  if (currentShape === "note" && !(currentTool==="cloner"&&changingClonerPos)) {
    // keep original note code (unchanged)
    // ... (we'll reuse your original 'note' block)
    // We'll copy-paste original note code here to preserve behavior:
    const count = 100;
    const baseH = 5;
    const baseW = 200;
    const k = 0.06; // slightly stronger than minimum
    let totalHeight = 0;
    const scales = new Array(count);

    for (let i = 0; i < count; ++i) {
      const scale = Math.exp(-k * i);
      scales[i] = scale;
      totalHeight += baseH * scale;
    }

    let curY = centerY + totalHeight / 2;

    pctx.save();
    pctx.imageSmoothingEnabled = false;
    pctx.lineCap = "round";
    pctx.lineJoin = "round";

    for (let i = 0; i < count; ++i) {
      const s = scales[i];
      const w = Math.max(1, Math.round(baseW));
      const h = Math.max(1, baseH * s);
      const halfH = h / 2;
      const yCenter = curY + h / 2;
      const x0 = Math.round(centerX - w / 2);
      const v = harmonics[i];

      pctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = px / w;
        const y = yCenter + Math.sin(2 * Math.PI * t) * halfH;
        if (px === 0) pctx.moveTo(x0 + px + 0.5, y + 0.5);
        else pctx.lineTo(x0 + px + 0.5, y + 0.5);
      }

      pctx.strokeStyle = `rgba(${rgb[0]*v},${rgb[1]*v},${rgb[2]*v},255)`;
      pctx.lineWidth = 1;
      pctx.stroke();

      curY -= h;
    }

    pctx.restore();
    return;
  }

  if (currentTool === "cloner") {
    if (changingClonerPos) {
      pctx.font = "12px Arial";
      pctx.fillStyle = "#fff";
      pctx.textAlign = "center";
      pctx.fillText("No reference point set", centerX, centerY + 4);
    } else {
      // Determine source canvas (prefer visible layer canvas)
      let srcCanvas = document.getElementById("canvas-" + clonerCh);
      if (!srcCanvas) {
        pctx.font = "12px Arial";
        pctx.fillStyle = "#fff";
        pctx.textAlign = "center";
        pctx.fillText("Source canvas missing", centerX, centerY + 4);
        return;
      }
      if (srcCanvas.width <= 0 || srcCanvas.height <= 0) {
        return;
      }


      // compute pixels-per-unit for source canvas (same approach as previewShape())
      const srcRect = srcCanvas.getBoundingClientRect();
      const pixelsPerFrame = srcRect.width  / Math.max(1, srcCanvas.width); // screen px per canvas-x unit
      const pixelsPerBin   = srcRect.height / Math.max(1, srcCanvas.height); // screen px per canvas-y unit

      // 'screen' brush dimensions (what brushWidth/Height represent on the UI)
      const screenW = (currentShape==="rectangle")?(100):Math.max(1, brushWidth);
      const screenH = (currentShape==="rectangle")?(100):Math.max(1, brushHeight);

      // Convert screen-space brush dims to source-canvas units to determine sample rectangle (UV-style)
      const scale = clonerScale;
      const srcW = Math.max(1, Math.round((screenW / pixelsPerFrame) / scale)); // in source canvas X units
      const srcH = Math.max(1, Math.round((screenH / pixelsPerBin) / scale));   // in source canvas Y units

      // source top-left (centered at clonerX/clonerY in source canvas coordinates)
      const sx = (currentShape==="rectangle")?clonerX:Math.round((clonerX + (painting ? (($x - startX)/clonerScale) : 0)) - srcW / 2);
      const sy = (currentShape==="rectangle")?clonerY:Math.round((clonerY + (painting ? (($y - startY)/clonerScale) : 0)) - srcH / 2);

      // normalize with wrap (mod)
      const mod = (n, m) => ((n % m) + m) % m;
      const sx0 = mod(sx, srcCanvas.width);
      const sy0 = mod(sy, srcCanvas.height);

      // create temporary canvas sized to the sampled region (in source-canvas units)
      const tmp = document.createElement('canvas');
      tmp.width = srcW;
      tmp.height = srcH;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false;

      try {
        // Tile the source into tmp with wrap behavior.
        // We iterate over vertical tiles (chunk by chunk) then horizontal tiles to fill srcW x srcH.
        let remainingH = srcH;
        let destY = 0;
        let readY = sy0;

        while (remainingH > 0) {
          const chunkH = Math.min(srcCanvas.height - readY, remainingH);
          let remainingW = srcW;
          let destX = 0;
          let readX = sx0;

          while (remainingW > 0) {
            const chunkW = Math.min(srcCanvas.width - readX, remainingW);

            // draw that chunk from source -> tmp at destX/destY
            tctx.drawImage(
              srcCanvas,
              readX, readY,               // source x,y
              chunkW, chunkH,             // source w,h
              destX, destY,               // dest x,y on tmp
              chunkW, chunkH              // dest w,h on tmp
            );

            remainingW -= chunkW;
            destX += chunkW;
            readX = 0; // after the first draw, further tiles start at x=0 (wrapped)
          }

          remainingH -= chunkH;
          destY += chunkH;
          readY = 0; // after first vertical tile, further tiles start at y=0 (wrapped)
        }

        // apply brightness/opacity if requested (on the tiled tmp)
        if (cAmp !== 1 || brushOpacity !== 1) {
          const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
          const data = imgData.data;
          const alphaVal = Math.floor(255 * brushOpacity);
          for (let i = 0; i < data.length; i += 4) {
            data[i]     = Math.min(255, data[i]     * cAmp); // R
            data[i + 1] = Math.min(255, data[i + 1] * cAmp); // G
            data[i + 2] = Math.min(255, data[i + 2] * cAmp); // B
            data[i + 3] = alphaVal;
          }
          tctx.putImageData(imgData, 0, 0);
        }
      } catch (e) {
        pctx.font = "12px Arial";
        pctx.fillStyle = "#fff";
        pctx.textAlign = "center";
        pctx.fillText("Unable to sample source", centerX, centerY + 4);
        return;
      }

      pctx.imageSmoothingEnabled = false;

      // destination on preview: keep same visual size (UV-style behaviour)
      const destW = Math.max(1, Math.round(srcW * pixelsPerFrame * scale));
      const destH = Math.max(1, Math.round(srcH * pixelsPerBin * scale));

      const dx = Math.round(centerX - destW / 2);
      const dy = Math.round(centerY - destH / 2);

      if (currentShape === "brush") {
        // ellipse mask: clip to an ellipse then draw scaled tmp
        pctx.save();
        pctx.beginPath();
        const rx = Math.max(0.5, destW / 2);
        const ry = Math.max(0.5, destH / 2);
        pctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
        pctx.closePath();
        pctx.clip();

        if (tmp.width>0 && tmp.height>0) pctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, dx, dy, destW, destH);

        pctx.restore();

        // stroke ellipse outline for clarity
        pctx.strokeStyle = "rgba(255,255,255,0.9)";
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.ellipse(centerX, centerY, rx - 0.5, ry - 0.5, 0, 0, Math.PI * 2);
        pctx.stroke();
      } else {
        // rectangular preview: draw scaled sampled region
        pctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, dx, dy, destW, destH);

        // stroke rectangle outline
        pctx.strokeStyle = "rgba(255,255,255,0.9)";
        pctx.lineWidth = 1;
        pctx.strokeRect(dx + 0.5, dy + 0.5, destW - 1, destH - 1);
      }
    }
    return;
  }
  // If we have an image for the current texture AND the shape supports masking, draw the image (hue-shifted) masked to the shape:
  if (useImageMethod && shapeUsesImageMask) {
    const {name, dataUrl} = textureData;
    // Request (async) the processed canvas with hue shift. Once available, draw masked to the UI preview.
    __getHueShiftedCanvas(name, dataUrl, hueShiftDeg, (imgCanvas) => {
      if(!imgCanvas || !imgCanvas.width || !imgCanvas.height){
        // failed to create processed canvas -> fallback to simple fill
        if (currentShape === "rectangle" || currentShape === "image" || currentShape === "stamp") {
          pctx.fillStyle = color;
          pctx.fillRect(centerX - 30, centerY - 30, 60, 60);
        } else {
          pctx.fillStyle = color;
          pctx.beginPath();
          pctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          pctx.fill();
        }
        return;
      }

      // compute draw destination size for preview (preserve previous UI behavior)
      let destW = Math.max(1, Math.round((currentShape === "rectangle") ? 100 : Math.max(1, brushWidth)));
      let destH = Math.max(1, Math.round((currentShape === "rectangle") ? 100 : Math.max(1, brushHeight)));
      // center it
      const dx = Math.round(centerX - destW / 2);
      const dy = Math.round(centerY - destH / 2);

      pctx.save();
      pctx.imageSmoothingEnabled = false;
      // create mask path according to shape — centered in the fixed image box
      if (currentShape === "stamp") {
        if (currentStamp) {
          const img = new Image();
          img.onload = () => {
            if (!img.width || !img.height) {
              return;
            }
            // create offscreen mask canvas sized to the stamp preview
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = destW;
            maskCanvas.height = destH;
            const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
            mctx.imageSmoothingEnabled = false;
            // draw the stamp into the mask canvas (this writes its alpha)
            mctx.clearRect(0, 0, destW, destH);
            mctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, destW, destH);

            // now keep only the stamp-shaped area and draw the processed image into it
            mctx.globalCompositeOperation = 'source-in';
            // draw processed imgCanvas scaled to stamp size
            // use imgCanvas.width/height so this works regardless of source size
            mctx.drawImage(imgCanvas, 0, 0, 300, 100, 0, 0, destW, destH*3);
            mctx.globalCompositeOperation = 'source-over'; // restore default

            // draw the composed mask (stamp-shape filled with processed image) onto preview
            pctx.drawImage(maskCanvas, dx, dy, destW, destH);

            pctx.restore();
          };
          img.src = currentStamp.dataUrl;
        } else {
          pctx.font = "12px Arial";
          pctx.fillStyle = "#fff";
          pctx.fillText("No stamp loaded", centerX - 45, centerY + 5);
          pctx.restore();
        }
        return; // handled stamp drawing; don't run the generic clipping/draw code below
      }
      pctx.beginPath();
      if (currentShape === "brush") {
        // circular/ellipse mask centered in the image box
        const rx = Math.max(0.5, destW / 2);
        const ry = Math.max(0.5, destH / 2);
        pctx.ellipse(150, 50, rx, ry, 0, 0, Math.PI * 2);
      } else if (currentShape === "line") {
        // diagonal thin rectangle mask centered in the image box
        const w = 100;
        const h = brushSize/4; // thin-ish line
        pctx.translate(150, 50);
        pctx.rotate(-Math.PI/4);
        pctx.rect(-w/2, -h/2, w, h);
        pctx.rotate(Math.PI/4);
        pctx.translate(-150, -50);
      } else {
        // rectangle/image/stamp: rectangular mask equals the fixed box
        pctx.rect(dx, dy, destW, destH);
      }
      pctx.closePath();
      pctx.clip();


      // draw processed (hue-shifted) image canvas into clipped region, scale to dest
      pctx.drawImage(imgCanvas, 0, 0, 300, 100, 0, 0, 300, 240);
      pctx.restore();

      // stroke outline for clarity
      pctx.strokeStyle = "rgba(255,255,255,0.9)";
      pctx.lineWidth = 1;
      if (currentShape === "brush") {
        pctx.beginPath();
        const rx = Math.max(0.5, destW / 2);
        const ry = Math.max(0.5, destH / 2);
        pctx.ellipse(centerX, centerY, rx - 0.5, ry - 0.5, 0, 0, Math.PI * 2);
        pctx.stroke();
      } else if (currentShape === "line") {
        return;
      } else {
        pctx.strokeRect(dx + 0.5, dy + 0.5, destW - 1, destH - 1);
      }
    });
    return;
  }

  // If we reached here: either no image method or shape doesn't support it -> fall back to original simple shapes

  if (currentShape === "image") {
    // Draw image stretched to brushWidth x brushHeight (no aspect preservation) - original behavior
    if (images[selectedImage] && images[selectedImage].img && images[selectedImage].img.complete) {
      const srcImg = images[selectedImage].img;
      if (!srcImg.width || !srcImg.height) {
        return;
      }
      const dx = centerX - brushWidth / 2;
      const dy = centerY - brushHeight / 2;
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(srcImg, dx, dy, brushWidth, brushHeight);
    }
    return;
  }

  if (currentShape === "stamp") {
    // original stamp handling
    if (currentStamp) {
      const img = new Image();
      const dx = centerX - brushWidth / 2;
      const dy = centerY - brushHeight / 2;
      pctx.imageSmoothingEnabled = false;

      img.onload = () => {
        if (!img.width || !img.height) {
          return;
        }
        pctx.drawImage(img, dx, dy, brushWidth, brushHeight);
      };
      img.src = currentStamp.dataUrl;
    } else {
      pctx.font = "12px Arial";
      pctx.fillStyle = "#fff";
      pctx.fillText("No stamp loaded", centerX-45,centerY+5);
    }
    return;
  }

  if (currentShape === "rectangle" && currentTool !== "cloner") {
    pctx.fillStyle = color;
    pctx.beginPath();
    pctx.rect(centerX - 30, centerY - 30, 60, 60);
    pctx.fill();
    return;
  }

  // default: circle brush
  pctx.fillStyle = color;
  pctx.beginPath();
  pctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  pctx.fill();

  // finally, the noiseRemover line overlay if applicable
  if (currentTool === "noiseRemover" && currentShape === "brush") {
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(centerX - brushSize/2 , centerY);
    pctx.lineTo(centerX + brushSize/2, centerY);
    pctx.stroke();
    pctx.restore();
    return;
  }
}


