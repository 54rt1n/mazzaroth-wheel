// Independent geometric invariants for the selected-star rotation-axis model.
// Exercise the actual app projection, SVG tracer, and horizon raster as well as
// the observer solver, so a straight line alone cannot hide a mismatched sky.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const O=require('../dist/observer.js');
const A=require('../dist/vendor/astronomy.browser.min.js');
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const rad=Math.PI/180;
const near=(a,b,tol=1e-7,message='')=>assert.ok(Math.abs(a-b)<=tol,`${message}: ${a} != ${b} (±${tol})`);
const vector=eq=>[Math.cos(eq.decDeg*rad)*Math.cos(eq.raDeg*rad),Math.cos(eq.decDeg*rad)*Math.sin(eq.raDeg*rad),Math.sin(eq.decDeg*rad)];
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const toEq=v=>({raDeg:O.normalizeDeg(Math.atan2(v[1],v[0])/rad),decDeg:Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad});
const extract=name=>{
  const start=app.indexOf('  function '+name+'('),end=app.indexOf('\n  function ',start+1);
  assert.ok(start>=0&&end>start,name);return app.slice(start,end);
};
let raster;
const ctx={state:{center:'ncp',rotation:0},data,Math,ObserverSky:O,
  finite:v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)),
  observerSolution:null,observerKey:'',horizonImageCache:null,
  epochPosition:s=>O.position(s,ctx.observerSolution),
  document:{createElement(tag){
    assert.equal(tag,'canvas');
    return {getContext(){return {
      createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
      putImageData(im){raster=im;}
    };},toDataURL(){return 'data:image/png;base64,test-raster';}};
  }}
};
vm.createContext(ctx);
vm.runInContext(['projectionCenter','projectEquatorial','inverseProjectedVector','observerPath','horizonImage'].map(extract).join('\n'),ctx);
const base={year:-1199,calendarDay:90,latitude:32.54,longitude:44.42,period:'morning',sunAltitude:-9};
const target=data.stars.find(s=>s.hip===32349);assert.ok(target);
const fits=new Map();
const counts={fits:0,solutions:0,meridianPoints:0,horizonPoints:0,rasterPixels:0,solarRoots:0,culminations:0};
const dateAtYear=year=>{const d=new Date(0);d.setUTCFullYear(year,6,1);return d;};
const rx=(a,[x,y,z])=>[x,Math.cos(a)*y+Math.sin(a)*z,-Math.sin(a)*y+Math.cos(a)*z];
const rz=(a,[x,y,z])=>[Math.cos(a)*x+Math.sin(a)*y,-Math.sin(a)*x+Math.cos(a)*y,z];
function meanSeparation(star,year) {
  const time=A.MakeTime(dateAtYear(year)),frame=O.frameAt(time,0,0),tilt=A.e_tilt(time);
  // Independently assemble the standard mean→true nutation rotations instead
  // of reusing the observer's expanded meanPole expression. The signs/order
  // also match the vendored engine's nutation matrix applied to [0,0,1].
  const meanPole=rx(-tilt.tobl*rad,rz(-tilt.dpsi/3600*rad,rx(tilt.mobl*rad,[0,0,1])));
  const starVector=vector(O.position(star,frame));
  return Math.atan2(Math.hypot(...cross(starVector,meanPole)),dot(starVector,meanPole))/rad;
}
function geocentricSun(frame) {
  const v=A.RotateVector(frame.rotation,A.GeoVector(A.Body.Sun,frame.time,true));
  const norm=Math.hypot(v.x,v.y,v.z);return [v.x/norm,v.y/norm,v.z/norm];
}

