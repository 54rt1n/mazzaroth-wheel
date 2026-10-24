// Independent geometric controls for the actual rendering implementation.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const begin=app.indexOf('  function projectionCenter()'),end=app.indexOf('  function localZoom(');
assert(begin>=0&&end>begin,'Locate projection helpers in the application');
const finite=app.match(/const finite =[^\n]+/);
assert(finite,'Locate coordinate validation');
const context={state:{center:'ncp',rotation:0},data,Math,coordinateLookup:new Map(),epochPosition:s=>s};vm.createContext(context);
vm.runInContext(finite[0]+'\n'+app.slice(begin,end)+';this.project=skyPoint;this.distance=centerDistance;',context);
const near=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const angularDistance=(a,b)=>{
 const rad=Math.PI/180,dd=(a.decDeg-b.decDeg)*rad/2,da=(a.raDeg-b.raDeg)*rad/2;
 const h=Math.sin(dd)**2+Math.cos(a.decDeg*rad)*Math.cos(b.decDeg*rad)*Math.sin(da)**2;
 return 2*Math.atan2(Math.sqrt(Math.max(0,h)),Math.sqrt(Math.max(0,1-h)))/rad;
};
const cases=[[[0,90],[0,0]],[[0,0],[0,-177.5]],[[90,0],[177.5,0]],[[180,0],[0,177.5]],[[270,0],[-177.5,0]]];
for(const [[ra,dec],expected] of cases){const p=context.project(ra,dec);near(p[0],expected[0]);near(p[1],expected[1]);}
const polaris=data.calibrationStars.find(s=>s.name==='Polaris');
assert(polaris.angularDistanceToNorthPoleDeg>0.73&&polaris.angularDistanceToNorthPoleDeg<0.74,'Polaris is close to, but not at, the pole');
for(const s of data.calibrationStars)near(context.distance(s.raDeg,s.decDeg),s.angularDistanceToNorthPoleDeg);
context.state.rotation=90;
const rotated=context.project(0,0);near(rotated[0],177.5);near(rotated[1],0);
const samples=data.entries.filter(s=>s.raDeg!==null&&s.decDeg!==null);
let distanceChecks=0,rotationChecks=0;
for(const center of data.calibrationStars){
 context.state.center=center.name.toLowerCase();context.state.rotation=0;
 const origin=context.project(center.raDeg,center.decDeg);near(origin[0],0);near(origin[1],0);
 const antipode=context.project((center.raDeg+180)%360,-center.decDeg);near(Math.hypot(...antipode),355);
 near(context.distance(0,90),90-center.decDeg);
 for(const sample of samples){
  const p=context.project(sample.raDeg,sample.decDeg);
  near(Math.hypot(...p)/355*180,angularDistance(center,sample));distanceChecks++;
  context.state.rotation=90;const q=context.project(sample.raDeg,sample.decDeg);
  near(q[0],-p[1]);near(q[1],p[0]);rotationChecks++;
  context.state.rotation=0;
 }
}
context.state.center='thuban';
assert(Math.hypot(...context.project(0,90))>50,'True NCP moves away from the origin in the Thuban projection');
assert(context.project(null,0).every(Number.isNaN));assert(context.project(0,91).every(Number.isNaN));
console.log(JSON.stringify({cardinalControls:5,calibrationStars:3,centreOrigins:3,greatCircleDistanceChecks:distanceChecks,rotationChecks,polarisPoleOffsetDeg:polaris.angularDistanceToNorthPoleDeg,status:'passed'}));
