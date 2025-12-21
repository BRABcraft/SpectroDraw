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
function updateBrushPreview() {
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
    rgb = adjustSaturation(magPhaseToRGB((amp*25) * brushOpacity, penPhase * 2),phaseOpacity);
  } else if (currentTool === "noiseRemover") {
    rgb = adjustSaturation(magPhaseToRGB(60-(noiseRemoveFloor+60 * brushOpacity), 0),0);
  } else {
    rgb = adjustSaturation(magPhaseToRGB((brushColor / 5) * brushOpacity, penPhase * 2),phaseOpacity);
  }

  const color = currentTool === "eraser" ? "#000" : "#"+th(rgb[0])+th(rgb[1])+th(rgb[2]);
  if (currentShape === "line") {
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
  } else if (currentTool === "eraser") {
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 1;
    pctx.beginPath();
    if (currentShape === "rectangle" || currentShape === "image" || currentShape === "stamp") {
      pctx.strokeRect(centerX - 30, centerY - 30, 60, 60);
    } else {
      pctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    }
    pctx.stroke();
  } else if (currentTool === "blur") {
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
  } else if (currentTool === "amplifier") {
    pctx.font = "12px Arial";
    pctx.fillStyle = "#fff";
    pctx.fillText((amp * brushOpacity).toFixed(1)+"x", centerX-10, centerY+5);
    pctx.strokeStyle = color;
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    pctx.stroke();
  } else if (currentShape === "image") {
    // Draw image stretched to brushWidth x brushHeight (no aspect preservation)
    if (images[selectedImage] && images[selectedImage].img && images[selectedImage].img.complete) {
      const dx = centerX - brushWidth / 2;
      const dy = centerY - brushHeight / 2;
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(images[selectedImage].img, dx, dy, brushWidth, brushHeight);
    }
  } else if (currentShape === "stamp") {
    // Draw stamp stretched to brushWidth x brushHeight (no aspect preservation)
    if (currentStamp) {
      const img = new Image();
      const dx = centerX - brushWidth / 2;
      const dy = centerY - brushHeight / 2;
      pctx.imageSmoothingEnabled = false;

      img.onload = () => {
        // clear + redraw if needed — updateBrushPreview already cleared at top
        pctx.drawImage(img, dx, dy, brushWidth, brushHeight);
      };
      img.src = currentStamp.dataUrl;
    } else {
      pctx.font = "12px Arial";
      pctx.fillStyle = "#fff";
      pctx.fillText("No stamp loaded", centerX-45,centerY+5);
    }
  } else if (currentShape === "rectangle") {
    pctx.fillStyle = color;
    pctx.beginPath();
    pctx.rect(centerX - 30, centerY - 30, 60, 60);
    pctx.fill();
  } else if (currentShape === "note") {
    // Parameters
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
    //console.log(scales);

    // starting top Y so the whole stack is centered vertically around centerY
    let curY = centerY + totalHeight / 2;

    pctx.save();
    pctx.imageSmoothingEnabled = false;
    pctx.lineCap = "round";
    pctx.lineJoin = "round";

    // Draw each sine wave
    for (let i = 0; i < count; ++i) {
      const s = scales[i];
      const w = Math.max(1, Math.round(baseW));   // width in pixels
      const h = Math.max(1, baseH * s);               // total height (peak-to-peak)
      const halfH = h / 2;

      // compute y center for this wave
      const yCenter = curY + h / 2;

      // x start so wave is horizontally centered
      const x0 = Math.round(centerX - w / 2);

      // brightness/alpha from harmonics
      const v = harmonics[i];

      // draw the sine path (one period)
      pctx.beginPath();
      for (let px = 0; px <= w; px++) {
        // normalized 0..1 across one period
        const t = px / w;
        // one full period sine
        const y = yCenter + Math.sin(2 * Math.PI * t) * halfH;
        if (px === 0) pctx.moveTo(x0 + px + 0.5, y + 0.5);
        else pctx.lineTo(x0 + px + 0.5, y + 0.5);
      }

      // stroke with brightness = alpha. Use white tinted by alpha.
      pctx.strokeStyle = `rgba(${rgb[0]*v},${rgb[1]*v},${rgb[2]*v},255)`;
      pctx.lineWidth = 1;
      pctx.stroke();

      // advance current Y by this wave height + gap
      curY -= h;
    }

    pctx.restore();
  } else if (currentTool === "cloner") {
    if (clonerX === null || clonerY === null) {
      pctx.font = "12px Arial";
      pctx.fillStyle = "#fff";
      pctx.textAlign = "center";
      pctx.fillText("No reference point set", centerX, centerY + 4);
    } else {
      // Determine source canvas (prefer visible channel canvas)
      let srcCanvas = document.getElementById("canvas-" + clonerCh);
      if (!srcCanvas) {
        pctx.font = "12px Arial";
        pctx.fillStyle = "#fff";
        pctx.textAlign = "center";
        pctx.fillText("Source canvas missing", centerX, centerY + 4);
        return;
      }

      // compute pixels-per-unit for source canvas (same approach as previewShape())
      const srcRect = srcCanvas.getBoundingClientRect();
      const pixelsPerFrame = srcRect.width  / Math.max(1, srcCanvas.width); // screen px per canvas-x unit
      const pixelsPerBin   = srcRect.height / Math.max(1, srcCanvas.height); // screen px per canvas-y unit

      // 'screen' brush dimensions (what brushWidth/Height represent on the UI)
      const screenW = Math.max(1, brushWidth);
      const screenH = Math.max(1, brushHeight);

      // Convert screen-space brush dims to source-canvas units to determine sample rectangle (UV-style)
      const scale = clonerScale;
      const srcW = Math.max(1, Math.round((screenW / pixelsPerFrame) / scale)); // in source canvas X units
      const srcH = Math.max(1, Math.round((screenH / pixelsPerBin) / scale));   // in source canvas Y units

      // source top-left (centered at clonerX/clonerY in source canvas coordinates)
      const sx = Math.round((clonerX + (painting ? (($x - startX)/clonerScale) : 0)) - srcW / 2);
      const sy = Math.round((clonerY + (painting ? (($y - startY)/clonerScale) : 0)) - srcH / 2);

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

        pctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, dx, dy, destW, destH);

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
  }
 else {
    pctx.fillStyle = color;
    pctx.beginPath();
    pctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    pctx.fill();
  }

  if (currentTool === "noiseRemover" && currentShape === "brush") {
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(centerX - brushSize/2 , centerY);
    pctx.lineTo(centerX + brushSize/2, centerY);
    pctx.stroke();
    pctx.restore();
  }
}

