drawEQ();
buildBinDisplayLookup();
updateBrushPreview();
updateTimelineCursor();
drawTimeline();
drawYAxis();
drawLogScale();
renderFullSpectrogramToImage();
updateLayers();

patchRangeValueSetter();
document.addEventListener("DOMContentLoaded", initRangeFill);