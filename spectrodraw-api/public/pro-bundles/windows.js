let panels = [];
(function() {
  let _recomputeEdgeBoundsBusy = false;
  const waveformHeight = 35;
  const infoHeight = 67.2;
  const rightWidth = 310;
  const leftWidth = 250;
  const middleWidth = window.innerWidth-leftWidth-rightWidth;
  const brushSettingsHeight = (window.innerHeight-30)*0.6;
  const spritesHeight = (window.innerHeight-30)*0.4;
  const toolsHeight = (window.innerHeight-30-infoHeight)*0.3;
  const specialFxHeight = (window.innerHeight-30-infoHeight)*0.4;
  const uploadsHeight = (window.innerHeight-30-infoHeight)*0.3;
  const eqWidth = 200;
  let baseTop = 30;
  let edgeThickness = 5;
  let edgeDocks = [
    { left: 0,                                 top: baseTop,                            axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([{panelIndex:3, size:infoHeight},{panelIndex:1, size:toolsHeight},{panelIndex:2,size:specialFxHeight},{panelIndex:9,size:uploadsHeight}]), thickness: [leftWidth], name:"left" }, 
    { left: window.innerWidth - edgeThickness, top: baseTop,                            axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([{panelIndex:0, size:brushSettingsHeight},{panelIndex:7, size:spritesHeight}]), thickness: [rightWidth], name:"right" }, 
    { left: leftWidth,                         top: baseTop,                            axis: "horizontal", length: middleWidth,                  panels: new Array([{panelIndex:4,size:waveformHeight}],[{panelIndex:5,size:window.innerHeight-110-waveformHeight}]), thickness: [waveformHeight,window.innerHeight-110-waveformHeight], name:"top" }, 
    { left: leftWidth,                         top: window.innerHeight - edgeThickness, axis: "horizontal", length: middleWidth,                  panels: new Array([{panelIndex:11,size:eqWidth},{panelIndex:6,size:window.innerWidth-rightWidth-leftWidth-eqWidth,}]), thickness: [80], name:"bottom" }, 
  ];
  function newWindow(opts){
    const panelObj = document.createElement("div");
    panelObj.classList.add("window");
    panelObj.id=opts.id;
    panelObj.style.width = opts.width+"px";
    panelObj.style.height = opts.height+"px";
    panelObj.style.left = opts.left+"px";
    panelObj.style.top = opts.top+"px";
    panelObj.style.background = "#111";
    panelObj.style.position = "absolute";
    panelObj.style.boxShadow = "0 0 20px rgba(0,0,0,0.9)";
    panelObj.style.overflow = "hidden";
    panelObj.style.border = "1px solid #555";
    panelObj.style.zIndex=opts.docked?"0":"9999";
    panelObj.setAttribute("idx",panels.length);
    const topbar = 15;
    const minimizeSvg = `<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <line x1="17" y1="10" x2="3" y2="10" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
          </svg>`;
    const maximizeSvg = `<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <line x1="17" y1="10" x2="3" y2="10" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
            <line x1="10" y1="3" x2="10" y2="17" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
          </svg>`
    const popOutSVGs = {
      "right":`<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="5" width="10" height="10" fill="none" stroke="#ccc" stroke-width="2"/>
        <line x1="13" y1="10" x2="1" y2="10" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
        <path d="M1 10 L4 7 M1 10 L4 13" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      "left":`<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="5" width="10" height="10" fill="none" stroke="#ccc" stroke-width="2"/>
        <line x1="7" y1="10" x2="19" y2="10" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
        <path d="M19 10 L16 7 M19 10 L16 13" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      "top":`<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="2" width="10" height="10" fill="none" stroke="#ccc" stroke-width="2"/>
        <line x1="10" y1="7" x2="10" y2="19" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
        <path d="M10 19 L7 16 M10 19 L13 16" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      "bottom":`<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="8" width="10" height="10" fill="none" stroke="#ccc" stroke-width="2"/>
        <line x1="10" y1="13" x2="10" y2="1" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
        <path d="M10 1 L7 4 M10 1 L13 4" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    }
    const closeSVG = `<svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <line x1="16" y1="16" x2="4" y2="4" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
          </svg>`;
    panelObj.innerHTML = `
    <div id="${opts.id}header" style="height:${topbar}px;border-bottom:1px solid #888;display:${(!opts.showHeader&&opts.docked)?"none":"flex"};flex-direction:row;">
      <p style="color:white;font-family:'Inter',system-ui,sans-serif;margin:0;align-self:center;margin-left:5px;">${opts.name}</p>
      <div style="display:flex;margin-left:auto;">
        <button id="${opts.id}popOut" style="background:none;border:none;display:${opts.docked?"block":"none"};">${popOutSVGs[opts.dockEdge]}</button>
        <button id="${opts.id}minimize" style="background:none;border:none;display:${opts.docked?"none":"block"}">${minimizeSvg}</svg></button>
        <button id="${opts.id}close" style="background:none;border:none;">${closeSVG}</button>
      </div>
    </div>
    ${opts.innerHTML}
    `
    opts.obj = panelObj;
    panels.push(opts);
    document.body.appendChild(panelObj);
    function getPanelId(panelObj){return parseInt(panelObj.getAttribute("idx"));}
    function setX(panel,x){
      if (x>window.innerWidth-120) x = window.innerWidth-120;
      if (x<120-panel.width) x = 120-panel.width;
      panel.obj.style.left=(x+"px");
      panel.left=x;
    }
    function setY(panel,y){
      if (y>window.innerHeight-50) y = window.innerHeight-50;
      if (y<50-panel.height) y = 50-panel.height;
      panel.obj.style.top=(y+"px");
      panel.top=y;
    }
    function goTo(panel,x,y){
      setX(panel,x);
      setY(panel,y);
    }
    function setWidth(panel,w){
      if (w<120) w = 120;
      if (panel.id==="eqWindow"&&w>200) w=200;
      const mw = window.innerWidth-leftWidth-rightWidth-200;
      if (panel.id==="bottom-bar"&&w<mw&&panels[11].docked) {w=mw;recomputeEdgeBounds();}
      panel.obj.style.width=w+"px";
      panel.width=w;
    }
    function setHeight(panel,h){
      if (h<topbar) h = topbar;
      panel.obj.style.height=h+"px";
      panel.height=h;
    }
    function hitEdge(panel,hitX,hitY){
      const w = panel.width;
      const h = panel.height;
      const tolerance = 7;
      const l = hitX < tolerance;
      const r = hitX > w-tolerance;
      const t = hitY < tolerance;
      const b = hitY > h-tolerance;
      if (l&&b) return "sw-resize";
      if (r&&b) return "nw-resize";
      if (l) return "w-resize";
      if (r) return "e-resize";
      if (t) return "n-resize";
      if (b) return "s-resize";
      if (hitY<topbar) return "default";
      return "";
    }
    const popOutEl = document.getElementById(opts.id+"popOut");
    const minimizeEl = document.getElementById(opts.id+"minimize");
    const closeEl = document.getElementById(opts.id+"close");
    const headerEl = document.getElementById(opts.id+"header");
    const toggleButton = document.getElementById(opts.id+"Toggle");
    const check = document.getElementById(opts.id+"Check");
    if(opts.id!=="main-area"){
      panelObj.style.display = opts.showing?"flex":"none";
      panelObj.style.flexDirection = "column";
      panelObj.style.overflow = "hidden";
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "window-content";
      contentWrapper.style.flex = "1 1 auto";
      contentWrapper.style.minHeight = "0";
      contentWrapper.style.overflowY = "auto";
      contentWrapper.style.overflowX = "hidden";
      while (headerEl && headerEl.nextSibling) {
        contentWrapper.appendChild(headerEl.nextSibling);
      }
      panelObj.appendChild(contentWrapper);
      if (headerEl) headerEl.style.flex = "0 0 auto";
    }

    panelObj.addEventListener("pointerdown",(e)=>{
      const id = getPanelId(panelObj);
      const panel = panels[id];
      if (panel.docked) {
        const dockUnder = findDockUnderPointer(e.clientX, e.clientY);
        if (dockUnder) {
          const dock = dockUnder.dock;
          const layer = dockUnder.layer;
          panel.resizing = true;
          panel.resizingDock = {
            dock,
            orientation: "cross",
            startX: e.clientX,
            startY: e.clientY,
            startThickness: dock.thickness[layer],
            side: (dock.axis === "vertical")
                  ? (dock.left < window.innerWidth/2 ? "left" : "right")
                  : (dock.top < window.innerHeight/2 ? "top" : "bottom"),
            minThickness: 30,
            layer
          };
          document.body.style.cursor = dock.axis === "vertical" ? "ew-resize" : "ns-resize";
          return;
        }
      }
      panel.hitX = e.clientX - panel.left;
      panel.hitY = e.clientY - panel.top;
      panel.hit = hitEdge(panel, panel.hitX, panel.hitY);
      document.body.style.cursor = panel.hit || "default";
      if (panel.hit === "default") {
        if (!panel.docked) panel.moving=true;
      } else if (panel.hit) {
        if (panel.docked && panel.dockTo) {
          const dock = panel.dockTo;
          const {idx, layer} = findDockEntry(dock, id);
          if (dock.axis === "vertical") {
            if (panel.hit === "n-resize" && idx > 0) {
              panel.resizing = true;
              panel.resizingDock = { dock, aIdx: idx-1, bIdx: idx, startY: e.clientY, aStart: dock.panels[layer][idx-1].size, bStart: dock.panels[0][idx].size, orientation: "vertical" };
            } else if (panel.hit === "s-resize" && idx < dock.panels[layer].length-1) {
              panel.resizing = true;
              panel.resizingDock = { dock, aIdx: idx, bIdx: idx+1, startY: e.clientY, aStart: dock.panels[layer][idx].size, bStart: dock.panels[0][idx+1].size, orientation: "vertical" };
            } else if (panel.hit === "e-resize" || panel.hit === "w-resize") {
              panel.resizing = true;
              panel.resizingDock = {
                dock,
                orientation: "cross",
                startX: e.clientX,
                startThickness: dock.thickness[layer],
                side: panel.dockEdge, 
                minThickness: 30,
                layer
              };
            } else {
              panel.resizing = false;
              panel.resizingDock = null;
            }
          } else {
            if (panel.hit === "w-resize" && idx > 0) {
              panel.resizing = true;
              panel.resizingDock = { dock, aIdx: idx-1, bIdx: idx, startX: e.clientX, aStart: dock.panels[layer][idx-1].size, bStart: dock.panels[0][idx].size, orientation: "horizontal" };
            } else if (panel.hit === "e-resize" && idx < dock.panels[layer].length-1) {
              panel.resizing = true;
              panel.resizingDock = { dock, aIdx: idx, bIdx: idx+1, startX: e.clientX, aStart: dock.panels[layer][idx].size, bStart: dock.panels[0][idx+1].size, orientation: "horizontal" };
            } else if (panel.hit === "n-resize" || panel.hit === "s-resize") {
              panel.resizing = true;
              panel.resizingDock = {
                dock,
                orientation: "cross",
                startY: e.clientY,
                startThickness: dock.thickness[layer],
                side: panel.dockEdge, 
                minThickness: 30,
                layer
              };
            } else {
              panel.resizing = false;
              panel.resizingDock = null;
            }
          }
        } else {
          panel.resizing = true;
          panel.resizingDock = null;
        }
      }
    });
    function popOut(){
      const id=getPanelId(panelObj);
      const panel = panels[id];
      headerEl.style.display = "flex";
      if (panel.dockTo) {
        const dock = panel.dockTo;
        const {idx, layer} = findDockEntry(dock, id);
        //const preCount = dock.panels[layer].length;
        if (idx !== -1) {
          dock.panels[layer].splice(idx, 1);
          if (layer>0&&dock.panels[layer].length===0){
            dock.panels.splice(layer,1);
            dock.thickness.splice(layer,1);
          }
          recomputeEdgeBounds();
          layoutDock(dock);
        }
        if (panel.dockEdge === "left" || panel.dockEdge === "right") { setHeight(panel, Math.min(panel.height+topbar, window.innerHeight * 0.8)); setY(panel, panel.top + 50); }
        if (panel.dockEdge === "top" || panel.dockEdge === "bottom") { setWidth(panel, Math.min(panel.width, window.innerWidth * 0.8)); setX(panel, panel.left + 50); }
        if (panel.dockEdge === "left") setX(panel, panel.left + 250);
        if (panel.dockEdge === "right") setX(panel, panel.left - 250);
        if (panel.dockEdge === "top") setY(panel, panel.top + 250);
        if (panel.dockEdge === "bottom") setY(panel, panel.top - 250);
        panelObj.style.zIndex = "999999";
        panel.dockTo = null;
        panel.dockEdge = null;
        panel.docked = false;
      }
      popOutEl.style.display = "none";
      minimizeEl.style.display = "block";
    }
    function minimize(){
      const id=getPanelId(panelObj);
      const panel = panels[id];
      panel.minimized = !panel.minimized;
      if (panel.minimized) {
        minimizeEl.innerHTML = maximizeSvg;
        panel.lastHeight = panel.height;
        setHeight(panel,topbar);
      } else {
        setHeight(panel,panel.lastHeight);
        minimizeEl.innerHTML = minimizeSvg;
      }
    }
    function restoreDock(panel) {
      if (!panel._savedDock) return;
      let lyr = panel.layer;
      const sd = panel._savedDock;
      const dock = edgeDocks[sd.dockIndex];
      if (!dock) { panel._savedDock = null; return; }
      const id = panels.indexOf(panel); 
      if (!dock.panels[lyr]) {lyr = dock.panels.length; dock.panels.push([]); dock.thickness.push(200)}
      if (sd.toBack) {
        lyr = 0;
        dock.panels.unshift([]);
        dock.thickness.unshift(200);
      }
      const preCount = dock.panels[lyr].length;
      for (let i = 0; i < dock.panels[lyr].length; i++) {
        dock.panels[lyr][i].size *= (preCount / (preCount + 1));
      }
      const insertIdx = Math.min(sd.idx, dock.panels[lyr].length);
      const sizeToUse = sd.size || (dock.length / (preCount + 1));
      dock.panels[lyr].splice(insertIdx, 0, { panelIndex: id, size: sizeToUse });
      popOutEl.style.display = "block";
      minimizeEl.style.display = "none";
      panel.dockTo = dock;
      panel.docked = true;
      panel.dockEdge = (sd.type === 0) ? ((dock.axis === "vertical") ? "left" : "top") : ((dock.axis === "vertical") ? "right" : "bottom");
      popOutEl.innerHTML = popOutSVGs[panel.dockEdge];
      recomputeEdgeBounds();
      for (let d of edgeDocks) if (d.panels[0].length) {layoutDock(d);}
      panel._savedDock = null;
    }
    function toggleWindow(){
      const id=getPanelId(panelObj);
      const panel = panels[id];
      if (panel.showing) {
        if (panel.docked && panel.dockTo) {
          const dock = panel.dockTo;
          const {idx, layer} = findDockEntry(dock, id);
          if (idx !== -1) {
            panel._savedDock = {
              dockIndex: edgeDocks.indexOf(dock),
              idx: idx,
              size: dock.panels[layer][idx] ? dock.panels[layer][idx].size : (dock.length / Math.max(1, dock.panels[layer].length)),
              type: (panel.dockEdge === "left" || panel.dockEdge === "top") ? 0 : 1,
              toBack: layer!==dock.panels.length-1 && dock.panels[layer].length===1,
            };
          }
          popOut();
        }
        panel.showing = false;
        panelObj.style.display = "none";
        if (toggleButton&&!check) toggleButton.style.background = "";
        if (check) check.innerText = "✓";
      } else {
        panel.showing = true;
        panelObj.style.display = "block";
        if (toggleButton&&!check) toggleButton.style.background = "#4af";
        if (check) check.innerText = "";
        if (panel._savedDock) {
          restoreDock(panel);
        }
      }
      recomputeEdgeBounds();
    }
    function detectEdgeDocks(panel){
      for (let edge of edgeDocks){
        let length = edge.panels[0].length===0?0:edge.panels.length;
        if (edge.axis === "vertical") {
          let offX = 0;
          const py = panel.top;
          const pyB = panel.top + panel.height;
          const sign = (edge.name==="left")?-1:1;
          for (let p = 0; p <= length; p++) {
            const px = panel.left + sign * offX;
            const pxR = panel.left + panel.width + sign * offX;
            const inLeftSpan = (px > edge.left && px < (edge.left + edgeThickness));
            const inRightSpan = (pxR > edge.left && pxR < (edge.left + edgeThickness));
            const inVSpanTop = (py >= edge.top && py <= (edge.top + edge.length));
            const inVSpanBottom = (pyB >= edge.top && pyB <= (edge.top + edge.length));
            if (inLeftSpan && inVSpanTop) return {edge,type:0,layer:p,off:offX};
            if (inRightSpan && inVSpanBottom) return {edge,type:1,layer:p,off:-offX};
            if (p<edge.panels.length) offX += edge.thickness[p];
          }
        } else {
          let offY = 0;
          const px = panel.left;
          const pxR = panel.left + panel.width;
          const sign = (edge.name==="top")?-1:1;
          for (let p = 0; p <= length; p++) {
            if (p>1) continue;
            const py = panel.top + sign*offY;
            const pyB = panel.top + panel.height + sign*offY;
            const inTopSpan = (py > edge.top && py < (edge.top + edgeThickness));
            const inBottomSpan = (pyB > edge.top && pyB < (edge.top + edgeThickness));
            const inHSpanLeft = (px >= edge.left && px <= (edge.left + edge.length));
            const inHSpanRight = (pxR >= edge.left && pxR <= (edge.left + edge.length));
            if (inTopSpan && inHSpanLeft) {return {edge,type:0,layer:p,off:offY};}
            if (inBottomSpan && inHSpanRight) {return {edge,type:1,layer:p,off:-offY};}
            if (p<edge.panels.length) offY += edge.thickness[p];
          }
        }
      }
      return null;
    }
    function findDockUnderPointer(px, py) {
      const tol = 6;
      for (let dock of edgeDocks) {
        let off = 0;
        const layers = Math.max(1, dock.thickness.length);
        for (let layer = 0; layer < layers; layer++) {
          const thick = dock.thickness[layer] || 0;
          if (dock.axis === "vertical") {
            let left, right, top = dock.top, bottom = dock.top + dock.length;
            if (dock.left < window.innerWidth / 2) {
              left = dock.left + off - tol;
              right = dock.left + off + edgeThickness + tol;
            } else {
              left = dock.left - off - tol;
              right = dock.left - off + edgeThickness + tol;
            }
            if (px >= left && px <= right && py >= top && py <= bottom) return { dock, layer };
          } else {
            let topEdge, bottomEdge, left = dock.left, right = dock.left + dock.length;
            if (dock.top < window.innerHeight / 2) {
              topEdge = dock.top + off - tol;
              bottomEdge = dock.top + off + edgeThickness + tol;
            } else {
              topEdge = dock.top - off - tol;
              bottomEdge = dock.top - off + edgeThickness + tol;
            }
            if (px >= left && px <= right && py >= topEdge && py <= bottomEdge) return { dock, layer };
          }
          off += thick;
        }
      }
      return null;
    }
    function highlightEdgeDock(dockObj) {
      let h = document.getElementById("dockEdge");
      if (!h) {
        h = document.createElement("div");
        h.id="dockEdge";
        h.style.position="absolute";
        h.style.pointerEvents="none";
        h.style.background="#ccf";
        h.style.zIndex="9999999";
        document.body.appendChild(h);
      }
      if (!dockObj) { h.style.display = "none"; return; }
      const dock = dockObj.edge;
      h.style.display = "block";
      if (dock.axis === "vertical") {
        h.style.left = (dock.left+dockObj.off) + "px";
        h.style.top = (dock.top) + "px";
        h.style.width = edgeThickness + "px";
        h.style.height = dock.length + "px";
      } else {
        h.style.left = (dock.left) + "px";
        h.style.top = (dock.top+dockObj.off) + "px";
        h.style.width = dock.length + "px";
        h.style.height = edgeThickness + "px";
      }
    }
    function findDockEntry(dock, panelIndex) {
      for (let layer=0;layer<dock.panels.length;layer++) {
        for (let idx = 0; idx < dock.panels[layer].length; idx++) {
          if (dock.panels[layer][idx].panelIndex === panelIndex) return {idx,layer};
        }
      }
      return {idx:-1,layer:-1};
    }
    function layoutDock(dock) {
      let off=0;
      for (let i=0;i<dock.panels.length;i++){
        if (dock.axis === "vertical") {
          let y = dock.top;
          for (let entry of dock.panels[i]) {
            const p = panels[entry.panelIndex];
            entry.size = Math.max(entry.size, 30);
            setHeight(p, Math.round(entry.size));
            setY(p, y);
            const width = Math.round(dock.thickness[i]);
            setWidth(p, width);
            if (dock.left < window.innerWidth / 2) {
              setX(p, dock.left+off);
            } else {
              setX(p, Math.round(dock.left + edgeThickness - p.width - off));
            }
            p.dockTo = dock;
            p.docked = true;
            p.dockEdge = (dock.left < window.innerWidth / 2) ? "left" : "right";
            y += entry.size;
          }
        } else {
          let x = dock.left;
          for (let entry of dock.panels[i]) {
            const p = panels[entry.panelIndex];
            entry.size = Math.max(entry.size, 120);
            setWidth(p, Math.round(entry.size));
            setX(p, x);
            const height = Math.round(dock.thickness[i]);
            setHeight(p, height);
            if (dock.top < window.innerHeight / 2) {
              setY(p, dock.top+off);
            } else {
              setY(p, Math.round(dock.top + edgeThickness - p.height - off));
            }
            p.dockTo = dock;
            p.docked = true;
            p.dockEdge = (dock.top < window.innerHeight / 2) ? "top" : "bottom";
            x += entry.size;
          }
        }
        off += dock.thickness[i];
      }
    }
    function recomputeEdgeBounds() {
      if (_recomputeEdgeBoundsBusy) return;
      _recomputeEdgeBoundsBusy = true;
      try {
        const leftDock = edgeDocks[0], rightDock = edgeDocks[1], topDock = edgeDocks[2], bottomDock = edgeDocks[3];
        const topOccupied = (topDock.panels.length>0&&topDock.panels[0].length>0)?topDock.thickness.reduce((a,b)=>a+b,0):0;
        const bottomOccupied = (bottomDock.panels.length>0&&bottomDock.panels[0].length>0)?bottomDock.thickness.reduce((a,b)=>a+b,0):0;
        const leftOccupied = (leftDock.panels.length>0&&leftDock.panels[0].length>0)?leftDock.thickness.reduce((a,b)=>a+b,0):0;
        const rightOccupied = (rightDock.panels.length>0&&rightDock.panels[0].length>0)?rightDock.thickness.reduce((a,b)=>a+b,0):0;
        leftDock.top = baseTop;
        rightDock.top = baseTop;
        topDock.left = leftOccupied;
        bottomDock.left = leftOccupied;
        topDock.length = Math.max(0, window.innerWidth - leftOccupied - rightOccupied);
        bottomDock.length = Math.max(0, window.innerWidth - leftOccupied - rightOccupied);
        edgeDocks[1].left = window.innerWidth - edgeThickness;
        edgeDocks[3].top  = window.innerHeight - edgeThickness;
        function clampToLength(edge,p,l){
          if (!l) l = edge.length;
          if (edge.axis === "horizontal") setWidth(panels[p.panelIndex], l);
          else setHeight(panels[p.panelIndex], l);
          p.size = l;
        }
        for (let edge of edgeDocks) {
          for (let edgePanel of edge.panels) {
            let total = 0;
            for (let p of edgePanel) {
              if (edgePanel.length===1 && p.size<edge.length) clampToLength(edge,p);
              if (p.size > edge.length) clampToLength(edge,p);
              //const pn = panels[p.panelIndex];
              //if (pn.left>total+edge.left) {setX(pn, total+edge.left);console.log(pn.left,total);}
              total += p.size;
            }
            if (total === 0) continue;
            if (total !== edge.length) {
              for (let p of edgePanel) clampToLength(edge,p,p.size*(edge.length/total));
            }
          }
        }
      } finally {
        _recomputeEdgeBoundsBusy = false;
      }
    }
function setDocked(panel, dockObj){ 
      const MAX_11 = 200;
      const dock = dockObj.edge;
      const id = panels.indexOf(panel);
      if (!panel.showHeader) document.getElementById(panel.id+"header").style.display="none";
      panel.dockTo = dock;
      panel.docked = true;
      panel.layer = dockObj.layer;
      panelObj.style.zIndex = "0";
      if (!dock.panels[dockObj.layer]) dock.panels[dockObj.layer] = [];
      if (!dock.thickness[dockObj.layer]) dock.thickness[dockObj.layer] = 200;
      const p = dock.panels[dockObj.layer];
      const preCount = p.length;
      for (let i = 0; i < p.length; i++) {
        p[i].size *= (preCount / (preCount + 1));
      }
      const spaceLeft = dock.length / (preCount + 1);
      dock.panels[dockObj.layer].push({ panelIndex: id, size: spaceLeft });
      const layerPanels = dock.panels[dockObj.layer];
      const sizes = new Array(layerPanels.length);
      const isClamped = new Array(layerPanels.length);
      for (let i = 0; i < layerPanels.length; i++) {
        const pl = layerPanels[i];
        sizes[i] = Number(pl.size) || 0;
        if (pl.panelIndex === 11) {
          if (sizes[i] > MAX_11) sizes[i] = MAX_11;
          isClamped[i] = true;
        } else {
          isClamped[i] = false;
        }
      }
      const totalAvailable = dock.length;
      let sumSizes = sizes.reduce((s, v) => s + v, 0);
      let diff = function combineAndDraw(startSample, endSample) {
  let avg;
  let maxLen = layers[0].pcm.length;
  if (layers.length > 1) {
    const sum = new Float32Array(maxLen);
    const count = new Uint16Array(maxLen);
    for (let ch = 0; ch < layerCount; ch++) {
      const layer = layers[ch];
      if (!layer || !layer.pcm) continue;
      const p = layer.pcm;
      const L = p.length;
      for (let i = 0; i < L; i++) {
        const v = p[i];
        if (!isFinite(v)) continue;
        sum[i] += v;
        count[i] += 1;
      }
    }
    avg = new Float32Array(maxLen);
    for (let i = 0; i < maxLen; i++) {
      if (count[i] > 0) {
        avg[i] = sum[i] / count[i];
      } else {
        avg[i] = 0;
      }
    }
  } else {
    avg = layers[0].pcm;
  }
  if (typeof startSample === 'undefined' || startSample === null) startSample = 0;
  if (typeof endSample === 'undefined' || endSample === null) endSample = maxLen;
  startSample = Math.max(0, Math.floor(startSample));
  endSample = Math.min(maxLen, Math.ceil(endSample));
  if (endSample <= startSample) {
    startSample = 0;
    endSample = maxLen;
  }
  const WIDTH = 1000;
  const HEIGHT = 35;
  const canvas = document.getElementById('waveform');
  if (!canvas || !canvas.getContext) return;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const halfH = HEIGHT / 2;
  const scale = halfH / 1.5;
  const sampleRange = Math.max(1, endSample - startSample);
  const samplesPerPixel = sampleRange / WIDTH;
    ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#00aaff';
  const sampleCount = endSample - startSample;
  if (sampleCount < WIDTH*12) {
    ctx.beginPath();
    for (let i = 0; i < sampleCount; i++) {
      const x = (i / (sampleCount - 1 || 1)) * WIDTH;
      const v = avg[startSample + i] || 0;
      const y = halfH - v * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  for (let x = 0; x < WIDTH; x++) {
    const start = Math.floor(startSample + x * samplesPerPixel);
    const end = Math.min(endSample, Math.floor(startSample + (x + 1) * samplesPerPixel));
    let min = Infinity, max = -Infinity;
    if (end <= start) {
      const v = avg[start] || 0;
      min = max = v;
    } else {
      for (let i = start; i < end; i++) {
        const v = avg[i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const y1 = halfH - max * scale;
    const y2 = halfH - min * scale;
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
  }
  ctx.stroke();
}
function recomputePCMForCols(colStart, colEnd) {
  colStart = Math.max(0, Math.floor(colStart));
  colEnd   = Math.min(specWidth - 1, Math.floor(colEnd));
  if (colEnd < colStart) return;
  const marginCols = Math.ceil(fftSize / hop) + 2;
  const colFirst = Math.max(0, colStart - marginCols);
  const colLast  = Math.min(specWidth - 1, colEnd + marginCols);
  const h = specHeight;
  const window = win;
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const EPS = 1e-8;
  const fadeCap = Infinity;
  for (let ch = 0; ch < layerCount; ch++) {
    const layer = layers[ch];
    if (!layer) continue;
    const pcm = layer.pcm || new Float32Array(0);
    const sampleStart = Math.max(0, colFirst * hop);
    const sampleEnd   = Math.min(pcm.length, (colLast * hop) + fftSize);
    const segmentLen  = sampleEnd - sampleStart;
    if (segmentLen <= 0) continue;
    const newSegment = new Float32Array(segmentLen);
    const overlapCount = new Float32Array(segmentLen);
    for (let xCol = colFirst; xCol <= colLast; xCol++) {
      re.fill(0);
      im.fill(0);
      const mags = layer.mags;
      const phases = layer.phases;
      for (let bin = 0; bin < h && bin < fftSize; bin++) {
        const idx = xCol * h + bin;
        const mag = mags[idx];
        const phase = phases[idx];
        re[bin] = mag * Math.cos(phase);
        im[bin] = mag * Math.sin(phase);
        if (bin > 0 && bin < fftSize / 2) {
          const sym = fftSize - bin;
          re[sym] = re[bin];
          im[sym] = -im[bin];
        }
      }
      im[0] = 0;
      if (fftSize % 2 === 0) im[fftSize / 2] = 0;
      ifft_inplace(re, im);
      const baseSample = xCol * hop;
      for (let i = 0; i < fftSize; i++) {
        const globalSample = baseSample + i;
        if (globalSample < sampleStart || globalSample >= sampleEnd) continue;
        const segIndex = globalSample - sampleStart;
        newSegment[segIndex] += re[i] * window[i];
        overlapCount[segIndex] += window[i] * window[i];
      }
    } 
    for (let i = 0; i < segmentLen; i++) {
      if (overlapCount[i] > EPS) newSegment[i] /= overlapCount[i];
      else newSegment[i] = 0;
    }
    const oldSegment = pcm.slice(sampleStart, sampleEnd); 
    const fadeLen = Math.min(Math.max(1, hop), fadeCap, segmentLen);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      newSegment[i] = newSegment[i] * t + oldSegment[i] * (1 - t);
      const j = segmentLen - 1 - i;
      if (j >= 0 && j < segmentLen) {
        const oldIdx = oldSegment.length - 1 - i;
        newSegment[j] = newSegment[j] * t + oldSegment[oldIdx] * (1 - t);
      }
    }
    layer.pcm.set(newSegment, sampleStart);
  }
  if (layers && layers[0] && layers[0].pcm) {
    const startSample = Math.max(0, Math.floor(iLow * hop));
    const endSample = Math.min(layers[0].pcm.length, Math.ceil(iHigh * hop));
    combineAndDraw(startSample, endSample);
  } else {
    combineAndDraw(); 
  }
  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}
function renderSpectrogramColumnsToImageBuffer(colStart, colEnd, ch) {
  let mags = layers[ch].mags, phases = layers[ch].phases;
  const specCanvas = document.getElementById("spec-"+ch);
  const specCtx = specCanvas.getContext("2d");
  colStart = Math.min(Math.max(0, Math.floor(colStart)),specWidth);
  colEnd = Math.min(specWidth - 1, Math.max(0,Math.floor(colEnd)));
  if (!imageBuffer[ch] || !specCtx) return;
  const h = specHeight;
  const w = specWidth;
  for (let xx = colStart; xx <= colEnd; xx++) {
    for (let yy = 0; yy < h; yy++) {
      const bin = displayYToBin(yy, h, ch);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const [r,g,b] = magPhaseToRGB(mag, phase);
      const pix = (yy * w + xx) * 4;
      imageBuffer[ch].data[pix] = r;
      imageBuffer[ch].data[pix+1] = g;
      imageBuffer[ch].data[pix+2] = b;
      imageBuffer[ch].data[pix+3] = 255;
    }
  }
  specCtx.putImageData(imageBuffer[ch], 0, 0, colStart, 0, (colEnd-colStart+1), specHeight);
  renderView();
  drawCursor();
}
document.addEventListener('keydown', (ev) => {
  if (editingExpression !== null) return; 
  const key = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && key === 'z') {
    ev.preventDefault();
    if (ev.shiftKey) doRedo();    
    else doUndo();                
  } else if ((ev.ctrlKey || ev.metaKey) && key === 'y') {
    ev.preventDefault();
    doRedo();                     
  }
});
document.getElementById('undoBtn').addEventListener('click', () => {
  doUndo();
});
document.getElementById('redoBtn').addEventListener('click', () => {
  doRedo();
});
function doUndo() {
  if (rendering) return;
  let idx = -1;
  for (let i = sprites.length - 1; i >= 0; i--) {
    if (sprites[i].enabled) { idx = i; break; }
  }
  if (idx === -1) { console.log("Nothing to undo (no enabled sprites)"); return; }
  const sprite = sprites[idx];
  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?layerCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = layers[ch].mags, phases = layers[ch].phases;
    console.log("Undoing sprite:", sprite);
    forEachSpritePixelInOrder(sprite, ch, (x, y, prevMag, prevPhase) => {
      const id = x * specHeight + y;
      mags[id] = prevMag;
      phases[id] = prevPhase;
    });
    sprite.enabled = false;
    renderSpritesTable();
    console.log(sprite);
    const minCol = Math.max(0, sprite.minCol);
    const maxCol = Math.min(specWidth - 1, sprite.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol,ch);
  }
  autoRecomputePCM(-1,-1);
  if (iHigh>specWidth) {iHigh = specWidth; updateCanvasScroll();}
  spriteRedoQueue.push(sprite);
  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}
function doRedo() {
  if (rendering) return;
  let idx = -1;
  for (let i = 0; i < sprites.length; i++) {
    if (!sprites[i].enabled) { idx = i; break; }
  }
  if (idx === -1) { console.log("Nothing to redo (no disabled sprites)"); return; }
  const sprite = sprites[idx];
  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?layerCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = layers[ch].mags, phases = layers[ch].phases;
    forEachSpritePixelInOrder(sprite, ch, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
      const id = x * specHeight + y;
      mags[id] = nextMag;
      phases[id] = nextPhase;
    });
    sprite.enabled = true;
    renderSpritesTable();
    const minCol = Math.max(0, sprite.minCol);
    const maxCol = Math.min(specWidth - 1, sprite.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol,ch);
  }
  autoRecomputePCM(-1,-1);
  const rqidx = spriteRedoQueue.indexOf(sprite);
  if (rqidx !== -1) spriteRedoQueue.splice(rqidx, 1);
  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}totalAvailable - sumSizes; 
      const flexibleIdx = [];
      for (let i = 0; i < layerPanels.length; i++) {
        if (!isClamped[i]) flexibleIdx.push(i);
      }
      let totalFlexible = flexibleIdx.reduce((s, idx) => s + sizes[idx], 0);
      if (Math.abs(diff) > 1e-6) {
        if (diff > 0) {
          if (totalFlexible > 0) {
            for (let idx of flexibleIdx) {
              const share = sizes[idx] / totalFlexible; 
              sizes[idx] += share * diff;
            }
          } else {
            let idxFallback = -1;
            for (let i = 0; i < layerPanels.length; i++) {
              if (layerPanels[i].panelIndex !== 11) { idxFallback = i; break; }
            }
            if (idxFallback === -1) idxFallback = layerPanels.length - 1;
            sizes[idxFallback] += diff;
          }
        } else {
          if (totalFlexible > 0) {
            for (let idx of flexibleIdx) {
              const share = sizes[idx] / totalFlexible;
              sizes[idx] += share * diff; 
              if (sizes[idx] < 1) sizes[idx] = 1;
            }
          } else {
            const scale = totalAvailable / sumSizes;
            for (let i = 0; i < sizes.length; i++) sizes[i] = Math.max(1, sizes[i] * scale);
          }
        }
      }
      for (let i = 0; i < layerPanels.length; i++) {
        if (layerPanels[i].panelIndex === 11 && sizes[i] > MAX_11) sizes[i] = MAX_11;
        if (!isFinite(sizes[i]) || sizes[i] < 0) sizes[i] = 0;
      }
      sumSizes = sizes.reduce((s, v) => s + v, 0);
      if (sumSizes > 0 && Math.abs(sumSizes - totalAvailable) > 1e-6) {
        const scale = totalAvailable / sumSizes;
        for (let i = 0; i < sizes.length; i++) sizes[i] *= scale;
      }
      let x = dock.left || 0; 
      for (let i = 0; i < layerPanels.length; i++) {
        layerPanels[i].size = sizes[i];
        const panelIdx = layerPanels[i].panelIndex;
        if (typeof setX === 'function' && panels[panelIdx]) {
          setX(panels[panelIdx], x);
        } else if (panels[panelIdx]) {
          panels[panelIdx].left = x;
        }
        x += sizes[i];
      }
      popOutEl.style.display = "block";
      minimizeEl.style.display = "none";
      if (dockObj.type === 0) { panel.dockEdge = (dock.axis === "vertical") ? "left" : "top"; }
      else { panel.dockEdge = (dock.axis === "vertical") ? "right" : "bottom"; }
      popOutEl.innerHTML = popOutSVGs[panel.dockEdge];
      recomputeEdgeBounds();
      for (let d of edgeDocks) {
        for (let p of d.panels) {
          if (p.length) layoutDock(d);
        }
      }
    }

    document.addEventListener("pointermove",(e)=>{
      const id=getPanelId(panelObj);
      const panel = panels[id];
      const cursorStyle = hitEdge(panel,e.clientX-panel.left,e.clientY-panel.top);
      if (panel.moving) {
        goTo(panel,e.clientX-panel.hitX,e.clientY-panel.hitY);
        highlightEdgeDock(detectEdgeDocks(panel));
      } else if (panel.resizing) {
        if (panel.resizingDock) {
          const rd = panel.resizingDock;
          const dock = rd.dock;
          if (rd.orientation === "cross") {
            if (dock.axis === "vertical") {
              const delta = e.clientX - (rd.startX || e.clientX);
              let newThickness = rd.startThickness + ((rd.side === "right") ? -delta : delta);
              if (newThickness < rd.minThickness) newThickness = rd.minThickness;
              dock.thickness[rd.layer] = newThickness;
              layoutDock(dock);
              recomputeEdgeBounds();
              for (let d of edgeDocks) if (d.panels[0].length) layoutDock(d);
              document.body.style.cursor = "ew-resize";
            } else {
              const delta = e.clientY - (rd.startY || e.clientY);
              let newThickness = rd.startThickness + ((rd.side === "bottom") ? -delta : delta);
              if (newThickness < rd.minThickness) newThickness = rd.minThickness;
              dock.thickness[rd.layer] = newThickness;
              layoutDock(dock);
              recomputeEdgeBounds();
              for (let d of edgeDocks) if (d.panels[0].length) layoutDock(d);
              document.body.style.cursor = "ns-resize";
            }
            highlightEdgeDock(detectEdgeDocks(panel));
            return;
          }
          if (rd.orientation === "vertical") {
            const delta = e.clientY - rd.startY;
            let newA = rd.aStart + delta;
            let newB = rd.bStart - delta;
            const minSz = 30;
            if (newA < minSz) { newB -= (minSz - newA); newA = minSz; }
            if (newB < minSz) { newA -= (minSz - newB); newB = minSz; }
            dock.panels[0][rd.aIdx].size = newA;
            dock.panels[0][rd.bIdx].size = newB;
            layoutDock(dock);
            recomputeEdgeBounds();
            for (let d of edgeDocks) if (d.panels[0].length) layoutDock(d);
            document.body.style.cursor = "ns-resize";
            highlightEdgeDock(detectEdgeDocks(panel));
            return;
          }
          if (rd.orientation === "horizontal") {
            const MAX_11 = 200;
            const minSz = 120;
            const ap = dock.panels[0][rd.aIdx];
            const bp = dock.panels[0][rd.bIdx];
            const totalStart = (rd.aStart || 0) + (rd.bStart || 0);
            const delta = e.clientX - rd.startX;
            let newA = (rd.aStart || 0) + delta;
            let newB = totalStart - newA;
            const apIs11 = ap && ap.panelIndex === 11;
            const bpIs11 = bp && bp.panelIndex === 11;
            const maxA = apIs11 ? MAX_11 : Infinity;
            const maxB = bpIs11 ? MAX_11 : Infinity;
            function clampPreserveTotal(a, b) {
              a = Math.max(minSz, Math.min(maxA, a));
              b = totalStart - a;
              if (b < minSz) {
                b = minSz;
                a = totalStart - b;
                a = Math.max(minSz, Math.min(maxA, a));
                b = totalStart - a;
              } else if (b > maxB) {
                b = maxB;
                a = totalStart - b;
                a = Math.max(minSz, Math.min(maxA, a));
                b = totalStart - a;
              }
              a = Math.max(minSz, Math.min(maxA, a));
              b = Math.max(minSz, Math.min(maxB, b));
              return [a, b];
            }
            [newA, newB] = clampPreserveTotal(newA, newB);
            ap.size = newA;
            bp.size = newB;
            layoutDock(dock);
            recomputeEdgeBounds();
            for (let d of edgeDocks) if (d.panels[0].length) layoutDock(d);
            document.body.style.cursor = "ew-resize";
            highlightEdgeDock(detectEdgeDocks(panel));
            return;
          }
          document.body.style.cursor = "default";
          highlightEdgeDock(detectEdgeDocks(panel));
        } else {
          const dx = e.clientX-panel.left;
          const dy = e.clientY-panel.top;
          if (panel.hit==="sw-resize"||panel.hit==="nw-resize") {
            setWidth(panel,dx);
            setHeight(panel,dy);
          } else if (panel.hit==="e-resize") {
            setWidth(panel,dx);
          } else if (panel.hit==="w-resize") {
            setWidth(panel,panel.left+panel.width-e.clientX);
            setX(panel,e.clientX);
          } else if (panel.hit==="s-resize") {
            setHeight(panel,dy);
          } else if (panel.hit==="n-resize") {
            setHeight(panel,panel.top+panel.height-e.clientY);
            setY(panel,e.clientY);
          }
          document.body.style.cursor = cursorStyle;
          highlightEdgeDock(detectEdgeDocks(panel));
        }
      } else {
        panelObj.style.cursor = cursorStyle;
        document.body.style.cursor = "default";
      }
    });
    document.addEventListener("pointerup",()=>{
      const id=getPanelId(panelObj);
      const panel = panels[id];
      panel.hit = "none";
      const h = document.getElementById("dockEdge");
      if (h) h.style.display = "none";
      if (!panel.docked) {
        const dock = detectEdgeDocks(panel);
        if (dock) setDocked(panel,dock);
      }
      panel.resizing=false;
      panel.moving=false;
      panel.resizingDock = null;
    });
    popOutEl.addEventListener("click",popOut);
    minimizeEl.addEventListener("click",minimize);
    closeEl.addEventListener("click",()=>{toggleWindow();});
    if (toggleButton) toggleButton.addEventListener("click",()=>{toggleWindow();});
    window.addEventListener("resize",()=>{
      recomputeEdgeBounds();
      for (let d of edgeDocks) if (d.panels[0].length) layoutDock(d);
    });
    // if (opts.docked && opts.dockTo) {
    //   const id = panels.indexOf(opts);
    //   if (id !== -1) {
    //     const {idx, layer} = findDockEntry(opts.dockTo, id);
    //     if (idx === -1) {
    //       const typeVal = (opts.dockEdge === "left" || opts.dockEdge === "top") ? 0 : 1;
    //       setDocked(panels[id], { edge: opts.dockTo, type: typeVal, off:0, layer:0 });
    //     }
    //   }
    // }
  }
  newWindow({
      name:"Brush Settings",
      id:"brushSettingsWindow",
      width:rightWidth,
      height:brushSettingsHeight,
      docked:true,
      dockEdge:"right",
      dockTo:edgeDocks[1],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth-rightWidth,
      top:30,
      showing:true,
      showHeader:true,
      innerHTML:`<div style="overflow-y:auto;overflow-x:hidden;">
    <canvas id="strokePreview" width="300" height="100" style="border:1px solid #ccc; display:block; margin-top:10px;"></canvas>
    <!--Tool select: Common: {Note brush (harmonics), Stamp, Cloner, Line}, Special: {Pressure brush, Rectangle, Image overlay} -->
    <div class="slider-row" title="Size" id="brushToolSelectDiv">
      <label class="h2">Tool</label>
      <select id="brushToolSelect">
        <option value="note" selected>Note Brush</option>
        <option value="stamp">Stamp</option>
        <option value="line">Line</option>
        <option value="brush">Pressure Brush</option>
        <option value="rectangle">Rectangle</option>
        <option value="image">Image Overlay</option>
        <option value="select">Selection</option>
      </select>
    </div>
    <!--Effect select: Fill, Noise remover (AI), amplifier, Eraser, Blur-->
    <div class="slider-row" title="Size" id="brushEffectSelectDiv">
      <label class="h2">Effect</label>
      <select id="brushEffectSelect">
        <option value="fill" selected>Fill</option>
        <option value="noiseRemover">Noise Remover</option>
        <option value="cloner">Cloner</option>
        <option value="autotune">Autotune</option>
        <option value="amplifier">Amplifier</option>
        <option value="eraser">Eraser</option>
        <option value="blur">Blur</option>
      </select>
    </div>
    <!--Tool settings: Size/width/height/opacity/harmonics-->
    <div id="toolSettings">
      <h3>
        Tool settings
        <button type="button"
                class="section-toggle"
                data-target="toolSettings"
                aria-expanded="true"
                aria-label="Toggle Effect settings"
                id="btoolSettingsToggleBtn"></button>
      </h3>
      <div id="stampsDiv" style="display:none;">
        <h3>Stamps
          <button type="button"
                  class="section-toggle"
                  data-target="stampsDiv"
                  aria-expanded="true"
                  aria-label="Toggle Stamps"
                  id="stampsDivToggleBtn"></button>
        </h3>
        <div id="stampsWrapper"></div>
      </div>
      <div class="slider-row" id="dragToDrawDiv" style="display:none;">
        <label class="h2">Drag to draw</label>
        <input type="checkbox" id="dragToDraw"></input>
      </div>
      <div class="slider-row" id="changeClonerPosDiv" style="display:none;">
        <button id="changeClonerPosBtn" class="leftBtn moving">Changing Reference Point...</button>
      </div>
      <div class="slider-row" title="Cloner scale" id="clonerScaleDiv" style="display:none;">
        <label class="h2">Cloner scale</label>
        <input id="clonerScale" type="range" min="0.01" max="10" value="1" step="0.01">
        <input id="clonerScaleInput" type="number" value="1" min="0.01" max="10">
      </div>
      <div class="slider-row" title="Size" id="brushSizeDiv">
        <label class="h2">Size</label>
        <input id="brushSize" type="range" min="1" max="200" value="40">
        <input id="brushSizeInput" type="number" value="40" min="1" max="200">
      </div>
      <div class="slider-row" title="Width" id="brushWidthDiv">
        <label class="h2">Width</label>
        <input id="brushWidth" type="range" min="1" max="200" value="40">
        <input id="brushWidthInput" type="number" value="40" min="1" max="200">
      </div>
      <div class="slider-row" title="Height" id="brushHeightDiv">
        <label class="h2">Height</label>
        <input id="brushHeight" type="range" min="1" max="200" value="40">
        <input id="brushHeightInput" type="number" value="40" min="1" max="200">
      </div>
      <div class="slider-row" title="Opacity" id="opacityDiv">
        <label class="h2">Opacity</label>
        <input id="brushOpacity"  type="range" min="0" max="1" value="1" step="0.01">
        <input id="brushOpacityInput" type="number" value="1" min="0" max="1">
      </div>
      <div class="slider-row" title="Harmonics Preset" id="harmonicsPresetSelectDiv" style="display:none;">
        <label class="h2">Harmonics preset</label>
        <select id="harmonicsPresetSelect">
          <option value="sine" selected>Sine wave</option>
          <option value="triangle">Triangle wave</option>
          <option value="square">Square wave</option>
          <option value="saw">Saw wave</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div id="brushHarmonicsEditorDiv" style="margin-left:10px;display:none;">
        <h3 style="font-size:15px;margin:0;"id="brushHarmonicsEditorh3">Advanced Harmonics
          <button type="button"
                  class="section-toggle"
                  data-target="brushHarmonicsEditorDiv"
                  aria-expanded="false"
                  aria-label="Toggle Harmonics editor settings"
                  id="brushHarmonicsEditorDivToggleBtn"style="margin-right:15px;"></button>
        </h3>
        <canvas id="harmonicsEditor" width="280" height="140" style="border:1px solid #ccc; margin-top:10px;"></canvas>
      </div>
    </div>
    <!--Effect settings: Depends on effect. -->
    <div id="effectSettings">
      <h3>
        Effect settings
        <button type="button"
                class="section-toggle"
                data-target="effectSettings"
                aria-expanded="true"
                aria-label="Toggle Effect settings"
                id="beffectSettingsToggleBtn"></button>
      </h3>
      <div class="slider-row" title="Brightness" id="brushBrightnessDiv">
          <label class="h2">Brush Brightness</label>
          <input id="brushBrightness" type="range" min="0" max="255" value="255">
          <input id="brushBrightnessInput" type="number" value="255" min="0" max="255">
      </div>
      <div class="slider-row" title="Blur Radius" style="display:none;" id="blurRadiusDiv">
          <label class="h2">Blur Radius</label>
          <input id="blurRadius"  type="range" min="0" max="10" value="1.5" step="0.1">
          <input id="blurRadiusInput" type="number" value="1.5" min="0" max="10">
      </div>
      <div class="slider-row" title="Amplifier" style="display:none;" id="amplifyDiv">
          <label class="h2">Amplifier</label>
          <input id="amp"  type="range" min="0" max="2" value="2" step="0.01">
          <input id="ampInput" type="number" value="2" min="0" max="2">
      </div>
      <div class="slider-row" title="Noise remover aggressiveness" style="display:none;" id="noiseAggDiv">
          <label class="h2">Aggressiveness</label>
          <input id="noiseAgg"  type="range" min="0" max="8" value="5" step="0.1">
          <input id="noiseAggInput" type="number" value="5" min="0" max="8">
      </div>
      <div class="slider-row" id="setNoiseProfileDiv" style="display:none;">
        <button id="setNoiseProfile" class="leftBtn">Set noise profile frames</button>
        <input id="setNoiseProfileMin" type="number" value="0" min="0" max="435">
        <input id="setNoiseProfileMax" type="number" value="0" min="0" max="435">
      </div>
      <div class="slider-row" title="Autotune strength" style="display:none;" id="autoTuneStrengthDiv">
          <label class="h2">Autotune strength</label>
          <input id="autoTuneStrength"  type="range" min="0" max="1" value="1" step="0.01">
          <input id="autoTuneStrengthInput" type="number" value="1" min="0" max="1">
      </div>
      <div class="slider-row" title="Base Pitch" id="astartOnPitchDiv" style="display:none;">
        <label class="h2">Base Hz</label>
        <input id="astartOnPitch" type="range" min="261.63" max="523.3" step="0.01" value="440">
        <input id="astartOnPitchInput" type="number" value="440">
      </div>
      <div class="slider-row" title="Notes Per Octave" id="anpoDiv" style="display:none;">
        <label class="h2">Notes per octave</label>
        <input id="anpo" type="range" min="1" max="48" step="1" value="12">
        <input id="anpoInput" type="number" value="12" min="1" max="384">
      </div>
      <div id="phaseTextureDiv" class="slider-row" title="Phase texture">
        <label class="h2" for="phaseTexture">Phase texture</label>
        <select id="phaseTexture" style="width:117.5px;margin-right:15px;margin-left:50px;">
          <option value="Static" selected>Static</option>
          <option value="Harmonics">Harmonics</option>
          <option value="Flat">Flat</option>
          <option value="ImpulseAlign">Custom Impulse</option>
          <option value="FrameAlignedImpulse">Frame Impulse</option>
          <option value="ExpectedAdvance">Expected Advance</option>
          <option value="PhasePropagate">Phase Propagate</option>
          <option value="RandomSmall">Random Small</option>
          <option value="HarmonicStack">Harmonic Stack</option>
          <option value="LinearDelay">Linear Delay</option>
          <option value="Chirp">Chirp</option>
          <option value="CopyFromRef">Reference frame</option>
          <option value="HopArtifact">Hop Artifact</option>
          <option value="Custom">Custom</option>
        </select>

      </div>
      <div class="slider-row" title="Phase" id="phaseSettingsDiv">
          <label class="h2" id="phaseSettingsLabel"></label>
          <input id="phaseSettings"  type="range" min="0" max="0" value="0" step="0.01">
          <input id="phaseSettingsInput" type="number" value="0" min="0" max="0">
      </div>
      <div class="slider-row" title="Phase" id="phaseDiv">
          <label class="h2">Phase shift</label>
          <input id="phaseShift"  type="range" min="0" max="6.283" value="0" step="0.0001">
          <input id="phaseShiftInput" type="number" value="0" min="0" max="6.283">
      </div>
      <div class="slider-row" title="Phase strength" id="phaseStrengthDiv">
          <label class="h2">Phase Strength</label>
          <input id="phaseStrength"  type="range" min="0" max="1" value="1" step="0.001">
          <input id="phaseStrengthInput" type="number" value="1" min="0" max="1">
      </div>
    </div>
    </div>
    `,
  });
  newWindow({
      name:"Brushes",
      id:"brushesWindow",
      width:leftWidth,
      height:toolsHeight,
      docked:true,
      dockEdge:"left",
      dockTo:edgeDocks[0],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:0,
      top:30+infoHeight,
      showing:true,
      showHeader:true,
      innerHTML:`
      <h4 style="margin:0;">Tools</h4>
      <table style="background:#fff;width:90%;margin:5px;color:#000;border:none;border-spacing:0;" role="grid">
        <thead>
          <tr>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <button class="shape-btn" title="Brush (b)" data-shape="brush" id="brushBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="5 4 18 18" fill="#333"><path d="M20.71 4.63a2 2 0 0 0-2.83 0l-9.9 9.9a3 3 0 0 0-.78 1.37l-.69 2.76a1 1 0 0 0 1.21 1.21l2.76-.69a3 3 0 0 0 1.37-.78l9.9-9.9a2 2 0 0 0 0-2.83zm-11.24 11.3l-.88.22.22-.88 9.19-9.19.66.66z"/></svg>
              </button>
            </td>
            <td>
              <button title="Note brush (o)" class="shape-btn" id="noteBtn" data-shape="note">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20px" height="20px"><path fill="#333" d="M28.6,178.2c0,0-13.7,53.7-18.6,74.8l26.3-36c-2.4-5.3-0.9-13.4,3.2-17.9c5.6-6.1,15.6-6.1,21.7-0.5c6.2,5.6,6.5,15.1,1,21.2c-4.3,4.6-12.1,6.5-17.7,4.4l-32.9,30.9l69.3-26.8l27.8-41.7l-36.4-34.1L28.6,178.2z M223.3,1.4c-10.5,7.2-142,140.9-142,140.9l37,35.4c0,0,111.5-132,127.7-158.8C243.6-3.8,223.3,1.4,223.3,1.4z"/></svg>
              </button>
            </td>
            <td>
              <button class="shape-btn" title="Stamp (s)" data-shape="stamp" id="stampBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="1.25 1.25 17.5 17.5" > <g fill="#333" stroke="#333" stroke-width="2" stroke-linejoin="round" > <rect x="2.5" y="10" width="15" height="5" rx="2" ry="2" /> <line x1="10" y1="9" x2="10" y2="6" /> <rect x="8" y="4" width="4" height="3" rx="2" ry="2" /> </g> </svg>
              </button>
            </td>
            <td>
              <button class="shape-btn" title="Line (l)" data-shape="line" id="lineBtn" >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke = "#333" stroke-width = "3"><path d="M20 0 L 0 20"/></svg>
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <button class="shape-btn" title="Rectangle (r)" data-shape="rectangle" id="rectBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke = "#333" stroke-width = "5"><path d="M0 0 H 20 V 20 H 0 V -20"/></svg>
              </button>
            </td>
            <td>
              <button class="shape-btn" title="Image Overlay (i)" data-shape="image" id="imageBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="6" r="3" fill="#333" stroke="none"/><polygon points="1,20 8,10 15,20" fill="#333"/><polygon points="8,20 15,12 23,20" fill="#333"/></svg>
              </button>
            </td>
            <td>
              <button class="shape-btn" title="Selection Tool" data-shape="select" id="selectBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ><rect x="1" y="1" width="22" height="22" rx="3" ry="3" stroke-dasharray="3 5" /></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <h4 style="margin:0;">Effects</h4>
      <table style="background:#fff;width:90%;margin:5px;color:#000;border:none;border-spacing:0;" role="grid">
        <thead>
          <tr>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
            <th style="width:25%;"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <button class="tool-btn" data-tool="fill" id="colorBtn" title="Fill (f)" data-tool="color" id="colorBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#333"><circle cx="12" cy="12" r="9"/></svg>
              </button>
            </td>
            <td>
              <button class="tool-btn" data-tool="noiseRemover" id="noiseRemoverBtn" title="Noise Remover (x)">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"width="18.19" height="19.22" viewBox="0,0,18.19,19.22"><g transform="translate(-0.90,-0.39)"><g fill="#333333" stroke="none" stroke-miterlimit="10"><path d="M3.70,2.43l2.87,-2.04l7.13,10.01l-2.87,2.04z" stroke-width="NaN"/><path d="M0.90,4.90l3.08,-2.20l0.75,1.05l-3.08,2.20z" stroke-width="0"/><path d="M2.28,6.82l3.08,-2.20l0.75,1.05l-3.08,2.20z" stroke-width="0"/><path d="M3.73,8.91l3.08,-2.20l0.75,1.05l-3.08,2.20z" stroke-width="0"/><path d="M5.10,10.83l3.08,-2.20l0.75,1.05l-3.08,2.20z" stroke-width="0"/><path d="M6.45,12.73l3.08,-2.20l0.75,1.05l-3.08,2.20z" stroke-width="0"/><path d="M11.39,11.97l2.26,-1.61l5.44,7.64l-2.26,1.61z" stroke-width="NaN"/></g></g></svg>
              </button>
            </td>
            <td>
              <button class="tool-btn" data-tool="cloner" id="clonerBtn" title="Cloner (c)">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 23 23" > <g fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round" > <rect x="1.5" y="8.16" width="13.33" height="13.33" rx="2" ry="2" /> <rect x="8.16" y="1.5" width="13.33" height="13.33" rx="2" ry="2" /> </g> </svg>
              </button>
            </td>
            <td>
              <button class="tool-btn" data-tool="autotune" id="autotuneBtn" title="Autotune (shift+a)">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" role="img" aria-label="Pitchfork"><path d=" M 8 2.5 V 12 A 4 10 0 0 0 12 12 V 2.5 " stroke="#333" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" /><line x1="10" y1="14" x2="10" y2="17.5" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <button class="tool-btn" data-tool="amplifier" id="amplifierBtn" title="Amplifier / Reducer (a)">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 8V12C2 12.55 2.45 13 3 13H5L7 17C7.18 17.36 7.56 17.59 7.95 17.59C8.63 17.59 9.08 16.86 8.79 16.25L7.2 13H9L16 17V3L9 7H5V7H3C2.45 7 2 7.45 2 8Z" fill="#333"/><path d="M18 7C18.55 7 19 7.45 19 8V12C19 12.55 18.55 13 18 13" stroke="#333" stroke-width="1.2" stroke-linecap="round"/></svg>
              </button>
            </td>
            <td>
              <button class="tool-btn" data-tool="eraser" id="eraserBtn" title="Eraser (e)">
                <svg width="20" height="20" viewBox="-1 -1 16 16"><path d="M5,0 L0,5 L5,10 L10,5 Z " fill="#333" stroke="#333" stroke-width="1"/><path d="M5,10 L10,5 L15,10 L12,13 L8,13 Z" fill="white" stroke="#333" stroke-width="1"/></svg>
              </button>
            </td>
            <td>
              <button class="tool-btn" data-tool="blur" id="blurBtn" title="Blur (u)">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#333"><path d="M12 2C12 2 7 10 7 14a5 5 0 0 0 10 0c0-4-5-12-5-12z"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>`
  });
  newWindow({
      name:"Special Effects",
      id:"specialFXWindow",
      width:leftWidth,
      height:window.innerHeight-30-infoHeight-uploadsHeight-toolsHeight,
      docked:true,
      dockEdge:"left",
      dockTo:edgeDocks[0],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:0,
      top:30+infoHeight+toolsHeight,
      showing:true,
      showHeader:true,
      innerHTML:`<div class="toolsWrapper">
    <section class="toolSection" id="section-4">
      <div class="toolSection-header" role="button" aria-controls="content-4" aria-expanded="false">
        <button class="toggle-btn" onclick="this.blur()">
          <span class="char gt">&gt;</span>
        </button>
        <div>
          <div class="toolSection-title">Pitch Align</div>
        </div>
      </div>
      <div class="content-wrapper" id="content-4">
        <div class="panel-body">
          <label class="h1">Brush Alignment</label>
          <!--Auto align pitch-->
          <button class="leftBtn" id="alignPitch" title="Auto align pitch (j)">Auto Align Pitch</button>
          <div id="startOnPitchDiv" style="display:none;">
            <div class="slider-row" title="Base Pitch">
              <label class="h2">Base Hz</label>
              <input id="startOnPitch" type="range" min="261.63" max="523.3" step="0.01" value="440">
              <input id="startOnPitchInput" type="number" value="440">
            </div>
            <!--Notes per octave (achieve with pitch bends)-->
            <div class="slider-row" title="Notes Per Octave">
              <label class="h2">Notes per octave</label>
              <input id="npo" type="range" min="1" max="48" step="1" value="12">
              <input id="npoInput" type="number" value="12" min="1" max="384">
            </div>
          </div>
          <!--Auto align time-->
          <button class="leftBtn" id="alignTime" title="Auto align time (k)">Auto Align Time</button>
          <div id ="bpmDiv" class="slider-row" title="BPM" style="display:none;">
            <label class="h2">BPM</label>
            <input id="bpm" type="range" min="0.001" max="500" step="0.01" value="120">
            <input id="bpmInput" type="number" value="120" min="0.001" max="5000">
          </div>
        </div>
      </div>
    </section>
    <section class="toolSection" id="section-5">
      <div class="toolSection-header" role="button" aria-controls="content-5" aria-expanded="false">
        <button class="toggle-btn" onclick="this.blur()">
          <span class="char gt">&gt;</span>
        </button>
        <div>
          <div class="toolSection-title">Filters</div>
        </div>
      </div>
      <div class="content-wrapper" id="content-5">
        <div class="panel-body">
        </div>
      </div>
    </section>
    <section class="toolSection" id="section-6">
      <div class="toolSection-header" role="button" aria-controls="content-6" aria-expanded="false">
        <button class="toggle-btn" onclick="this.blur()">
          <span class="char gt">&gt;</span>
        </button>
        <div>
          <div class="toolSection-title">Advanced EQ</div>
        </div>
      </div>
      <div class="content-wrapper" id="content-6">
        <div class="panel-body">
          <div class="slider-row" title="Global gain" id="globalGainDiv">
            <label class="h2">Global gain</label>
            <input id="globalGain" type="range" min="-30" max="30" step="0.1" value="0">
            <input id="globalGainInput" type="number" value="0" min="-30" max="30">
          </div>
          <div class="slider-row" title="EQ Presets" id="eqPresetsDiv">
            <label class="h2" for="eqPresets">Presets</label>
            <select id="eqPresets" style="margin-right:15px;">
              <option value="Flat">Flat</option>
              <option value="Bass boost">Bass boost</option>
              <option value="Lowpass">Lowpass</option>
              <option value="Mid boost">Mid boost</option>
              <option value="Midpass">Midpass</option>
              <option value="High boost">High boost</option>
              <option value="Highpass">Highpass</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <canvas id="eqCanvas" width="300" height="440" style="border:1px solid #ccc; display:block; margin-top:10px;width:100%;"></canvas>
        </div>
      </div>
    </section>
  </div>`,
  });
  newWindow({
      name:"Info",
      id:"infoWindow",
      width:leftWidth,
      height:infoHeight,
      docked:true,
      dockEdge:"left",
      dockTo:edgeDocks[0],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:0,
      top:30,
      showing:true,
      showHeader:false,
      innerHTML:`<div style="border:1px solid #888; padding: 4px;" id="midiv" title="Hold 'n' to preview pitch"><label id="mouseInfo">Pitch: 0hz<br>Time: 0.0<br>Loudness: -inf dB</label><br></div>`,
  });
  newWindow({
      name:"Waveform",
      id:"waveformWindow",
      width:middleWidth,
      height:waveformHeight,
      docked:true,
      dockEdge:"top",
      dockTo:edgeDocks[3],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:leftWidth,
      top:30,
      showing:true,
      showHeader:false,
      innerHTML:`<canvas id="waveform" width="1000" style="margin-left:40px;width:calc(100% - 40px);height:100%;" height=${waveformHeight}>`,
  });
  newWindow({
      name:"mainArea",
      id:"main-area",
      width:window.innerWidth-rightWidth-leftWidth,
      height:window.innerHeight-waveformHeight-80-30,
      docked:true,
      dockEdge:"top",
      dockTo:edgeDocks[3],
      layer:1,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:leftWidth,
      top:waveformHeight+30,
      showing:true,
      showHeader:false,
      innerHTML:`<div id="canvasWrapper" style="width:100%; top:0px"></div>`,
  });
  const knobSVG = `<svg width="72" height="72" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="6"/>
        <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" />
        <line x1="50" y1="50" x2="50" y2="18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      </svg>`;
  newWindow({
      name:"bottomBar",
      id:"bottom-bar",
      width:window.innerWidth-rightWidth-leftWidth-eqWidth,
      height:80,
      docked:true,
      dockEdge:"bottom",
      dockTo:edgeDocks[3],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:leftWidth+eqWidth,
      top:window.innerHeight-80,
      showing:true,
      showHeader:false,
      innerHTML:`<div style="display:flex;flex-direction:row;height:100%;gap:5px;padding-left:5px;">
    <div class="knob-wrapper">
      <div class="knob" id="fftSize" data-knob="true" aria-hidden="true">${knobSVG}</div>
    </div>
    <button id="lockHopBtn" class="lock-btn" aria-pressed="true"
      title="Lock time resolution to prevent phase interference" style="background:none;border:none;margin:0;"
      onclick="toggleLockHop();">
    </button>
    <div class="knob-wrapper">
      <div class="knob" id="hopSize" data-knob="true" aria-hidden="true">${knobSVG}</div>
    </div>
    <div class="knob-wrapper">
      <div class="knob" id="masterVolume" data-knob="true" aria-hidden="true">${knobSVG}</div>
    </div>
    <div class="knob-wrapper">
      <button id="playPause" title="Play (space)" style="background:linear-gradient(180deg,#2b2b2b,#161616);border:0;border-radius:50%;width:75px;height:75px;" onClick="this.blur();">
        <svg xmlns="http://www.w3.org/2000/svg" fill="#333" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="6"/>
          <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" />
          <path d="M40 70 V30 l30 20z"/ fill="#fff">
        </svg>
      </button>
    </div>
    <div class="knob-wrapper">
      <div class="knob" id="emptyAudioLength" data-knob="true" aria-hidden="true">${knobSVG}</div>
    </div>
  </div>`,
  });
  newWindow({
      name:"Sprites Editor",
      id:"spritesEditorWindow",
      width:rightWidth,
      height:spritesHeight,
      docked:true,
      dockEdge:"right",
      dockTo:edgeDocks[1],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth-rightWidth,
      top:30+brushSettingsHeight,
      showing:true,
      showHeader:true,
      innerHTML:`<div id="spriteTableWrap">
        <table id="spriteTable" role="grid" aria-label="Sprites table">
          <thead>
            <tr>
              <th style="width:55%;">Name</th>
              <th style="width:15%;">Enabled</th>
              <th style="width:30%;">Effect</th>
            </tr>
          </thead>
          <tbody id="spriteTableBody">
            <!-- rows inserted dynamically -->
          </tbody>
        </table>
      </div>
      <div id="spriteEditor" disabled>
        <div class="spriteEditorRow" style="gap: 12px;align-items: center;height:3rem;">
          <button id="moveSpriteBtn" class="leftBtn">Move Sprite</button>
          <button id="deleteSpriteBtn" class="leftBtn" style="color:Red;">Delete Sprite</button>
        </div>
        <div class="slider-row"><label for="spriteName">Name:</label><input type="text" id="spriteName" value="No sprite selected"></input></div>
        <div class="slider-row"><label for="spriteEnabled">Enabled:</label><input type="checkbox" id="spriteEnabled"></input></div>
        <div class="slider-row" id="spriteEffectDiv"><label for="spriteEffect" id="stlb">Effect:</label><select id="spriteEffect">
          <option value="fill">Fill</option>
          <option value="noiseRemover">Noise Remover</option>
          <option value="autotune">Autotune</option>
          <option value="amplifier">Amplifier</option>
          <option value="eraser">Eraser</option>
          <option value="blur">Blur</option>
        </select></div>
        <div class="slider-row" id="spriteLayerDiv" style="display:none;"><label for="spriteLayer">Layer:</label><select id="spriteLayer">
          <option value="0">0</option>
          <option value="all">All</option>
        </select></div>
        <div id="spriteEffectSettings">
          <h3>
            Effect settings
            <button type="button"
                    class="section-toggle"
                    data-target="spriteEffectSettings"
                    aria-expanded="true"
                    aria-label="Toggle Effect settings"
                    id="effectSettingsToggleBtn"></button>
          </h3>
          <div class="slider-row" title="Brightness" id="sbrushBrightnessDiv">
              <label class="h2">Brush Brightness</label>
              <input id="sbrushBrightness" type="range" min="0" max="255" value="255">
              <input id="sbrushBrightnessInput" type="number" value="255" min="0" max="255">
          </div>
          <div class="slider-row" title="Blur Radius" id="sblurRadiusDiv">
              <label class="h2">Blur Radius</label>
              <input id="sblurRadius"  type="range" min="0" max="10" value="1.5" step="0.1">
              <input id="sblurRadiusInput" type="number" value="1.5" min="0" max="10">
          </div>
          <div class="slider-row" title="Blur Radius" id="samplifyDiv">
              <label class="h2">Amplifier</label>
              <input id="samp"  type="range" min="0" max="2" value="2" step="0.01">
              <input id="sampInput" type="number" value="2" min="0" max="2">
          </div>
          <div class="slider-row" title="Noise remover aggressiveness" id="snoiseAggDiv">
              <label class="h2">Aggressiveness</label>
              <input id="snoiseAgg"  type="range" min="0" max="8" value="5" step="0.1">
              <input id="snoiseAggInput" type="number" value="5" min="0" max="8">
          </div>
          <div class="slider-row" id="ssetNoiseProfileDiv" style="display:none;">
            <button id="ssetNoiseProfile" class="leftBtn">Set noise profile frames</button>
            <input id="ssetNoiseProfileMin" type="number" value="0" min="0" max="435">
            <input id="ssetNoiseProfileMax" type="number" value="0" min="0" max="435">
          </div>
          <div class="slider-row" title="Autotune strength" style="display:none;" id="sautoTuneStrengthDiv">
              <label class="h2">Autotune strength</label>
              <input id="sautoTuneStrength"  type="range" min="0" max="1" value="1" step="0.01">
              <input id="sautoTuneStrengthInput" type="number" value="1" min="0" max="1">
          </div>
          <div class="slider-row" title="Base Pitch" id="sstartOnPitchDiv" style="display:none;">
            <label class="h2">Base Hz</label>
            <input id="sstartOnPitch" type="range" min="261.63" max="523.3" step="0.01" value="440">
            <input id="sstartOnPitchInput" type="number" value="440">
          </div>
          <div class="slider-row" title="Notes Per Octave" id="snpoDiv" style="display:none;">
            <label class="h2">Notes per octave</label>
            <input id="snpo" type="range" min="1" max="48" step="1" value="12">
            <input id="snpoInput" type="number" value="12" min="1" max="384">
          </div>
          <div id="sphaseTextureDiv" class="slider-row" title="Phase texture">
            <label class="h2" for="sphaseTexture">Phase texture</label>
            <select id="sphaseTexture">
              <option value="Static" selected>Static</option>
              <option value="Harmonics">Harmonics</option>
              <option value="Flat">Flat</option>
              <option value="ImpulseAlign">Custom Impulse</option>
              <option value="FrameAlignedImpulse">Frame Impulse</option>
              <option value="ExpectedAdvance">Expected Advance</option>
              <option value="PhasePropagate">Phase Propagate</option>
              <option value="RandomSmall">Random Small</option>
              <option value="HarmonicStack">Harmonic Stack</option>
              <option value="LinearDelay">Linear Delay</option>
              <option value="Chirp">Chirp</option>
              <option value="CopyFromRef">Reference frame</option>
              <option value="HopArtifact">Hop Artifact</option>
              <option value="HopArtifact">Custom</option>
            </select>
          </div>
          <div class="slider-row" title="Phase" id="sphaseSettingsDiv">
              <label class="h2" id="sphaseSettingsLabel"></label>
              <input id="sphaseSettings"  type="range" min="0" max="0" value="0" step="0.01">
              <input id="sphaseSettingsInput" type="number" value="0" min="0" max="0">
          </div>
          <div class="slider-row" title="Phase" id="sphaseDiv">
              <label class="h2">Phase shift</label>
              <input id="sphaseShift"  type="range" min="0" max="6.283" value="0" step="0.0001">
              <input id="sphaseShiftInput" type="number" value="0" min="0" max="6.283">
          </div>
          <div class="slider-row" title="Brightness strength" id="sbrushOpacityDiv">
              <label class="h2">Opacity</label>
              <input id="sbrushOpacity"  type="range" min="0" max="1" value="1" step="0.01">
              <input id="sbrushOpacityInput" type="number" value="1" min="0" max="1">
          </div>
          <div class="slider-row" title="Phase strength" id="sphaseStrengthDiv">
              <label class="h2">Phase Strength</label>
              <input id="sphaseStrength"  type="range" min="0" max="1" value="0" step="0.01">
              <input id="sphaseStrengthInput" type="number" value="0" min="0" max="1">
          </div>
          <div class="slider-row" title="Width" id="sWidthDiv">
              <label class="h2">Selection Width</label>
              <input id="sWidth"  type="range" min="0" max="468" value="0" step="1">
              <input id="sWidthInput" type="number" value="0" min="0" max="468">
          </div>
          <div class="slider-row" title="Height" id="sHeightDiv">
              <label class="h2">Selection Height</label>
              <input id="sHeight"  type="range" min="0" max="2048" value="0" step="1">
              <input id="sHeightInput" type="number" value="0" min="0" max="2048">
          </div>
        </div>
        <div id="spriteFadeDiv">
          <h3>
            Fade
            <button type="button"
                    class="section-toggle"
                    data-target="spriteFadeDiv"
                    aria-expanded="true"
                    aria-label="Toggle Fade"></button>
          </h3>
          <canvas id="spriteFadeCanvas" style="border:1px solid #ccc; display:block; margin-top:10px;width:100%;"></canvas>
        </div>
      </div>`,
  });
  newWindow({
      name:"MIDI Export",
      id:"midiExportWindow",
      width:300,
      height:240,
      docked:false,
      dockEdge:"none",
      dockTo:null,
      layer:1,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth/2-150,
      top:window.innerHeight/2-120,
      showing:false,
      showHeader:true,
      innerHTML:`<input type="checkbox" id="useMidiAI" title="Use AI model (Ideal for songs)">Use BasicPitch AI</input>
          <div class="slider-row" title="Duration cutoff">
            <label class="h2">Duration cutoff (secs)</label>
            <input id="durationCutoff" type="range" min="0" max="1" step="0.001" value="0.05">
            <input id="durationCutoffInput" type="number" value="0.05" min="0" max="1">
          </div>
          <div id="nonAiMidiDiv">
            <!--Noise floor cutoff-->
            <div class="slider-row" title="Noise floor cutoff">
              <label class="h2">Noise floor (dB)</label>
              <input id="noiseFloorCutoff" type="range" min="-50" max="0" step="0.1" value="-30">
              <input id="noiseFloorCutoffInput" type="number" value="-30" min="-50" max="0">
            </div>
            <input type="checkbox" id="midiAlignTime" title="Midi export time filter" checked>Align to tempo</input>
            <div id="matOptions">
              <div id ="midiBpmDiv" class="slider-row" title="Note BPM">
                <label class="h2">BPM</label>
                <input id="midiBpm" type="range" min="0.001" max="500" step="0.01" value="120">
                <input id="midiBpmInput" type="number" value="120" min="0.001" max="5000">
              </div>
              <div id ="subBeatDiv" class="slider-row" title="Sub beats">
                <label class="h2">Sub beats</label>
                <input id="subBeat" type="range" min="1" max="24" step="1" value="8">
                <input id="subBeatInput" type="number" value="8" min="1" max="24">
              </div>
            </div>
            <button class="leftBtn" title="Use volume controllers (Not recommended)" id="useVolumeControllers">Use Volume Controllers</button>
          </div>
          <div id="AiMidiDiv" style="display:none;">
            <label class="h1">Time Quantize</label>
            <div class="slider-row" title="Time quantize strength">
              <label class="h2">Strength</label>
              <input id="tQs" type="range" min="0" max="100" step="1" value="0">
              <input id="tQsInput" type="number" value="0" min="0" max="100">
            </div>
            <div class="slider-row" title="Time quantize strength">
              <label class="h2">Tempo</label>
              <input id="tQt" type="range" min="1" max="300" step="1" value="120">
              <input id="tQtInput" type="number" value="120" min="1" max="300">
            </div>
            <div class="slider-row" title="Phase texture">
              <label class="h2" for="tQd">Time division</label>
              <select id="tQd">
                <option value="1">1/1</option>
                <option value="2">1/2</option>
                <option value="3">1/3</option>
                <option value="4">1/4</option>
                <option value="5">1/5</option>
                <option value="6">1/6</option>
                <option value="7">1/7</option>
                <option value="8" selected="selected">1/8</option>
                <option value="12">1/12</option>
                <option value="16">1/16</option>
                <option value="24">1/24</option>
                <option value="32">1/32</option>
              </select>
            </div>
          </div>
          <div id="midiLayerSettings">
            <label class="h1">Midi audio layers</label>
            <div style="display:flex; gap:10px; margin-bottom:5px;" title="Layer mode">
              <label class="h2" for="midiLayerMode">Mode</label>
              <select id="midiLayerMode">
                <option value="all">All layers</option>
                <option value="allMixToMono">All layers mixed to mono</option>
                <option value="single">Single layer</option>
              </select>
            </div>
            <div class="slider-row" id="midiSingleLayerDiv" style="display:none;">
              <label class="h2" for="midiSingleLayer">Layer</label>
              <select id="midiSingleLayer"></select>
            </div>
          </div>
          <button class="leftBtn" id="removeHarmonicsBtn" title="Auto Remove Harmonics" onClick="removeHarmonics()">Remove Harmonics</button>
          <button class="leftBtn" id="exportMIDI" title="Export Midi (ctrl + m)" onclick="exportMidi()">Export MIDI</button>`,
  });
  newWindow({
      name:"Uploads",
      id:"uploadsWindow",
      width:leftWidth,
      height:window.innerHeight-30-infoHeight-toolsHeight-specialFxHeight,
      docked:true,
      dockEdge:"left",
      dockTo:edgeDocks[0],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:0,
      top:30+infoHeight+toolsHeight+specialFxHeight,
      showing:true,
      showHeader:true,
      innerHTML:`
      <section class="toolSection" id="section-1">
        <div class="toolSection-header" role="button" aria-expanded="false" id="audioSamplesSection">
          <button class="toggle-btn" id="audioSamplesToggle">
            <span class="char gt">&gt;</span>
          </button>
          <div>
            <div class="toolSection-title">Audio samples</div>
          </div>
        </div>
        <div class="content-wrapper">
          <div class="panel-body">
            <div id="uploadsWrapper"></div>
          </div>
        </div>
      </section>
      <section class="toolSection">
        <div class="toolSection-header" role="button" aria-expanded="false">
          <button class="toggle-btn" onclick="this.blur()">
            <span class="char gt">&gt;</span>
          </button>
          <div>
            <div class="toolSection-title">Layer samples</div>
          </div>
        </div>
        <div class="content-wrapper">
          <div class="panel-body">
            <div id="layersSampleWrapper"></div>
          </div>
        </div>
      </section>
      <section class="toolSection">
        <div class="toolSection-header" role="button" aria-expanded="false">
          <button class="toggle-btn" onclick="this.blur()">
            <span class="char gt">&gt;</span>
          </button>
          <div>
            <div class="toolSection-title">Overlay Images</div>
          </div>
        </div>
        <div class="content-wrapper">
          <div class="panel-body">
            <div class="image-gallery" id="imageGallery" role="list" aria-label="Images gallery">
          </div>
        </div>
      </section>`,
  });
  newWindow({
      name:"Preferences",
      id:"preferencesWindow",
      width:300,
      height:240,
      docked:false,
      dockEdge:"none",
      dockTo:null,
      layer:1,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth/2-150,
      top:window.innerHeight/2-120,
      showing:false,
      showHeader:true,
      innerHTML:`<div class="slider-row" title="Playback volume">
              <label class="h2">Playback volume</label>
              <input id="playbackVolume"  type="range" min="0" max="1" value="1" step="0.01">
              <input id="playbackVolumeInput" type="number" value="1" min="0" max="1">
          </div>
          <div class="slider-row" title="Oscillator Volume while drawing">
              <label class="h2">Draw volume</label>
              <input id="drawVolume"  type="range" min="0" max="1" value="1" step="0.01">
              <input id="drawVolumeInput" type="number" value="1" min="0" max="1">
          </div>
          <hr>
          <div style="align-items:center;display:flex;flex-direction:column;">
            <button id="trueScale" title="Use true aspect ratio" class="leftBtn">Use true scale</button>
            <button id="downloadSpectrogram" title="Download spectrogram (ctrl + shift + s)" class="leftBtn">Download Spectrogram</button>
            <button id="downloadVideo" title="Download video" class="leftBtn">Download video</button>
            <button id="yAxisMode" title="Toggle Y axis label mode (y)" class="leftBtn">Display Notes</button><br>
          </div>`,
  });
  newWindow({
      name:"EQ",
      id:"eqWindow",
      width:eqWidth,
      height:80,
      docked:true,
      dockEdge:"bottom",
      dockTo:edgeDocks[3],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:leftWidth,
      top:window.innerHeight-80,
      showing:true,
      showHeader:false,
      innerHTML:`<canvas id="eqCanvas2" width="${eqWidth}" style="width:100%;height:100%;" height="80"></canvas>`
  });
  newWindow({
      name:"Layers",
      id:"layersWindow",
      width:320,
      height:340,
      docked:false,
      dockEdge:"none",
      dockTo:null,
      layer:1,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth/2-160,
      top:window.innerHeight/2-170,
      showing:false,
      showHeader:true,
      innerHTML:`
      <div class="slider-row"><label for="layers">Layers:</label>
        <input type="range" id="layers" min="1" max="16" value="1">
        <input id="layersInput" type="number" value="1" min="1" max="16">
      </input></div>
      <div class="slider-row" title="Layer Display Height" id="chdiv">
        <label class="h2">Layer height</label>
        <input id="layerHeight" type="range" min="0" max="500" step="1" value="500">
        <input id="layerHeightInput" type="number" value="500" min="0" max="500">
      </div>
      <div class="slider-row" title="Sync actions to all layers">
        <label class="h2">Sync layers</label>
        <input id="syncLayers" type="checkbox">
      </div>
      <div id="layersMixerDiv"></div>`
  });
})();
function getLayerHeight(){
  return parseInt(panels[5].obj.style.height);
}
/*
brushSettings: 0
brushes: 1
specialFX: 2
info: 3

waveform: 4
main-area: 5
bottom-bar: 6

sprites: 7
midiExport: 8
uploads: 9
preferences: 10
eq: 11
layers: 12
*/