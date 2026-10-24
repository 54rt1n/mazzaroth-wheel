// Checks the actual application projection and horizon raster against the
// independently tested observer core, without requiring a browser or duplicating
// the application geometry under test.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ObserverSky=require('../dist/observer.js');
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const extract=name=>{
  const start=app.indexOf('  function '+name+'(');
  assert.ok(start>=0,`Find actual ${name} implementation`);
  const end=app.indexOf('\n  function ',start+1);
  assert.ok(end>start,`Find end of ${name}`);
  return app.slice(start,end);
};
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const coordinateLookup=new Map();
for(const s of [...data.stars,...data.entries,...data.entries.flatMap(e=>e.anchorStars||[]),...data.calibrationStars]) {
  if(s.raDeg!==null&&s.raDeg!==undefined&&s.decDeg!==null&&s.decDeg!==undefined) coordinateLookup.set(`${s.raDeg},${s.decDeg}`,s);
}
let raster=null;
const context={
  state:{center:'ncp',rotation:0,observer:{enabled:true,latitude:32.54,longitude:44.42,year:1200,era:'bce',calendarDay:90,period:'morning',twilight:-9,timing:'solar',targetKey:''}},
  data,Math,ObserverSky,coordinateLookup,epochCache:new Map(),observerSolution:null,skySolution:null,observerKey:'',horizonImageCache:null,observerTargets:data.calibrationStars,
  starKey:s=>s.hip?'HIP '+s.hip:s.id,
  document:{createElement(tag){
    assert.equal(tag,'canvas');
    return {width:0,height:0,getContext(){return {
      createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
      putImageData(im){raster=im;}
    };},toDataURL(){return 'data:image/png;base64,test-raster';}};
  }}
};
vm.createContext(context);
const finite=app.match(/const finite =[^\n]+/);
assert.ok(finite);
vm.runInContext(finite[0]+'\n'+['selectedPole','epochPosition','prepareObserver','projectionCenter','skyPoint','projectEquatorial','centerDistance','inverseProjectedVector','horizonImage'].map(extract).join('\n'),context);
context.prepareObserver();
assert.ok(context.observerSolution.valid,context.observerSolution.reason);
const originalSolution=context.observerSolution;
context.prepareObserver();
assert.equal(context.observerSolution,originalSolution,'unchanged controls retain the same solution');

const toEq=v=>({raDeg:ObserverSky.normalizeDeg(Math.atan2(v[1],v[0])*180/Math.PI),decDeg:Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI});
let starChecks=0,horizonChecks=0,meridianChecks=0,rasterChecks=0;
for(const latitude of [32.54,-32.54]) for(const period of ['morning','evening']) {
  context.state.observer.latitude=latitude;
  context.state.observer.period=period;
  for(const center of ['ncp','polaris','thuban','kochab']) {
    context.state.center=center;
    context.prepareObserver();
    const solution=context.observerSolution;
    assert.ok(solution.valid,solution.reason);
    context.state.rotation=0;
    const c=context.projectionCenter();
    near(Math.hypot(...context.projectEquatorial(c.raDeg,c.decDeg)),0);
    // The epoch pole is not transformed a second time as a J2000 catalogue star.
    near(Math.hypot(...context.projectEquatorial(0,90))/355*180,90-c.decDeg);
    if(center!=='ncp') {
      const raw=data.calibrationStars.find(s=>s.name.toLowerCase()===center);
      near(Math.hypot(...context.skyPoint(raw.raDeg,raw.decDeg)),0);
    }
    for(const raw of [...data.calibrationStars,...data.entries.filter(s=>s.raDeg!==null&&s.decDeg!==null)]) {
      const eq=context.epochPosition(coordinateLookup.get(`${raw.raDeg},${raw.decDeg}`)||raw);
      const p=context.skyPoint(raw.raDeg,raw.decDeg);
      const direct=context.projectEquatorial(eq.raDeg,eq.decDeg);
      near(p[0],direct[0]);near(p[1],direct[1]);
      const recovered=toEq(context.inverseProjectedVector(...p));
      near(ObserverSky.separationDeg(eq,recovered),0);
      context.state.rotation=90;
      const rotated=context.projectEquatorial(eq.raDeg,eq.decDeg);
      near(rotated[0],-p[1]);near(rotated[1],p[0]);
      context.state.rotation=0;
      starChecks++;
    }
    for(const rotation of [0,47,180]) {
      context.state.rotation=rotation;
      // Every projected point must recover the observer's north–zenith–south
      // great circle in the selected physical or assumed-pole frame.
      for(let t=0;t<=180;t+=1) {
        const altitude=t<=90?t:180-t,azimuth=t<=90?0:180;
        const eq=ObserverSky.fromHorizontal(altitude,azimuth,solution);
        const xy=context.projectEquatorial(eq.raDeg,eq.decDeg);
        const recovered=toEq(context.inverseProjectedVector(...xy));
        const horizontal=ObserverSky.horizontal(recovered,solution);
        near(horizontal.altitude,altitude);
        if(t!==90)near(ObserverSky.signedDeg(horizontal.azimuth-azimuth),0);
        meridianChecks++;
      }
      for(let az=0;az<360;az+=5) {
        const eq=ObserverSky.fromHorizontal(0,az,solution);
        const xy=context.projectEquatorial(eq.raDeg,eq.decDeg);
        const recovered=toEq(context.inverseProjectedVector(...xy));
        near(ObserverSky.horizontal(recovered,solution).altitude,0);
        horizonChecks++;
      }
      context.horizonImage();
      assert.ok(raster);
      for(let j=7;j<raster.height;j+=17) for(let i=5;i<raster.width;i+=19) {
        const x=(i+.5-raster.width/2)/(raster.width/2)*355;
        const y=(j+.5-raster.height/2)/(raster.height/2)*355;
        const alpha=raster.data[(j*raster.width+i)*4+3];
        if(Math.hypot(x,y)>355)assert.equal(alpha,0);
        else {
          const eq=toEq(context.inverseProjectedVector(x,y));
          const h=ObserverSky.horizontal(eq,solution).altitude;
          assert.equal(alpha>0,h<0,`shader sign differs at ${center}/${period}/${rotation}: ${h}°`);
        }
        rasterChecks++;
      }
    }
  }
}
// Toggle the observer off: the original catalogue frame returns, with no stale
// ancient coordinates cached through the setting change.
context.state.center='ncp';context.state.observer.enabled=false;context.prepareObserver();
assert.equal(context.observerSolution,null);
assert.equal(context.epochCache.size,0);
context.state.center='ncp';context.state.rotation=0;
near(context.skyPoint(90,0)[0],177.5);near(context.skyPoint(90,0)[1],0);
context.state.observer.enabled=true;context.state.observer.year=3000;context.prepareObserver();
assert.ok(context.observerSolution.valid);
assert.notEqual(context.observerSolution,originalSolution);

console.log(JSON.stringify({starChecks,horizonChecks,meridianChecks,rasterChecks,centres:4,latitudes:2,periods:2,rotations:3,cacheInvalidation:true,status:'passed'}));
