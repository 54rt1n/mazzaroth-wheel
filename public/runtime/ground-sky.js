/* Observer-centred perspective sky. Catalogue positions are supplied by the atlas. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GroundSky = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEG = Math.PI / 180, NEAR = 1e-6;
  const DEFAULT_VIEW = Object.freeze({ azimuth: 180, altitude: 20, fov: 100 });
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const wrap = n => ((n % 360) + 360) % 360;
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeView(view = {}) {
    return {
      azimuth: wrap(numberOr(view.azimuth, DEFAULT_VIEW.azimuth)),
      altitude: clamp(numberOr(view.altitude, DEFAULT_VIEW.altitude), -90, 90),
      fov: clamp(numberOr(view.fov, DEFAULT_VIEW.fov), 25, 120)
    };
  }

  // Local vector order is east, north, up. Azimuth increases from north to east.
  function horizontalVector(altitude, azimuth) {
    const h = altitude * DEG, a = azimuth * DEG, ch = Math.cos(h);
    return [ch * Math.sin(a), ch * Math.cos(a), Math.sin(h)];
  }

  function cameraBasis(view) {
    const v = normalizeView(view), a = v.azimuth * DEG, h = v.altitude * DEG;
    return {
      forward: horizontalVector(v.altitude, v.azimuth),
      right: [Math.cos(a), -Math.sin(a), 0],
      up: [-Math.sin(h)*Math.sin(a), -Math.sin(h)*Math.cos(a), Math.cos(h)]
    };
  }

  function projectionContext(view, width, height) {
    const v = normalizeView(view), basis = cameraBasis(v);
    const tanH = Math.tan(v.fov * DEG / 2), focal = width / (2 * tanH);
    return { ...basis, width, height, focal, tanH, tanV: height / (2 * focal) };
  }

  function cameraVector(vector, p) {
    return [dot(vector, p.right), dot(vector, p.up), dot(vector, p.forward)];
  }

  function projectCamera(v, p) {
    if (v[2] < NEAR) return null;
    const x = p.width/2 + p.focal*v[0]/v[2];
    const y = p.height/2 - p.focal*v[1]/v[2];
    return { x, y, depth: v[2], visible: x >= 0 && x <= p.width && y >= 0 && y <= p.height };
  }

  function project(vector, view, width, height) {
    const p = projectionContext(view, width, height);
    return projectCamera(cameraVector(vector, p), p);
  }

  // Clip a chord in camera space to all five perspective-frustum planes.
  // Small spherical segments then approach the horizon without screen-spanning jumps.
  function segmentInContext(a, b, p) {
    const start = cameraVector(a, p), end = cameraVector(b, p);
    let lo = 0, hi = 1;
    const planes = [
      v => v[2] - NEAR,
      v => v[0] + p.tanH*v[2], v => p.tanH*v[2] - v[0],
      v => v[1] + p.tanV*v[2], v => p.tanV*v[2] - v[1]
    ];
    for (const plane of planes) {
      const fa = plane(start), fb = plane(end);
      if (fa < 0 && fb < 0) return null;
      if (fa < 0 || fb < 0) {
        const t = fa / (fa - fb);
        if (fa < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
        if (lo > hi) return null;
      }
    }
    const at = t => start.map((x, i) => x + (end[i] - x)*t);
    const pa = projectCamera(at(lo), p), pb = projectCamera(at(hi), p);
    if (!pa || !pb) return null;
    return [[clamp(pa.x, 0, p.width), clamp(pa.y, 0, p.height)],
      [clamp(pb.x, 0, p.width), clamp(pb.y, 0, p.height)]];
  }

  function projectSegment(a, b, view, width, height) {
    return segmentInContext(a, b, projectionContext(view, width, height));
  }

  // Follow the shorter great-circle arc, never interpolating wrapped azimuths.
  // Endpoints stay exactly at the supplied stellar directions.
  function sampleGreatCircle(a, b, maxStepDegrees = 2) {
    const cosine = clamp(dot(a,b),-1,1);
    let tangent = b.map((value,i)=>value-cosine*a[i]);
    const sine = Math.hypot(...tangent), angle = Math.atan2(sine,cosine);
    if (angle < 1e-10) return [a.slice(),b.slice()];
    if (sine > 1e-10) tangent = tangent.map(value=>value/sine);
    else {
      // An exactly antipodal pair has no unique arc. Use a stable plane rather
      // than letting roundoff send an arc through the camera unpredictably.
      const least = a.reduce((best,value,i)=>Math.abs(value)<Math.abs(a[best])?i:best,0);
      tangent = a.map((value,i)=>(i===least?1:0)-a[least]*value);
      const length = Math.hypot(...tangent);
      tangent = tangent.map(value=>value/length);
    }
    const step = clamp(numberOr(maxStepDegrees,2),.1,2)*DEG;
    const count = Math.max(1,Math.ceil(angle/step)), vertices = [a.slice()];
    for (let i=1;i<count;i++) {
      const theta = angle*i/count;
      vertices.push(a.map((value,j)=>value*Math.cos(theta)+tangent[j]*Math.sin(theta)));
    }
    vertices.push(b.slice());
    return vertices;
  }

  // A chord and its great-circle arc meet the horizon at the same direction.
  // Split there so a below-horizon fade never leaks above the horizon line.
  function splitAtHorizon(a, b) {
    if (a[2]*b[2] >= 0) return [{a,b,below:a[2]+b[2]<0}];
    const t = a[2]/(a[2]-b[2]);
    const crossing = a.map((value,i)=>value+(b[i]-value)*t);
    const length = Math.hypot(...crossing);
    const horizonPoint = [crossing[0]/length,crossing[1]/length,0];
    return [{a,b:horizonPoint,below:a[2]<0},{a:horizonPoint,b,below:b[2]<0}];
  }

  function prepareConstellation(figure) {
    const paths = [], points = [];
    const finish = vertices => {
      if (!vertices.length) return;
      if (vertices.length===1) { points.push(vertices[0]); return; }
      const segments = [];
      for (let i=1;i<vertices.length;i++) {
        const arc = sampleGreatCircle(vertices[i-1],vertices[i]);
        for (let j=1;j<arc.length;j++) segments.push(...splitAtHorizon(arc[j-1],arc[j]));
      }
      paths.push(segments);
    };
    for (const line of figure.lines || []) {
      let vertices = [];
      for (const point of line) {
        if (!Number.isFinite(+point?.altitude)||!Number.isFinite(+point?.azimuth)) {
          finish(vertices); vertices = []; continue;
        }
        const vector = horizontalVector(+point.altitude,+point.azimuth);
        const previous = vertices[vertices.length-1];
        if (!previous || Math.hypot(...vector.map((value,i)=>value-previous[i]))>1e-10) vertices.push(vector);
      }
      finish(vertices);
    }
    const label = figure.label;
    const labelVector = Number.isFinite(+label?.altitude)&&Number.isFinite(+label?.azimuth) ? horizontalVector(+label.altitude,+label.azimuth) : null;
    return {figure,paths,points,labelVector};
  }

  function create(canvas, callbacks = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot display the canvas sky.');
    let view = { ...DEFAULT_VIEW }, active = false, destroyed = false, animation = null;
    let scene = { valid: false, reason: 'Choose an observer reading to view the local sky.', stars: [] };
    let stars = [], constellations = [], hitTargets = [], width = 1, height = 1;
    const pointers = new Map();
    let gesture = null, moved = false;
    const listeners = [];
    const listen = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      listeners.push(() => target.removeEventListener(type, fn, options));
    };
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;

    function schedule() {
      if (active && !destroyed && animation === null) animation = requestAnimationFrame(() => {
        animation = null; render();
      });
    }

    function notify() {
      canvas.dataset.azimuth = view.azimuth.toFixed(4);
      canvas.dataset.altitude = view.altitude.toFixed(4);
      canvas.dataset.fov = view.fov.toFixed(4);
      if (callbacks.onViewChange) callbacks.onViewChange({ ...view });
    }

    function setView(next) {
      view = normalizeView({ ...view, ...next });
      notify(); schedule();
    }

    function sizeCanvas() {
      const box = canvas.getBoundingClientRect();
      width = box.width; height = box.height;
      if (width <= 0 || height <= 0) return false;
      const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
      const w = Math.round(width*dpr), h = Math.round(height*dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    function curve(p, vertices, color, lineWidth, dash = []) {
      ctx.beginPath();
      let previous = null;
      for (let i = 1; i < vertices.length; i++) {
        const segment = segmentInContext(vertices[i-1], vertices[i], p);
        if (segment) {
          if (!previous || Math.hypot(segment[0][0]-previous[0],segment[0][1]-previous[1])>.1) ctx.moveTo(...segment[0]);
          ctx.lineTo(...segment[1]); previous = segment[1];
        } else previous = null;
      }
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    }

    const horizon = Array.from({length:181}, (_, i) => horizontalVector(0, i*2));
    const altitudeLines = [-60,-30,30,60].map(h => Array.from({length:181}, (_,i) => horizontalVector(h,i*2)));
    const azimuthLines = Array.from({length:12}, (_,j) => Array.from({length:91}, (_,i) => horizontalVector(-90+i*2,j*30)));

    function textLabel(text, x, y, color, size = 11, align = 'left') {
      ctx.font = `${size}px Inter, system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#07101de6'; ctx.strokeText(text,x,y);
      ctx.fillStyle = color; ctx.fillText(text,x,y);
    }

    function render() {
      if (destroyed || !active || !sizeCanvas()) return;
      ctx.globalAlpha = 1;
      ctx.clearRect(0,0,width,height);
      const backdrop = ctx.createLinearGradient(0,0,0,height);
      backdrop.addColorStop(0,'#050b16'); backdrop.addColorStop(1,'#0b1828');
      ctx.fillStyle = backdrop; ctx.fillRect(0,0,width,height);
      hitTargets = [];
      canvas.dataset.grid = String(!!scene.grid);
      canvas.dataset.renderedStars = '0'; canvas.dataset.belowHorizonStars = '0';
      canvas.dataset.catalogueStars = String(stars.length);
      canvas.dataset.constellationCount = String(constellations.length);
      canvas.dataset.constellationSegments = '0'; canvas.dataset.constellationLabels = '0';
      canvas.dataset.renderedConstellations = '0'; canvas.dataset.constellationPoints = '0';
      canvas.dataset.valid = String(!!scene.valid);
      delete canvas.dataset.horizonY;
      if (!scene.valid) {
        textLabel('No observer reading',width/2,height/2-22,'#d7c9ae',17,'center');
        const words = String(scene.reason || 'Choose a valid time and location.').split(/\s+/);
        const lines = []; let line = '';
        ctx.font = '12px Inter, system-ui, sans-serif';
        for (const word of words) {
          const test = line ? line+' '+word : word;
          if (ctx.measureText(test).width > width-48 && line) { lines.push(line); line = word; } else line = test;
        }
        if (line) lines.push(line);
        lines.forEach((s,i) => textLabel(s,width/2,height/2+12+i*19,'#91a4ba',12,'center'));
        return;
      }
      const p = projectionContext(view,width,height);
      // With a level (roll-free) observer camera the horizon is a straight line.
      const horizonY = Math.abs(view.altitude) === 90 ? (view.altitude > 0 ? Infinity : -Infinity) : height/2+p.focal*Math.tan(view.altitude*DEG);
      if (horizonY < height) {
        const top = Math.max(0,horizonY);
        ctx.fillStyle = '#17232999'; ctx.fillRect(0,top,width,height-top);
      }
      if (scene.grid) {
        altitudeLines.forEach(v => curve(p,v,'#8196b466',.9,[3,5]));
        azimuthLines.forEach(v => curve(p,v,'#8196b466',.9,[3,5]));
      }
      let constellationSegments = 0, constellationPoints = 0;
      const visibleConstellations = new Set();
      // The cached arcs include stars outside the current magnitude cutoff.
      // Reprojection while dragging never needs another spherical subdivision.
      for (const below of [true,false]) {
        ctx.beginPath();
        for (const item of constellations) {
          for (const path of item.paths) {
            let previous = null;
            for (const part of path) {
              if (part.below!==below) { previous = null; continue; }
              const segment = segmentInContext(part.a,part.b,p);
              if (!segment) { previous = null; continue; }
              if (!previous || Math.hypot(segment[0][0]-previous[0],segment[0][1]-previous[1])>.1) ctx.moveTo(...segment[0]);
              ctx.lineTo(...segment[1]); previous = segment[1];
              constellationSegments++; visibleConstellations.add(item);
            }
          }
          for (const point of item.points) {
            if ((point[2]<0)!==below) continue;
            const q = projectCamera(cameraVector(point,p),p);
            if (!q?.visible) continue;
            ctx.moveTo(q.x+4.5,q.y); ctx.arc(q.x,q.y,4.5,0,2*Math.PI);
            constellationPoints++; visibleConstellations.add(item);
          }
        }
        ctx.strokeStyle = below?'#c7ad7833':'#c7ad788c'; ctx.lineWidth = 1.1; ctx.stroke();
      }
      let belowCount = 0;
      const labels = [];
      for (const item of stars) {
        const projected = projectCamera(cameraVector(item.vector,p),p);
        if (!projected?.visible) continue;
        const star = item.star, mag = Number.isFinite(+star.mag) ? +star.mag : 5;
        const below = +star.altitude < 0;
        const alpha = clamp(.92-mag*.074,.24,1)*(below?.26:1);
        const radius = clamp(2.45-mag*.29,.55,3.2);
        const {x,y} = projected;
        ctx.globalAlpha = alpha;
        if (mag < 1.2) {
          const glow = ctx.createRadialGradient(x,y,0,x,y,radius*5);
          glow.addColorStop(0,'#bbd9ff55'); glow.addColorStop(1,'#bbd9ff00');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x,y,radius*5,0,2*Math.PI); ctx.fill();
        }
        ctx.fillStyle = star.color || '#cbdcf1';
        ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
        if (star.selected) {
          ctx.globalAlpha = 1; ctx.strokeStyle = '#e9ca8a'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x,y,radius+5,0,Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        hitTargets.push({x,y,radius:Math.max(7,radius+4),star});
        if (below) belowCount++;
        if (scene.labels && star.name && (star.selected || (mag <= 2 && !/^(HIP |Gaia |Catalogue star)/.test(star.name)))) labels.push({star,x,y,below,mag});
      }
      // Selected and brighter labels take priority. Avoid a dense catalogue of overlapping text.
      labels.sort((a,b) => Number(!!b.star.selected)-Number(!!a.star.selected)||a.mag-b.mag);
      const occupied = [];
      const reserveLabel = (text,x,y,size=11,align='left') => {
        ctx.font = `${size}px Inter, system-ui, sans-serif`;
        const tw = ctx.measureText(text).width, left = align==='center'?x-tw/2:x;
        occupied.push([left-4,y-size/2-4,left+tw+4,y+size/2+4]);
      };
      for (const label of labels) {
        const {star,x,y,below} = label;
        ctx.font = '11px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(star.name).width;
        const lx = star.selected ? clamp(x+8,4,Math.max(4,width-tw-4)) : x+8;
        const ly = star.selected ? clamp(y-10,12,height-12) : y-10;
        const box = [lx-2,ly-8,lx+tw+2,ly+8];
        if (!star.selected && (box[2]>width-5 || box[0]<4 || box[1]<4 || box[3]>height-5 || occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))) continue;
        textLabel(star.name,lx,ly,star.selected?'#f2d69e':below?'#7b8a9a':'#b4c7de');
        occupied.push(box);
      }
      curve(p,horizon,'#88d3bd',1.35);
      for (const [label,az] of [['N',0],['E',90],['S',180],['W',270]]) {
        const q = projectCamera(cameraVector(horizontalVector(0,az),p),p);
        if (q?.visible) {
          const x = clamp(q.x,14,width-14), y = clamp(q.y+18,15,height-14);
          textLabel(label,x,y,'#a0e6ce',13,'center'); reserveLabel(label,x,y,13,'center');
        }
      }
      if (scene.pole) {
        const q = projectCamera(cameraVector(horizontalVector(scene.pole.altitude,scene.pole.azimuth),p),p);
        if (q?.visible) {
          ctx.strokeStyle = '#dfc283'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(q.x,q.y,6,0,Math.PI*2); ctx.moveTo(q.x-9,q.y); ctx.lineTo(q.x+9,q.y); ctx.moveTo(q.x,q.y-9); ctx.lineTo(q.x,q.y+9); ctx.stroke();
          occupied.push([q.x-10,q.y-10,q.x+10,q.y+10]);
          if (scene.labels) {
            const name = scene.pole.name || 'Rotation pole';
            textLabel(name,q.x+12,q.y+14,'#d9c698',10); reserveLabel(name,q.x+12,q.y+14,10);
          }
        }
      }
      if (scene.sun && Number.isFinite(scene.sun.altitude) && Number.isFinite(scene.sun.azimuth)) {
        const q = projectCamera(cameraVector(horizontalVector(scene.sun.altitude,scene.sun.azimuth),p),p);
        if (q?.visible) {
          ctx.globalAlpha = scene.sun.altitude < 0 ? .48 : 1;
          ctx.strokeStyle = '#edbc77'; ctx.fillStyle = '#ecc788'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(q.x,q.y,4,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(q.x,q.y,7,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
          occupied.push([q.x-8,q.y-8,q.x+8,q.y+8]);
          if (scene.labels) { textLabel('Sun',q.x+11,q.y-10,'#cbb18a',11); reserveLabel('Sun',q.x+11,q.y-10); }
        }
      }
      if (horizonY > height || horizonY < 0) {
        const text = horizonY>height?'Horizon below view':'Below the horizon';
        textLabel(text,width/2,height-22,'#849dab',10,'center'); reserveLabel(text,width/2,height-22,10,'center');
      }
      let constellationLabels = 0;
      // Keep names clear of the HTML camera readout, including its narrow-screen wrap.
      occupied.push([8,8,Math.min(width-8,390),width<390?76:60]);
      if (scene.constellationLabels) for (const item of constellations) {
        const name = item.figure.name || item.figure.nativeName;
        if (!name || !item.labelVector) continue;
        const q = projectCamera(cameraVector(item.labelVector,p),p);
        if (!q?.visible) continue;
        ctx.font = '11px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(name).width;
        for (const [dx,dy] of [[0,-14],[0,16],[0,-30],[0,32],[-24,-14],[24,-14]]) {
          const x = q.x+dx, y = q.y+dy, box = [x-tw/2-4,y-10,x+tw/2+4,y+10];
          if (box[0]<5 || box[1]<5 || box[2]>width-5 || box[3]>height-5 || occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1])) continue;
          textLabel(name,x,y,item.labelVector[2]<0?'#8a8069':'#cbb98e',11,'center');
          occupied.push(box); constellationLabels++; visibleConstellations.add(item); break;
        }
      }
      canvas.dataset.constellationSegments = String(constellationSegments);
      canvas.dataset.constellationLabels = String(constellationLabels);
      canvas.dataset.constellationPoints = String(constellationPoints);
      canvas.dataset.renderedConstellations = String(visibleConstellations.size);
      canvas.dataset.renderedStars = String(hitTargets.length);
      canvas.dataset.belowHorizonStars = String(belowCount);
      canvas.dataset.catalogueStars = String(stars.length);
      canvas.dataset.horizonY = Number.isFinite(horizonY) ? horizonY.toFixed(3) : String(horizonY);
    }

    function resetGesture() {
      const pts = [...pointers.values()];
      if (!pts.length) { gesture = null; return; }
      const mid = pts.length > 1 ? {x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2} : pts[0];
      gesture = { x:mid.x,y:mid.y,view:{...view},distance:pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):null };
    }

    function selectAt(event) {
      const box = canvas.getBoundingClientRect(), x = event.clientX-box.left, y = event.clientY-box.top;
      let found = null, best = Infinity;
      for (const target of hitTargets) {
        const d = Math.hypot(target.x-x,target.y-y);
        if (d <= target.radius && d < best) { found = target; best = d; }
      }
      if (found && callbacks.onSelect) callbacks.onSelect(found.star);
    }

    listen(canvas,'pointerdown',event=>{
      if (!active || (event.pointerType==='mouse' && event.button!==0)) return;
      event.preventDefault(); canvas.focus({preventScroll:true});
      if (!pointers.size) moved = false; else moved = true;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; resetGesture();
    });
    listen(canvas,'pointermove',event=>{
      if (!pointers.has(event.pointerId) || !gesture) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const pts = [...pointers.values()];
      const mid = pts.length>1?{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2}:pts[0];
      const dx = mid.x-gesture.x, dy = mid.y-gesture.y;
      if (Math.hypot(dx,dy)>3) moved = true;
      const angularScale = gesture.view.fov/Math.max(width,1);
      let fov = gesture.view.fov;
      if (pts.length>1 && gesture.distance>0) {
        const distance = Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
        if (distance>0) fov = 2*Math.atan(Math.tan(fov*DEG/2)*gesture.distance/distance)/DEG;
        moved = true;
      }
      setView({azimuth:gesture.view.azimuth-dx*angularScale,altitude:gesture.view.altitude+dy*angularScale,fov});
    });
    function finishPointer(event, cancelled) {
      if (!pointers.has(event.pointerId)) return;
      const canSelect = !cancelled && !moved && pointers.size===1;
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (canSelect) selectAt(event);
      if (!pointers.size) canvas.style.cursor = 'grab';
      resetGesture();
    }
    listen(canvas,'pointerup',event=>finishPointer(event,false));
    listen(canvas,'pointercancel',event=>finishPointer(event,true));
    listen(canvas,'lostpointercapture',event=>finishPointer(event,true));
    listen(canvas,'wheel',event=>{
      if (!active) return;
      event.preventDefault();
      const delta = event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
      setView({fov:view.fov*Math.exp(clamp(delta,-400,400)*.0015)});
    },{passive:false});
    listen(canvas,'keydown',event=>{
      const step = event.shiftKey?15:5;
      const moves = {
        ArrowLeft:()=>setView({azimuth:view.azimuth-step}), ArrowRight:()=>setView({azimuth:view.azimuth+step}),
        ArrowUp:()=>setView({altitude:view.altitude+step}), ArrowDown:()=>setView({altitude:view.altitude-step}),
        '+':()=>setView({fov:view.fov/1.15}), '=':()=>setView({fov:view.fov/1.15}),
        '-':()=>setView({fov:view.fov*1.15}), '_':()=>setView({fov:view.fov*1.15}), Home:()=>setView(DEFAULT_VIEW)
      };
      if (active && moves[event.key]) { event.preventDefault(); moves[event.key](); }
    });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (resizeObserver) resizeObserver.observe(canvas); else listen(globalThis,'resize',schedule);
    notify();

    return Object.freeze({
      setScene(next) {
        scene = { ...next };
        hitTargets = [];
        stars = (scene.valid ? scene.stars || [] : []).filter(star=>Number.isFinite(+star.altitude)&&Number.isFinite(+star.azimuth)).map(star=>({star,vector:horizontalVector(+star.altitude,+star.azimuth)}));
        stars.sort((a,b)=>(+b.star.mag||0)-(+a.star.mag||0));
        constellations = (scene.valid ? scene.constellations || [] : []).map(prepareConstellation);
        schedule();
      },
      setView,
      getView:()=>({...view}),
      reset:()=>setView(DEFAULT_VIEW),
      setActive(value) {
        active = !!value;
        if (!active) {
          if (animation !== null) { cancelAnimationFrame(animation); animation = null; }
          for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
          pointers.clear(); gesture = null; moved = false; canvas.style.cursor = 'grab';
        } else schedule();
      },
      render,
      destroy() {
        destroyed = true;
        if (animation !== null) cancelAnimationFrame(animation);
        resizeObserver?.disconnect(); listeners.forEach(remove=>remove()); pointers.clear();
      }
    });
  }

  return Object.freeze({create,horizontalVector,cameraBasis,project,projectSegment,sampleGreatCircle,splitAtHorizon,normalizeView,DEFAULT_VIEW});
});