// The fit is independent of local observing controls and lies inside the search
// interval for all three supplied candidates. Polaris must not be clipped by
// the old 2100 CE upper bound.
for(const star of data.calibrationStars) {
  const fit=O.poleFit(star);
  assert.ok(Number.isInteger(fit.year),JSON.stringify(fit));
  assert.ok(fit.year>=fit.minYear&&fit.year<=fit.maxYear);
  assert.ok(Number.isFinite(fit.offsetDeg)&&fit.offsetDeg>=0);
  assert.equal(fit.boundary,false,`${star.name}: fit must be interior`);
  assert.deepEqual(O.poleFit(star),fit,'Repeated fit is stable');
  if(star.name==='Polaris')assert.ok(fit.year>2100&&fit.year<2150);
  if(star.name==='Thuban')assert.ok(fit.year>-2900&&fit.year<-2700);
  if(star.name==='Kochab')assert.ok(fit.year>-1500&&fit.year<0);
  near(meanSeparation(star,fit.year),fit.offsetDeg,1e-10,'Mean-pole nutation removal');
  // Exhaustively scan all integer years as an independent check on the
  // production fitter's coarse-search/refinement strategy.
  let best={year:fit.minYear,offset:Infinity};
  for(let year=fit.minYear;year<=fit.maxYear;year++) {
    const offset=meanSeparation(star,year);
    if(offset<best.offset)best={year,offset};
  }
  assert.equal(fit.year,best.year,'Fit is the global minimum over the supported interval');
  const equinox=O.calendarTime(fit.year,0,star),origin=O.frameAt(equinox,0,0,star);
  near(dot(geocentricSun(origin),vector(O.position(star,origin))),0,1e-9,'Assumed-pole equinox');
  for(const direction of [-1,1]) {
    const frame=O.frameAt(equinox.AddDays(direction),0,0,star);
    assert.ok(direction*dot(geocentricSun(frame),vector(O.position(star,frame)))>0,'Spring equinox is the northward crossing');
  }
  for(const day of [29,30,90,359])near(O.calendarTime(fit.year,day,star).ut-equinox.ut,day*365/360,1e-8,'Nominal scaling preserved');
  fits.set(star.name,fit);counts.fits++;
}

function setSolution(star,s) {
  ctx.state.center=star?star.name.toLowerCase():'ncp';
  ctx.observerSolution=s;ctx.observerKey=String(++counts.solutions);
  ctx.horizonImageCache=null;
}
function checkGeometry(star,s) {
  const pole=star?O.position(star,s):{raDeg:0,decDeg:90};
  const p=vector(pole),b=s._basis;
  for(const v of [b.up,b.east,b.north])near(Math.hypot(...v),1,2e-12,'Unit observer axis');
  near(dot(b.up,b.east),0,2e-12);near(dot(b.up,b.north),0,2e-12);near(dot(b.east,b.north),0,2e-12);
  near(dot(cross(b.east,b.north),b.up),1,2e-12,'Right-handed observer triad');
  // North pole lies in the local meridian at altitude latitude. This does not
  // rely on the horizontal converter returning its own inverse.
  near(dot(p,b.up),Math.sin(s.latitude*rad),2e-12,'Assumed pole elevation');
  near(dot(p,b.east),0,2e-12,'Assumed pole meridian');
  near(O.horizontal(pole,s).altitude,s.latitude,1e-7);
  near(Math.hypot(...ctx.projectEquatorial(pole.raDeg,pole.decDeg)),0,1e-7,'Pole at map centre');
  for(const rotation of [0,47,180]) {
    ctx.state.rotation=rotation;
    const zenith=O.fromHorizontal(90,0,s),z=ctx.projectEquatorial(zenith.raDeg,zenith.decDeg);
    const zLength=Math.hypot(...z);
    for(let t=0;t<=180;t+=3) {
      const eq=O.fromHorizontal(t<=90?t:180-t,t<=90?0:180,s);
      const q=ctx.projectEquatorial(eq.raDeg,eq.decDeg);
      // At latitude zero the last point is the projection's exact antipode,
      // whose bearing is undefined and intentionally omitted by the SVG tracer.
      if(s.latitude===0&&t===180)continue;
      near((q[0]*z[1]-q[1]*z[0])/zLength,0,1e-7,'Entire meridian is straight');
      const recovered=toEq(ctx.inverseProjectedVector(...q));
      near(O.separationDeg(eq,recovered),0,1e-7,'Projection inverse');
      near(dot(vector(eq),b.east),0,2e-12,'Meridian great-circle plane');
      counts.meridianPoints++;
    }
    const path=ctx.observerPath(t=>O.fromHorizontal(t<=90?t:180-t,t<=90?0:180,s),0,180);
    assert.ok(path.length&&!/NaN|Infinity/.test(path));
    assert.equal((path.match(/M/g)||[]).length,1,'Northern meridian remains connected');
    const vertices=[...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>[+m[1],+m[2]]);
    for(const q of vertices)near((q[0]*z[1]-q[1]*z[0])/zLength,0,.005,`Rendered meridian is straight ${star?.name||'NCP'} ${s.latitude} ${s.settings?.period} ${s.settings?.calendarDay} ${rotation} ${q}`);
    for(let az=0;az<360;az+=15) {
      const eq=O.fromHorizontal(0,az,s),v=vector(eq);
      near(dot(v,b.up),0,2e-12,'Horizon perpendicular to zenith');
      const xy=ctx.projectEquatorial(eq.raDeg,eq.decDeg);
      if(Math.hypot(...xy)<354.999999)near(dot(vector(toEq(ctx.inverseProjectedVector(...xy))),b.up),0,2e-12);
      counts.horizonPoints++;
    }
  }
  // Render shade with the real app function, then compare against direct
  // celestial-vector dot products rather than the app's altitude helper.
  ctx.horizonImage();assert.ok(raster);
  for(let j=7;j<raster.height;j+=29)for(let i=9;i<raster.width;i+=31) {
    const x=(i+.5-raster.width/2)/(raster.width/2)*355;
    const y=(j+.5-raster.height/2)/(raster.height/2)*355;
    const alpha=raster.data[(j*raster.width+i)*4+3];
    if(Math.hypot(x,y)>355)assert.equal(alpha,0);
    else assert.equal(alpha>0,dot(ctx.inverseProjectedVector(x,y),b.up)<0,`Raster hemisphere at ${star?.name||'NCP'}, ${s.latitude}°`);
    counts.rasterPixels++;
  }
}

