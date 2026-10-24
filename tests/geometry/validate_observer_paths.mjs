// Exercise the actual SVG tracer, including its topology at the projection rim.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),O=require('../dist/observer.js');
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const extract=name=>{
  const start=app.indexOf('  function '+name+'('),end=app.indexOf('\n  function ',start+1);
  assert.ok(start>=0&&end>start,name);return app.slice(start,end);
};
const base={year:-1199,calendarDay:90,latitude:32.54,longitude:44.42,period:'morning',sunAltitude:-9};
const reference=O.solve(base);assert.ok(reference.valid);
const ctx={state:{center:'ncp',rotation:0},data,Math,finite:n=>Number.isFinite(Number(n)),
  epochPosition:s=>O.position(s,ctx.solution)};
vm.createContext(ctx);
vm.runInContext(['projectionCenter','projectEquatorial','inverseProjectedVector','observerPath'].map(extract).join('\n'),ctx);
const toEq=v=>({raDeg:O.normalizeDeg(Math.atan2(v[1],v[0])*180/Math.PI),decDeg:Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI});
const near=(a,b,tol=1e-3)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
function setFrame(latitude,lstDeg,calendarDay=90) {
  const physical=O.solve({...base,latitude,calendarDay});
  ctx.solution={...(physical.valid?physical:reference),latitude,_basis:undefined};
  if(lstDeg!==undefined)ctx.solution.lstDeg=lstDeg;
}
function points(path) {
  assert.ok(path.length&&!/NaN|Infinity/.test(path));
  return [...path.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)].map(m=>({command:m[1],p:[+m[2],+m[3]]}));
}
function trace(kind) {
  const sample=kind==='meridian'?t=>O.fromHorizontal(t<=90?t:180-t,t<=90?0:180,ctx.solution)
    :t=>O.fromHorizontal(kind==='horizon'?0:6,t,ctx.solution);
  return points(ctx.observerPath(sample,0,kind==='meridian'?180:360));
}
let cases=0,segments=0;
function verify(path,kind) {
  let previous=null;
  for(const {command,p} of path) {
    assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(...p)<=355.001);
    if(command==='L') {
      assert.ok(previous);assert.ok(Math.hypot(p[0]-previous[0],p[1]-previous[1])<=8.002,'No false rim chord');
      const mid=[(p[0]+previous[0])/2,(p[1]+previous[1])/2];
      const eq=toEq(ctx.inverseProjectedVector(...mid)),h=O.horizontal(eq,ctx.solution);
      if(kind==='meridian') {
        // All rendered chord midpoints stay near the true meridian plane.
        const east=Math.cos(eq.decDeg*Math.PI/180)*Math.sin((eq.raDeg-ctx.solution.lstDeg)*Math.PI/180);
        near(east,0,.0005);
        assert.ok(h.altitude>=-.03);
      } else near(h.altitude,kind==='horizon'?0:6,.03);
      segments++;
    }
    previous=p;
  }
  cases++;
}
const branches=path=>path.filter(p=>p.command==='M').length;
function seam(path) {
  assert.equal(branches(path),2,'Exactly two branches at an antipodal crossing');
  const i=path.findIndex((p,i)=>i>0&&p.command==='M');
  near(Math.hypot(...path[i-1].p),355,.002);
  near(Math.hypot(...path[i].p),355,.002);
  assert.ok(Math.hypot(path[i].p[0]-path[i-1].p[0],path[i].p[1]-path[i-1].p[1])>700);
  assert.ok(i>1&&i<path.length-1,'No isolated arbitrary-bearing antipode vertex');
}
for(const latitude of [-89,-33,-32.54,-6,-1,0,1,32.54,89]) {
  setFrame(latitude);
  for(const centre of ['ncp','polaris','thuban','kochab']) {
    ctx.state.center=centre;
    for(const kind of ['meridian','horizon','altitude'])verify(trace(kind),kind);
  }
}
// Near-equatorial northern observers expose the same high-curvature defect
// without entering the southern hemisphere. Cover the full nominal year.
for(const latitude of [0,.01,.5,1,2])for(const calendarDay of [0,90,180,270]) {
  setFrame(latitude,undefined,calendarDay);
  for(const centre of ['ncp','polaris','thuban','kochab']) {
    ctx.state.center=centre;
    const meridian=trace('meridian');verify(meridian,'meridian');
    assert.equal(branches(meridian),1,`${latitude} N, ${calendarDay}, ${centre}: continuous northern meridian`);
    for(const kind of ['horizon','altitude'])verify(trace(kind),kind);
  }
}
ctx.state.center='ncp';
for(const latitude of [-32.54,-33]){setFrame(latitude);seam(trace('meridian'));}
setFrame(0);seam(trace('horizon'));
const endpoint=trace('meridian');assert.equal(branches(endpoint),1);near(Math.hypot(...endpoint.at(-1).p),355,.002);
setFrame(-6);seam(trace('altitude'));
// The original failure produced six disconnected pieces here; this is one
// continuous, strongly curved meridian which only approaches the antipode.
ctx.state.center='thuban';setFrame(-32.54);assert.equal(branches(trace('meridian')),1);
// Exact star-centred seams, and very close misses to either side, must differ.
for(const centre of ['polaris','thuban','kochab']) {
  ctx.state.center=centre;setFrame(-33);
  const ra=ctx.projectionCenter().raDeg;
  setFrame(-33,ra);const exact=trace('meridian');verify(exact,'meridian');seam(exact);
  for(const delta of [-.0001,.0001]) {
    setFrame(-33,ra+delta);const close=trace('meridian');verify(close,'meridian');
    assert.equal(branches(close),1,`${centre}: a near miss must remain connected`);
  }
}
console.log(JSON.stringify({cases,segments,stressLatitudes:9,northernLatitudes:5,calendarQuarters:4,centres:4,exactSeams:true,nearMisses:true,status:'passed'}));
