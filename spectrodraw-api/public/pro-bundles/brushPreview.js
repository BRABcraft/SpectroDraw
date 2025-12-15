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
  } else {
    // default painting preview cases
    if (currentShape === "image") {
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
    } else {
      pctx.fillStyle = color;
      pctx.beginPath();
      pctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      pctx.fill();
    }

    if (currentTool === "noiseRemover") {
      pctx.strokeStyle = "#fff";
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.moveTo(centerX - brushSize/2 , centerY);
      pctx.lineTo(centerX + brushSize/2, centerY);
      pctx.stroke();
      pctx.restore();
    }
  }
}