for(const star of [null,...data.calibrationStars]) {
  const year=star?fits.get(star.name).year:base.year;
  for(const latitude of [0,.01,1,32.54,89.9])for(const period of ['morning','evening'])for(const calendarDay of [0,90,180,270]) {
    const input={...base,year,latitude,period,calendarDay,...(star?{poleStar:star}:{})};
    let s=O.solve(input);
    if(s.valid) {
      near(s.sunAltitude,input.sunAltitude,.001,'Solar root altitude');
      assert.ok(s.matchesPeriod);
      if(star) {
        const direction=period==='morning'?1:-1;
        for(const side of [-1,1]) {
          const frame=O.frameAt(s.time.AddDays(side/86400),latitude,base.longitude,star);
          const altitude=Math.asin(dot(geocentricSun(frame),frame._basis.up))/rad;
          assert.ok(side*direction*(altitude-input.sunAltitude)>0,`Solar crossing has correct ${period} direction`);
        }
      }
      counts.solarRoots++;
    } else {
      // Polar observers may have no selected twilight. A timing star still
      // provides a frame in which to test the pole and projection geometry.
      assert.equal(latitude,89.9,JSON.stringify({input,reason:s.reason}));
      assert.match(s.reason,/Sun does not cross/);
      s=O.solve({...input,timing:'culmination',target});
      assert.ok(s.valid,s.reason);
    }
    setSolution(star,s);checkGeometry(star,s);
  }
  const transit=O.solve({...base,year,...(star?{poleStar:star}:{}),timing:'culmination',target});
  assert.ok(transit.valid,transit.reason);
  const q=vector(O.position(target,transit));
  near(dot(q,transit._basis.east),0,2e-7,'Transit on assumed meridian');
  near(transit.targetHorizontal.hourAngleDeg,0,1e-5,'Upper culmination');
  counts.culminations++;
  if(star) {
    const invalid=O.solve({...base,year,poleStar:star,timing:'culmination',target:star});
    assert.equal(invalid.valid,false,'An exact rotation pole cannot set a transit time');
    assert.match(invalid.reason,/pole|rotation axis|culmination/i);
    // At the same instant, imposing a different axis cannot distort catalogue
    // angles or apply precession twice.
    const physical={...transit,poleStar:undefined,_positions:new WeakMap()};
    const before=O.position(target,physical),after=O.position(target,transit);
    near(O.separationDeg(before,after),0,1e-7,'Physical EQD positions unchanged');
  }
}

// With no pole star, the existing physical observer remains equivalent to the
// independent Astronomy Engine horizontal calculation.
const physical=O.solve(base);assert.ok(physical.valid);
for(const eq of [{raDeg:15,decDeg:-20},{raDeg:190,decDeg:75}]) {
  const expected=A.Horizon(physical.time,physical.observer,eq.raDeg/15,eq.decDeg);
  const actual=O.horizontal(eq,physical);
  near(actual.altitude,expected.altitude,1e-7);
  near(O.signedDeg(actual.azimuth-expected.azimuth),0,1e-7);
}

