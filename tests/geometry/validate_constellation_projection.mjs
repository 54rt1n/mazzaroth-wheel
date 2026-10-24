// Exercise the geometry at projection seams and the actual canvas scene handoff.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const G = require('../dist/ground-sky.js');
const rad = Math.PI/180, width = 1000, height = 600;
const camera = {azimuth:0,altitude:0,fov:100};
const dot = (a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
const angle = (a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b))))/rad;
const near = (a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const vector = (altitude,azimuth)=>G.horizontalVector(altitude,azimuth);
const arc = (a,b)=>G.sampleGreatCircle(vector(...a),vector(...b));
const projected = (vertices,view=camera)=>vertices.slice(1).map((b,i)=>G.projectSegment(vertices[i],b,view,width,height)).filter(Boolean);
const counts = {endpointPairs:0,seamChecks:0,horizonChecks:0,clippingChecks:0,sceneChecks:0};

for (const pair of [ [[15,359],[17,1]], [[45,-40],[45,40]], [[20,-25],[-10,30]], [[89,0],[89,180]], [[0,0],[0,180]], [[10,30],[10,30]] ]) {
  const a = vector(...pair[0]), b = vector(...pair[1]), vertices = G.sampleGreatCircle(a,b);
  assert.deepEqual(vertices[0],a,'Subdivision preserves the first catalogue direction');
  assert.deepEqual(vertices.at(-1),b,'Subdivision preserves the last catalogue direction');
  for (let i=0;i<vertices.length;i++) {
    near(Math.hypot(...vertices[i]),1);
    if (i) assert.ok(angle(vertices[i-1],vertices[i])<=2+1e-6,'No spherical step exceeds two degrees');
  }
  counts.endpointPairs++;
}

// A 359°→1° connection crosses north in two degrees, never the opposite sky.
const seam = arc([0,359],[0,1]), seamSegments = projected(seam);
assert.ok(seamSegments.length);
for (const segment of seamSegments) for (const [x,y] of segment) { assert.ok(x>490&&x<510); near(y,height/2); }
assert.equal(projected(seam,{...camera,azimuth:180}).length,0);
counts.seamChecks+=2;

// A great-circle arc between two equal-altitude stars rises above that altitude.
// Its perspective projection is nevertheless a straight line through the stars.
const bowed = arc([45,-40],[45,40]);
assert.ok(Math.asin(bowed[Math.floor(bowed.length/2)][2])/rad>50);
const elevatedCamera = {...camera,altitude:45};
const endA = G.project(bowed[0],elevatedCamera,width,height), endB = G.project(bowed.at(-1),elevatedCamera,width,height);
for (const v of bowed) {
  const q = G.project(v,elevatedCamera,width,height);
  near((q.x-endA.x)*(endB.y-endA.y)-(q.y-endA.y)*(endB.x-endA.x),0,1e-7);
}
counts.seamChecks++;

const crossingArc = arc([20,-25],[-10,30]);
const pieces = crossingArc.slice(1).flatMap((b,i)=>G.splitAtHorizon(crossingArc[i],b));
assert.ok(pieces.some(p=>p.below)&&pieces.some(p=>!p.below));
assert.deepEqual(pieces[0].a,crossingArc[0]); assert.deepEqual(pieces.at(-1).b,crossingArc.at(-1));
let horizonCrossings = 0;
for (let i=0;i<pieces.length;i++) {
  const piece = pieces[i];
  assert.ok(piece.a[2]*piece.b[2]>=0,'Every faded segment lies on one side of the horizon');
  assert.equal(piece.below,piece.a[2]+piece.b[2]<0);
  if (i) {
    assert.deepEqual(pieces[i-1].b,piece.a,'Horizon split is continuous');
    if (pieces[i-1].below!==piece.below) {
      near(piece.a[2],0); near(Math.hypot(...piece.a),1);
      const q = G.project(piece.a,camera,width,height); near(q.y,height/2);
      horizonCrossings++;
    }
  }
}
assert.equal(horizonCrossings,1);
counts.horizonChecks++;

// Both endpoints may be behind the camera, or only one may be visible.
assert.equal(projected(arc([0,130],[0,230])).length,0,'A back-hemisphere arc never appears through the foreground');
const partial = projected(arc([0,0],[0,140]));
assert.ok(partial.length); near(partial[0][0][0],width/2); near(partial.at(-1)[1][0],width);
for (const segment of partial) {
  for (const [x,y] of segment) assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=width&&y>=0&&y<=height);
  assert.ok(Math.hypot(segment[1][0]-segment[0][0],segment[1][1]-segment[0][1])<50,'Short arcs do not jump across the screen at camera clipping');
}
counts.clippingChecks+=2;

