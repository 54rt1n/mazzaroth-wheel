// Ground-sky camera controls and the actual observer-to-renderer handoff.
// Synthetic cardinal directions give independently known screen positions;
// catalogue checks compare against the observer's equatorial basis directly.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const G=require('../dist/ground-sky.js');
const O=require('../dist/observer.js');
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const rad=Math.PI/180;
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const near=(a,b,tolerance=1e-8,message='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${message}: ${a} differs from ${b}`);
const nearVector=(a,b,message)=>a.forEach((v,i)=>near(v,b[i],1e-8,message));
const eqVector=eq=>[Math.cos(eq.decDeg*rad)*Math.cos(eq.raDeg*rad),Math.cos(eq.decDeg*rad)*Math.sin(eq.raDeg*rad),Math.sin(eq.decDeg*rad)];
const eqFromVector=v=>({raDeg:O.normalizeDeg(Math.atan2(v[1],v[0])/rad),decDeg:Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad});
const width=1000,height=600;
const view=(azimuth=0,altitude=0,fov=100)=>({azimuth,altitude,fov});
const p=(altitude,azimuth,camera=view())=>G.project(G.horizontalVector(altitude,azimuth),camera,width,height);
const counts={cardinalScreens:0,orthonormalCameras:0,frustumClips:0,observerSolutions:0,observerBasisDirections:0,catalogueHandoffs:0};

nearVector(G.horizontalVector(0,0),[0,1,0],'North vector');
nearVector(G.horizontalVector(0,90),[1,0,0],'East vector');
nearVector(G.horizontalVector(0,180),[0,-1,0],'South vector');
nearVector(G.horizontalVector(0,270),[-1,0,0],'West vector');
nearVector(G.horizontalVector(90,47),[0,0,1],'Zenith vector');
nearVector(G.horizontalVector(-90,225),[0,0,-1],'Nadir vector');

for(const azimuth of [0,90,180,270,359]) {
  const centre=p(0,azimuth,view(azimuth));
  near(centre.x,width/2);near(centre.y,height/2);assert.equal(centre.visible,true);
  const left=p(0,azimuth-30,view(azimuth)),right=p(0,azimuth+30,view(azimuth));
  assert.ok(left.x<centre.x&&right.x>centre.x,'Increasing azimuth moves right from inside the celestial sphere');
  near(left.y,height/2);near(right.y,height/2);
  const higher=p(15,azimuth,view(azimuth)),lower=p(-15,azimuth,view(azimuth));
  assert.ok(higher.y<centre.y&&lower.y>centre.y,'Positive altitude projects above the horizon');
  assert.equal(p(0,azimuth+180,view(azimuth)),null,'Antipodal sky is not painted through the camera');
  counts.cardinalScreens++;
}

// When facing south, the eastern sky must be on the left; facing north it is
// on the right. A wheel-like mirrored projection would fail this control.
assert.ok(p(0,135,view(180)).x<width/2);
assert.ok(p(0,225,view(180)).x>width/2);
assert.ok(p(0,45,view(0)).x>width/2);

for(const azimuth of [-1,0,47,180,359,721])for(const altitude of [-90,-89.999,0,89.999,90]) {
  const b=G.cameraBasis(view(azimuth,altitude));
  for(const key of ['forward','right','up'])near(Math.hypot(...b[key]),1,1e-10,'Unit camera basis');
  near(dot(b.forward,b.right),0);near(dot(b.forward,b.up),0);near(dot(b.right,b.up),0);
  const origin=p(altitude,azimuth,view(azimuth,altitude));
  assert.ok(origin&&origin.visible,'View remains defined at zenith and nadir');
  near(origin.x,width/2);near(origin.y,height/2);
  counts.orthonormalCameras++;
}
near(G.normalizeView(view(-1)).azimuth,359);
near(G.normalizeView(view(721)).azimuth,1);
near(G.normalizeView(view(0,120,200)).altitude,90);
near(G.normalizeView(view(0,-120,10)).altitude,-90);
near(G.normalizeView(view(0,0,200)).fov,120);
near(G.normalizeView(view(0,0,10)).fov,25);

for(const fov of [25,60,100,120]) {
  const v=view(0,0,fov),halfVertical=Math.atan(Math.tan(fov*rad/2)*height/width)/rad;
  near(p(0,-fov/2,v).x,0,1e-6,'Horizontal FOV left edge');
  near(p(0,fov/2,v).x,width,1e-6,'Horizontal FOV right edge');
  near(p(halfVertical,0,v).y,0,1e-6,'Aspect-aware upper edge');
  near(p(-halfVertical,0,v).y,height,1e-6,'Aspect-aware lower edge');
  assert.equal(p(0,fov/2+1,v).visible,false,'Front-facing offscreen point is excluded from picking');
}
nearVector([p(10,-1).x,p(10,-1).y],[p(10,359).x,p(10,359).y],'Azimuth wrap continuity');

const horizonSegment=G.projectSegment(G.horizontalVector(0,-70),G.horizontalVector(0,70),view(),width,height);
assert.ok(horizonSegment,'Horizon crosses the complete viewport');
near(horizonSegment[0][0],0,1e-6);near(horizonSegment[1][0],width,1e-6);
for(const q of horizonSegment)near(q[1],height/2);
counts.frustumClips++;
assert.equal(G.projectSegment(G.horizontalVector(0,150),G.horizontalVector(0,210),view(),width,height),null,'Back hemisphere segment is culled');
counts.frustumClips++;
for(const pair of [ [[0,0],[0,140]], [[0,-140],[0,0]], [[80,0],[-80,0]], [[0,-70],[0,70]] ]) {
  const clipped=G.projectSegment(...pair.map(a=>G.horizontalVector(...a)),view(),width,height);
  assert.ok(clipped,'Crossing segment has a visible portion');
  for(const q of clipped) {
    assert.ok(q.every(Number.isFinite),'Clipped segment contains finite screen positions');
    assert.ok(q[0]>=-1e-6&&q[0]<=width+1e-6&&q[1]>=-1e-6&&q[1]<=height+1e-6,'Line clipped to the view frustum');
  }
  counts.frustumClips++;
}

const poles=[null,...data.calibrationStars.filter(s=>['Thuban','Kochab'].includes(s.name))];
const sampleStars=[32349,102098,11767,68756].map(hip=>data.stars.find(s=>s.hip===hip)||data.calibrationStars.find(s=>s.hip===hip)).filter(Boolean);
assert.ok(sampleStars.length>=3,'Bright catalogue and polar controls are present');
for(const poleStar of poles)for(const latitude of [1,32.54])for(const period of ['morning','evening']) {
  const year=poleStar?O.poleFit(poleStar).year:-1199;
  const solution=O.solve({year,poleStar,latitude,longitude:44.42,calendarDay:90,period,sunAltitude:-9,timing:'solar'});
  assert.ok(solution.valid,`${poleStar?.name||'NCP'} ${latitude} ${period}: ${solution.reason}`);
  counts.observerSolutions++;
  // Derive cardinal celestial directions from the actual observer basis, not
  // from fromHorizontal, so an incorrect frame handoff cannot self-cancel.
  for(const [axis,altitude,azimuth] of [['north',0,0],['east',0,90],['up',90,0]]) {
    const horizontal=O.horizontal(eqFromVector(solution._basis[axis]),solution);
    const local=G.horizontalVector(horizontal.altitude,horizontal.azimuth);
    nearVector(local,G.horizontalVector(altitude,azimuth),'Observer basis maps to the correct ground direction');
    const screen=G.project(local,view(azimuth,altitude),width,height);
    near(screen.x,width/2,1e-6);near(screen.y,height/2,1e-6);
    counts.observerBasisDirections++;
  }
  const poleEq=poleStar?O.position(poleStar,solution):{raDeg:0,decDeg:90};
  const poleH=O.horizontal(poleEq,solution);
  near(poleH.altitude,latitude,1e-7,'Selected rotation pole altitude matches observer latitude');
  near(O.signedDeg(poleH.azimuth),0,1e-7,'Selected rotation pole is due north');
  for(const star of sampleStars) {
    const eq=O.position(star,solution),h=O.horizontal(eq,solution),v=eqVector(eq);
    const local=G.horizontalVector(h.altitude,h.azimuth);
    nearVector(local,['east','north','up'].map(axis=>dot(v,solution._basis[axis])),'Catalogue epoch-to-horizontal-to-camera handoff');
    const screen=G.project(local,view(h.azimuth,h.altitude),width,height);
    near(screen.x,width/2,1e-6);near(screen.y,height/2,1e-6);
    counts.catalogueHandoffs++;
  }
}
console.log(JSON.stringify({...counts,status:'passed'}));
