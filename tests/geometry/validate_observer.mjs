import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const O=require('../dist/observer.js');
const A=require('../dist/vendor/astronomy.browser.min.js');
const data=JSON.parse(readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} is not within ${tolerance} of ${b}`);
const settings={year:-1199,seasonDeg:90,latitude:32.54,longitude:44.42,sunAltitude:-9,period:'morning'};

for(const year of [-2999,-1999,-1199,0,1,50,99,100,2000,2100]) {
  for(const period of ['morning','evening']) {
    const s=O.solve({...settings,year,period});
    assert.ok(s.valid,JSON.stringify({year,period,reason:s.reason}));
    near(s.sunAltitude,-9,.0001);
    assert.ok(s.matchesPeriod);
    assert.ok(Math.abs(s.time.date.getUTCFullYear()-year)<=1);
  }
}

const s=O.solve(settings);
near(O.horizontal({raDeg:0,decDeg:90},s).altitude,settings.latitude);
near(O.horizontal({raDeg:s.lstDeg,decDeg:0},s).altitude,90-settings.latitude);
for(const altitude of [-65,0,5,45,88]) for(const azimuth of [0,30,90,180,270,355]) {
  const eq=O.fromHorizontal(altitude,azimuth,s);
  const hor=O.horizontal(eq,s);
  near(hor.altitude,altitude);
  near(O.signedDeg(hor.azimuth-azimuth),0);
  const reference=A.Horizon(s.time,s.observer,eq.raDeg/15,eq.decDeg);
  near(reference.altitude,altitude,.000001);
  near(O.signedDeg(reference.azimuth-azimuth),0,.000001);
}

// All points traced for the horizon are genuinely at altitude zero.
for(let az=0;az<360;az+=5) near(O.horizontal(O.fromHorizontal(0,az,s),s).altitude,0);
// Precession/nutation must preserve star separations when PM is disabled.
const p={raDeg:15,decDeg:-20},q={raDeg:160,decDeg:45};
near(O.separationDeg(p,q),O.separationDeg(O.position(p,s),O.position(q,s)));

const sirius=data.stars.find(x=>x.hip===32349);
const fixed={...sirius,pmRaMasYr:0,pmDecMasYr:0};
const motion=O.separationDeg(O.position(sirius,s),O.position(fixed,s));
assert.ok(motion>1 && motion<1.4,`Sirius motion over 3200 years: ${motion}`);
// PM in RA is mu_alpha*cos(delta): propagation must remain finite near poles.
const pole=O.position({raDeg:0,decDeg:89.999,coordinateEpoch:2000,pmRaMasYr:1000,pmDecMasYr:0},s);
assert.ok(Number.isFinite(pole.raDeg)&&Number.isFinite(pole.decDeg));

const target=data.calibrationStars.find(x=>x.name==='Thuban');
const transit=O.solve({...settings,timing:'culmination',target});
assert.ok(transit.valid,transit.reason);
near(transit.targetHorizontal.hourAngleDeg,0,.00001);
// Culmination time is inferred, not forced to keep the chosen twilight altitude.
assert.ok(Math.abs(transit.sunAltitude-settings.sunAltitude)>.1);

// Same locally defined solar reading has nearly identical local stellar geometry
// over a modest longitude shift; a changed UTC clock is not a changed latitude.
const west=O.solve({...settings,longitude:24.42});
assert.ok(west.valid);
near(O.signedDeg(west.lstDeg-s.lstDeg),0,.15);
assert.ok(Math.abs((west.time.ut-s.time.ut)*24-20/15)<.05);

const centroid=O.position({anchorStars:[p,q],raDeg:0,decDeg:0},s);
near(O.separationDeg(O.position(p,s),centroid),O.separationDeg(O.position(q,s),centroid));
assert.equal(centroid.anchorCount,2);
assert.ok(Number.isNaN(O.position({raDeg:null,decDeg:null},s).raDeg));
// Ecliptic points must use the epoch's equator; ecliptic north-pole orthogonality
// is preserved when the curve is rendered around any selected sky centre.
near(O.separationDeg(O.eclipticPosition(0,s),O.eclipticPosition(90,s)),90);
near(O.separationDeg(O.eclipticPosition(0,s),O.eclipticPosition(180,s)),180);

assert.equal(O.solve({...settings,latitude:91}).valid,false);
assert.equal(O.solve({...settings,year:-4000}).valid,false);
assert.equal(O.solve({...settings,latitude:89,seasonDeg:90}).valid,false);
assert.equal(O.solve({...settings,timing:'culmination'}).valid,false);

// Nominal date controls must advance uniformly in elapsed days, independently
// of the Sun's nonuniform ecliptic motion and of the morning/evening readout.
for (const year of [-1199,0,2024]) {
  const origin=O.calendarTime(year,0);
  near(O.signedDeg(A.SunPosition(origin).elon),0,.0001);
  for (const calendarDay of [0,29,30,90,180,270,359]) {
    for (const period of ['morning','evening']) {
      const nominal=O.solve({...settings,year,calendarDay,period});
      assert.ok(nominal.valid,nominal.reason);
      near(nominal.seasonalCrossing.ut-origin.ut,calendarDay*365/360,1e-8);
      near(nominal.sunAltitude,-9,.001); // SearchAltitude resolves the event to a fraction of a second.
      assert.equal(nominal.calendarDay,calendarDay);
    }
  }
}
near(O.calendarPosition(365),0);
near(O.calendarPosition(91.25),90);
assert.equal(O.solve({...settings,calendarDay:360}).valid,false);
assert.equal(O.solve({...settings,calendarDay:-1}).valid,false);

// Southern and equatorial observers use the same geometry and date controls.
// Seasonal polar no-event cases must return a useful error, not invalid coordinates.
for (const latitude of [-65,-33,-32.54,0]) for (const calendarDay of [0,90,180,270]) {
  for (const period of ['morning','evening']) {
    const south=O.solve({...settings,latitude,calendarDay,period});
    if(!south.valid) {
      assert.equal(latitude,-65);
      assert.match(south.reason,/Sun does not cross/);
      continue;
    }
    near(south.sunAltitude,-9,.001);
    near(O.horizontal({raDeg:0,decDeg:90},south).altitude,latitude);
    for(const azimuth of [0,90,180,270])near(O.horizontal(O.fromHorizontal(0,azimuth,south),south).altitude,0);
    near(O.horizontal(O.fromHorizontal(90,0,south),south).altitude,90);
  }
}
const polarSouth=O.solve({...settings,latitude:-89,calendarDay:90});
assert.equal(polarSouth.valid,false);
assert.match(polarSouth.reason,/Sun does not cross/);

console.log('Observer checks passed: BCE/year-zero dates; dawn/dusk; horizon and cardinal frames; independent engine cross-check; motion; centroids; culmination; longitude; invalid/no-event cases.');
console.log(JSON.stringify({reference:s.dateLabel,time:s.localTimeLabel,sunAltitude:s.sunAltitude,thubanTransit:transit.localTimeLabel,thubanSunAltitude:transit.sunAltitude,siriusMotionDeg:motion},null,2));