// Run the real selection/input/cache helpers, without a browser, to catch a
// date-only change that leaves the observer on the previous pole or vice versa.
const fields=new Map(),periods=[{value:'morning'},{value:'evening'}];
const $=selector=>{if(!fields.has(selector))fields.set(selector,{});return fields.get(selector);};
const ui={data,ObserverSky:O,Math,console,$,
  esc:s=>String(s),starKey:s=>s.hip?'HIP '+s.hip:s.id,starName:s=>s.name||s.hip,
  state:{center:'ncp',poleChoice:'ncp',observer:{enabled:true,latitude:32.54,longitude:44.42,year:1200,era:'bce',calendarDay:90,period:'morning',twilight:-9,timing:'solar',targetKey:'HIP 32349'}},
  selectedPoleFit:null,manualEpoch:{year:1200,era:'bce'},observerTargets:[target,...data.calibrationStars],
  observerSolution:null,skySolution:null,observerKey:'',epochCache:new Map(),horizonImageCache:null,
  document:{querySelectorAll(selector){assert.equal(selector,'[name="reading-period"]');return periods;}}
};
vm.createContext(ui);
vm.runInContext(['selectedPole','isAssumedPole','selectPole','syncObserverInputs','prepareObserver','epochPosition'].map(extract).join('\n'),ui);
for(const name of ['thuban','kochab','polaris']) {
  ui.selectPole(name);ui.prepareObserver();
  const fit=fits.get(ui.selectedPole().name),o=ui.state.observer;
  assert.equal(o.era==='bce'?1-o.year:o.year,fit.year,'Selection uses fitted epoch');
  assert.equal(o.calendarDay,90,'Selection preserves nominal calendar position');
  assert.equal(o.latitude,32.54);assert.equal(o.longitude,44.42);
  assert.equal($('#observer-year').disabled,true);assert.equal($('#observer-era').disabled,true);
  assert.ok(ui.observerSolution.valid,ui.observerSolution.reason);
  const pole=ui.epochPosition(ui.selectedPole());
  near(O.horizontal(pole,ui.observerSolution).altitude,o.latitude,1e-7,'Selection invalidates observer cache');
  const cached=ui.observerSolution;ui.prepareObserver();assert.equal(ui.observerSolution,cached);
}
ui.selectPole('custom');ui.prepareObserver();
assert.equal(ui.state.observer.year,1200);assert.equal(ui.state.observer.era,'bce');
assert.equal($('#observer-year').disabled,false);assert.equal($('#observer-era').disabled,false);
ui.state.observer.year=500;
ui.selectPole('thuban');ui.selectPole('custom');
assert.equal(ui.state.observer.year,500,'Custom restores last manually chosen epoch');
ui.state.observer.enabled=false;ui.prepareObserver();
assert.ok(ui.skySolution.valid,'Custom epoch remains active without observer readout');
ui.state.observer.enabled=true;

const thuban=data.calibrationStars.find(s=>s.name==='Thuban');
ui.state.observer.targetKey=ui.starKey(thuban);ui.state.observer.timing='culmination';
ui.selectPole('thuban');
assert.equal(ui.state.observer.timing,'solar','Selecting timing star as pole clears undefined transit');
assert.notEqual(ui.state.observer.targetKey,ui.starKey(thuban));
assert.ok(!$('#observer-target').innerHTML.includes('value="'+ui.starKey(thuban)+'"'),'Pole omitted from timing targets');
ui.state.observer.enabled=false;ui.prepareObserver();
assert.equal(ui.observerSolution,null);assert.ok(ui.skySolution.valid,'Fit epoch survives overlay toggle');
near(O.horizontal(ui.epochPosition(thuban),ui.skySolution).altitude,ui.state.observer.latitude,1e-7);
ui.state.observer.enabled=true;ui.state.observer.latitude=89.9;ui.prepareObserver();
assert.equal(ui.observerSolution.valid,false,'Polar no-twilight condition remains explicit');
assert.ok(ui.skySolution.valid,'No-event reading retains reconstructed epoch sky');
ui.selectPole('ncp');ui.state.observer.enabled=false;ui.prepareObserver();
assert.equal(ui.observerSolution,null);assert.equal(ui.skySolution,null,'Physical catalogue mode restores original frame');
console.log(JSON.stringify({status:'passed',...counts,selectionState:true,fits:Object.fromEntries(fits)},null,2));
