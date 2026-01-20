(function() {
  let panels = [];
  let baseTop = 30;
  let edgeThickness = 5;
  let edgeDocks = [
    { left: 0,                             top: baseTop, axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([]), thickness: [200], name:"left" }, 
    { left: window.innerWidth - edgeThickness, top: baseTop, axis: "vertical",   length: window.innerHeight - baseTop, panels: new Array([]), thickness: [200], name:"right" }, 
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
    panelObj.style.border = "1px solid #555";
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
    panelObj.innerHTML = `
    <div style="height:${topbar}px;border-bottom:1px solid #888;display:flex;flex-direction:row;">
      <p style="color:white;font-family:'Inter',system-ui,sans-serif;margin:0;align-self:center;margin-left:5px;">${opts.name}</p>
      <div style="display:flex;margin-left:auto;">
        <button id="${panels.length}popOut" style="background:none;border:none;display:${opts.docked?"block":"none"};">${popOutSVGs[opts.dockEdge]}</button>
        <button id="${panels.length}minimize" style="background:none;border:none;display:${opts.docked?"none":"block"}">${minimizeSvg}</svg>
        </button>
        <button id="${panels.length}close" style="background:none;border:none;">
          <svg width="20" height="${topbar}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <line x1="16" y1="16" x2="4" y2="4" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
    `
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
    if (opts.docked && opts.dockTo) {
      const id = panels.indexOf(opts);
      if (id !== -1) {
        const {idx, layer} = findDockEntry(opts.dockTo, id);
        if (idx === -1) {
          const typeVal = (opts.dockEdge === "left" || opts.dockEdge === "top") ? 0 : 1;
          setDocked(panels[id], { edge: opts.dockTo, type: typeVal, off:0, layer:0 });
        }
      }
    }
  }
  newWindow({
      name:"Brush Editor",
      id:"brushEditorWindow",
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
  });
})();