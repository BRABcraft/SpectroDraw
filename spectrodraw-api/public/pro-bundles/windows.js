(function() {
  let panels = [];
  let baseTop = 30;
  let edgeThickness = 5;
  let edgeDocks = [
    { left: 0,                             top: baseTop, axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([{panelIndex:2, size:75},{panelIndex:1, size:window.innerHeight-105}]), thickness: [200], name:"left" }, 
    { left: window.innerWidth - edgeThickness, top: baseTop, axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([]), thickness: [300], name:"right" }, 
    { left: 0,                             top: baseTop, axis: "horizontal", length: window.innerWidth,            panels: new Array([]), thickness: [200], name:"top" }, 
    { left: 0,    top: window.innerHeight - edgeThickness, axis: "horizontal", length: window.innerWidth,            panels: new Array([]), thickness: [200], name:"bottom" }, 
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
    panelObj.style.boxShadow = opts.docked?"none":"0 0 20px rgba(0,0,0,0.5)";
    panelObj.style.overflow = "hidden";
    panelObj.style.border = opts.useBorders?"1px solid #555":"none";
    panelObj.style.zIndex=opts.docked?"0":"999999";
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
    panelObj.innerHTML = opts.useBorders?`
    <div style="height:${topbar}px;border-bottom:1px solid #888;display:flex;flex-direction:row;">
      <p style="color:white;font-family:'Inter',system-ui,sans-serif;margin:0;align-self:center;margin-left:5px;">
      <div style="display:flex;margin-left:auto;">
        <button id="${panels.length}popOut" style="background:none;border:none;display:${opts.docked?"block":"none"};">${popOutSVGs[opts.dockEdge]}</button>
        <button id="${panels.length}minimize" style="background:none;border:none;display:${opts.docked?"none":"block"}">${minimizeSvg}</svg></button>
        <button id="${panels.length}close" style="background:none;border:none;">${closeSVG}</button>
      </div>
    </div>
    ${opts.innerHTML}
    `:` ${opts.innerHTML}
    <div style="position:absolute;top:0px;display:flex;flex-direction:row;z-index:999999999999;right:0px;">
        <button id="${panels.length}popOut" style="background:none;border:none;display:${opts.docked?"block":"none"};">${popOutSVGs[opts.dockEdge]}</button>
        <button id="${panels.length}minimize" style="background:none;border:none;display:${opts.docked?"none":"block"}">${minimizeSvg}</svg></button>
        <button id="${panels.length}close" style="background:none;border:none;">${closeSVG}</button>
        </div>`;
    opts.obj = panelObj;
    panels.push(opts);
    document.body.appendChild(panelObj);
    function getPanelId(panelObj){return parseInt(panelObj.getAttribute("idx"));}
    function setX(panel,x){
      if (x>window.innerWidth-120) x = window.innerWidth-120;
      if (x<120-panel.width) x = 120-panel.width;
      panel.obj.style.left=panel.left=(x+"px");
    }
    function setY(panel,y){
      if (y>window.innerHeight-50) y = window.innerHeight-50;
      if (y<50-panel.height) y = 50-panel.height;
      panel.obj.style.top=panel.top=(y+"px");
    }
    function goTo(panel,x,y){
      setX(panel,x);
      setY(panel,y);
    }
    function setWidth(panel,w){
      if (w<120) w = 120;
      panel.obj.style.width=panel.width=w;
    }
    function setHeight(panel,h){
      if (h<topbar) h = topbar;
      panel.obj.style.height=panel.height=h;
    }
    function hitEdge(panel,hitX,hitY){
      const w = panel.width;
      const h = panel.height;
      const tolerance = 5;
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
    const popOutEl = document.getElementById(getPanelId(panelObj)+"popOut");
    const minimizeEl = document.getElementById(getPanelId(panelObj)+"minimize");
    const closeEl = document.getElementById(getPanelId(panelObj)+"close");
    const toggleButton = document.getElementById(opts.id+"Toggle");
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
      if (panel.dockTo) {
        const dock = panel.dockTo;
        const {idx, layer} = findDockEntry(dock, id);
        const preCount = dock.panels[layer].length;
        if (idx !== -1) {
          dock.panels[layer].splice(idx, 1);
          if (layer>0&&dock.panels[layer].length===0){
            dock.panels.splice(layer,1);
            dock.thickness.splice(layer,1);
          }
          recomputeEdgeBounds();
          layoutDock(dock);
        }
        if (panel.dockEdge === "left" || panel.dockEdge === "right") { setHeight(panel, panel.height * 0.8); setY(panel, panel.top + 50); }
        if (panel.dockEdge === "top" || panel.dockEdge === "bottom") { setWidth(panel, panel.width * 0.8); setX(panel, panel.left + 50); }
        if (panel.dockEdge === "left") setX(panel, panel.left + 250);
        if (panel.dockEdge === "right") setX(panel, panel.left - 250);
        if (panel.dockEdge === "top") setY(panel, panel.top + 250);
        if (panel.dockEdge === "bottom") setY(panel, panel.top - 250);
        panelObj.style.zIndex = "999999";
        panelObj.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
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
      panel.obj.style.boxShadow = "none";
      recomputeEdgeBounds();
      for (let d of edgeDocks) if (d.panels[0].length) {layoutDock(d);}
      panel._savedDock = null;
    }
    function toggleWindow(toggleButton){
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
        if (toggleButton) toggleButton.style.background = "var(--accent-gradient)";
      } else {
        panel.showing = true;
        panelObj.style.display = "block";
        if (toggleButton) toggleButton.style.background = "linear-gradient(90deg,orange,yellow)";
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
            const py = panel.top + sign*offY;
            const pyB = panel.top + panel.height + sign*offY;
            const inTopSpan = (py > edge.top && py < (edge.top + edgeThickness));
            const inBottomSpan = (pyB > edge.top && pyB < (edge.top + edgeThickness));
            const inHSpanLeft = (px >= edge.left && px <= (edge.left + edge.length));
            const inHSpanRight = (pxR >= edge.left && pxR <= (edge.left + edge.length));
            if (inTopSpan && inHSpanLeft) return {edge,type:0,layer:p,off:offY};
            if (inBottomSpan && inHSpanRight) return {edge,type:1,layer:p,off:-offY};
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
            total += p.size;
          }
          if (total === 0) continue;
          if (total !== edge.length) {
            for (let p of edgePanel) clampToLength(edge,p,p.size*(edge.length/total));
          }
        }
      }
    }
    function setDocked(panel, dockObj){ 
      const dock = dockObj.edge;
      const id = panels.indexOf(panel);
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
      popOutEl.style.display = "block";
      minimizeEl.style.display = "none";
      if (dockObj.type === 0) { panel.dockEdge = (dock.axis === "vertical") ? "left" : "top"; }
      else { panel.dockEdge = (dock.axis === "vertical") ? "right" : "bottom"; }
      popOutEl.innerHTML = popOutSVGs[panel.dockEdge];
      panel.obj.style.boxShadow = "none";
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
            const delta = e.clientX - rd.startX;
            let newA = rd.aStart + delta;
            let newB = rd.bStart - delta;
            const minSz = 120;
            if (newA < minSz) { newB -= (minSz - newA); newA = minSz; }
            if (newB < minSz) { newA -= (minSz - newB); newB = minSz; }
            dock.panels[0][rd.aIdx].size = newA;
            dock.panels[0][rd.bIdx].size = newB;
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
    closeEl.addEventListener("click",()=>{toggleWindow(toggleButton);});
    if (toggleButton) toggleButton.addEventListener("click",()=>{toggleWindow(toggleButton);});
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
      width:300,
      height:window.innerHeight-30,
      docked:true,
      dockEdge:"right",
      dockTo:edgeDocks[1],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:window.innerWidth-300,
      top:30,
      showing:true,
      useBorders:true,
      innerHTML:`<h2 style="margin:10px 0 10px 0;">Brush settings</h2>
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
                  id="brushHarmonicsEditorDivToggleBtn"></button>
        </h3>
        <canvas id="harmonicsEditor" width="280" height="140" style="border:1px solid #ccc; margin-top:10px;"></canvas>
      </div>
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
        <select id="phaseTexture" style="width:137.5px;">
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
    `,
  });
  newWindow({
      name:"Tools",
      id:"toolsWindow",
      width:300,
      height:window.innerHeight-105,
      docked:true,
      dockEdge:"left",
      dockTo:edgeDocks[0],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:0,
      top:105,
      showing:true,
      useBorders:true,
      innerHTML:`<h2 style="margin:10px 0 10px 0;">Project</h2>
      <div class="slider-row"><label for="projectName">Name:</label><input type="text" id="projectName" value="Untitled"></input></div>
      <div id="fftParameters">
        <label class="h1">FFT Parameters
          <a id="fftLearnMore" class="learn-more" href="/faq/fft/#notes" title="Learn more about FFT / STFT" target="_blank" rel="noopener noreferrer" style="color:#777;font-size:10px;display:inline-block;transform:translateY(-1px)">Learn more</a>
        </label>
        <div class="slider-row">
          <label class="h2" title="Height of spectrogram in pixels.">Pitch resolution:</label>
          <select id="fftSize" style="margin-left:87px;">
            <option value="16384">16384</option>
            <option value="8192">8192</option>
            <option value="4096" selected>4096</option>
            <option value="2048">2048</option>
            <option value="1024">1024</option>
            <option value="512">512</option>
            <option value="256">256</option>
            <option value="128">128</option>
            <option value="64">64</option>
          </select>
        </div>
        <div class="slider-row" style="align-items:center;">
          <label class="h2" title="Number of audio samples given to each frame (x pixel).">Time resolution:</label>
          <button id="lockHopBtn" class="lock-btn" aria-pressed="true" title="Lock time resolution to prevent phase interference" style="background:none; border:none; margin-left:55px;" onclick="toggleLockHop();"></button>
          <input id="hopSize" type="number" value="1024" step="1" min="1" style="margin-left: 8px;">
        </div>
      </div>
      <hr>
      </label>
      <div id ="emptyAudioLengthDiv" class="slider-row" title="Buffer length">
        <label class="h2">Buffer length</label>
        <input id="emptyAudioLength" type="range" min="0.01" max="600" step="0.01" value="10">
        <input id="emptyAudioLengthInput" type="number" value="10" min="0.01" max="600">
      </div>
      <div class="slider-row" title="Playback volume">
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
      <button class="leftBtn" id="saveProject">Save</button>
      <button class="leftBtn" id="startNewProjectBtn">Save and start new project</button>
      <button class="leftBtn" id="saveAndOpenProject">Open project</button>
      <input type="file" id="openProject" accept=".zip*" style="display:none;">
      <div id="presetsModal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.5); justify-content:center; align-items:center;z-index:69420;">
        <div class="modal-content" style="background:#222; padding:20px; border-radius:8px; max-width:300px; width:90%;">
          <h2>New Project</h2>
          <label class="h2" for="presets">Use preset...</label>
          <select id="presets">
            <option value="silence">Silence</option>
            <option value="male">Male sing</option>
            <option value="female">Female sing</option>
            <option value="dog">Dog</option>
            <option value="birdChirp">Bird chirp</option>
            <option value="lionRoar">Lion roar</option>
            <option value="seaLion">Sea lion</option>
            <option value="violin">Violin</option>
            <option value="trumpet">Trumpet</option>
            <option value="timpani">Timpani</option>
            <option value="piano">Piano</option>
            <option value="flute">Flute</option>
            <option value="cymbal">Cymbal</option>
            <option value="computerBeeps">Computer beeps</option>
            <option value="scream">Scream</option>
            <option value="bomb">Bomb</option>
            <option value="engine">Engine</option>
            <option value="fullSpectra">Loud noise</option>
            <option value="bass808">808 bass</option>
            <option value="hardstyle">Hardstyle</option>
            <option value="kick">Kick</option>
            <option value="hihat">Hihat</option>
            <option value="clap">Clap</option>
            <option value="cave14">Cave14.ogg</option>
            <option value="sine">Sine wave</option>
            <option value="triangle">Triangle wave</option>
            <option value="square">Square wave</option>
            <option value="saw">Saw wave</option>
          </select>
          <div style="margin-top:15px; text-align:right;">
            <button id="closeProjectModalBtn" class="leftBtn" style="width:40%;padding:5px;height:1.5rem;">Cancel</button>
            <button id="saveAndStart" class="leftBtn" style="width:40%;padding:5px;height:1.5rem;">Save and start</button>
          </div>
        </div>
      </div>
      <hr>
      <button id="trueScale" title="Use true aspect ratio" class="leftBtn">Use true scale</button>
      <button id="downloadSpectrogram" title="Download spectrogram (ctrl + shift + s)" class="leftBtn">Download Spectrogram</button>
      <button id="downloadVideo" title="Download video" class="leftBtn">Download video</button>
      <button id="yAxisMode" title="Toggle Y axis label mode (y)" class="leftBtn">Display Notes</button><br>`,
  });
  
  newWindow({
      name:"Info",
      id:"infoWindow",
      width:300,
      height:75,
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
      useBorders:false,
      innerHTML:`<div style="border:1px solid #888; padding: 4px; margin-top:-11px" id="midiv" title="Hold 'n' to preview pitch"><label id="mouseInfo">Pitch: 0hz<br>Time: 0.0<br>Loudness: -inf dB</label><br></div>`,
  });
  newWindow({
      name:"Waveform",
      id:"waveformWindow",
      width:window.innerWidth-600,
      height:80,
      docked:true,
      dockEdge:"top",
      dockTo:edgeDocks[3],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:300,
      top:30,
      showing:true,
      useBorders:false,
      innerHTML:``,
  });
  newWindow({
      name:"mainArea",
      id:"main-area",
      width:window.innerWidth-600,
      height:window.innerHeight-190,
      docked:true,
      dockEdge:"top",
      dockTo:edgeDocks[3],
      layer:1,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:300,
      top:110,
      showing:true,
      useBorders:false,
      innerHTML:`<div id="canvasWrapper" style="width:100%; top:0px"></div>`,
  });
  newWindow({
      name:"bottomBar",
      id:"bottom-bar",
      width:window.innerWidth-600,
      height:80,
      docked:true,
      dockEdge:"bottom",
      dockTo:edgeDocks[4],
      layer:0,
      hit:"none",
      moving:false,
      resizing:false,
      minimized:false,
      left:300,
      top:window.innerHeight-80,
      showing:true,
      useBorders:false,
      innerHTML:`<p>PPPPPPPPPPPPPPPPPPP</p>`,
  });
})();