// Minimal instrumented canvas validates independent magnitude/label controls,
// repeated-point figures, disjoint paths, and clearing a previously loaded set.
const originals = Object.fromEntries(['requestAnimationFrame','cancelAnimationFrame','ResizeObserver'].map(key=>[key,globalThis[key]]));
globalThis.requestAnimationFrame = ()=>1;
globalThis.cancelAnimationFrame = ()=>{};
globalThis.ResizeObserver = class {observe() {} disconnect() {}};
const draw = [];
let currentPath = [];
const gradient = {addColorStop() {}};
const ctx = {
  setTransform() {}, clearRect() {}, fillRect() {}, setLineDash() {},
  createLinearGradient:()=>gradient, createRadialGradient:()=>gradient,
  beginPath() {currentPath=[];}, moveTo(...args) {currentPath.push(['move',...args]);},
  lineTo(...args) {currentPath.push(['line',...args]);}, arc(...args) {currentPath.push(['arc',...args]);},
  stroke() {draw.push({color:this.strokeStyle,path:currentPath.slice()});}, fill() {},
  strokeText() {}, fillText() {}, measureText:text=>({width:String(text).length*6})
};
const canvas = {
  getContext:()=>ctx,getBoundingClientRect:()=>({width,height}),style:{},dataset:{},
  hasAttribute:()=>true,addEventListener() {},removeEventListener() {},hasPointerCapture:()=>false
};
const sky = G.create(canvas);
const figures = [
  {id:'disjoint',name:'Two separated lines',lines:[[{altitude:12,azimuth:345},{altitude:12,azimuth:350}],[{altitude:12,azimuth:10},{altitude:12,azimuth:15}]],label:{altitude:12,azimuth:0}},
  {id:'single',name:'Single star',lines:[[{altitude:25,azimuth:20},{altitude:25,azimuth:20}]],label:{altitude:25,azimuth:20}}
];
try {
  sky.setView(camera); sky.setActive(true);
  sky.setScene({valid:true,stars:[],labels:false,constellationLabels:true,constellations:figures}); sky.render();
  assert.equal(canvas.dataset.renderedStars,'0'); assert.equal(canvas.dataset.constellationCount,'2');
  assert.ok(+canvas.dataset.constellationSegments>0,'Lines remain visible without displayed catalogue stars');
  assert.equal(canvas.dataset.constellationPoints,'1','Repeated identical endpoints preserve a single-star figure');
  assert.equal(canvas.dataset.constellationLabels,'2','Constellation labels are independent of star labels');
  const lines = draw.find(d=>d.color==='#c7ad788c');
  assert.equal(lines.path.filter(command=>command[0]==='move').length,3,'Each disconnected line and singleton starts its own path');
  counts.sceneChecks++;
  sky.setScene({valid:true,stars:[],labels:true,constellationLabels:false,constellations:figures}); sky.render();
  assert.equal(canvas.dataset.constellationLabels,'0'); assert.ok(+canvas.dataset.constellationSegments>0); counts.sceneChecks++;
  sky.setView({...camera,azimuth:180}); sky.render();
  assert.equal(canvas.dataset.constellationSegments,'0'); assert.equal(canvas.dataset.constellationPoints,'0'); counts.sceneChecks++;
  sky.setScene({valid:true,stars:[],constellationLabels:true,constellations:[]}); sky.render();
  assert.equal(canvas.dataset.constellationCount,'0'); assert.equal(canvas.dataset.renderedConstellations,'0'); counts.sceneChecks++;
} finally {
  sky.destroy();
  for (const [key,value] of Object.entries(originals)) if (value===undefined) delete globalThis[key]; else globalThis[key]=value;
}

console.log(JSON.stringify({...counts,status:'passed'}));
