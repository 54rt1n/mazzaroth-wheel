/* ObserverSky 1.0 — local observer geometry for the Mazzaroth research atlas.
 * Requires Astronomy Engine v2.1.19 (MIT), vendored alongside this file.
 * Catalogue directions are ICRS/J2000-aligned; display directions use the true
 * equator/equinox of date. No atmospheric refraction or extinction is modelled.
 * Ancient civil timestamps and proper-motion extrapolations are model estimates.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/astronomy.browser.min.js'), require('./calendar.js'));
  } else {
    root.ObserverSky = factory(root.Astronomy, root.MazzarothTime);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Astronomy, Calendar) {
  'use strict';
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const MAS_RAD = D2R / 3600000;
  const SIDEREAL_DEG_PER_DAY = 360.98564736629;
  const seasonCache = new Map(), poleFitCache = new WeakMap(), poleEquinoxCache = new WeakMap();
  const finite = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));
  const norm = x => ((x % 360) + 360) % 360;
  const signed = x => norm(x + 180) - 180;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function vector(eq) {
    const a = Number(eq.raDeg) * D2R, d = Number(eq.decDeg) * D2R;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  }

  function equatorial(v) {
    const h = Math.hypot(v[0], v[1]);
    return { raDeg: norm(Math.atan2(v[1], v[0]) * R2D), decDeg: Math.atan2(v[2], h) * R2D };
  }

  function rotate(v, rotation) {
    // Astronomy Engine stores the image of each basis vector in a row.
    const m = rotation.rot;
    return [0, 1, 2].map(j => m[0][j] * v[0] + m[1][j] * v[1] + m[2][j] * v[2]);
  }

  function separationDeg(a, b) {
    const x = vector(a), y = vector(b);
    const cross = [x[1]*y[2]-x[2]*y[1], x[2]*y[0]-x[0]*y[2], x[0]*y[1]-x[1]*y[0]];
    return Math.atan2(Math.hypot(...cross), x[0]*y[0]+x[1]*y[1]+x[2]*y[2]) * R2D;
  }

  function basis(solution) {
    const p = solution.latitude * D2R, t = solution.lstDeg * D2R;
    const cp = Math.cos(p), sp = Math.sin(p), ct = Math.cos(t), st = Math.sin(t);
    return { up: [cp*ct, cp*st, sp], east: [-st, ct, 0], north: [-sp*ct, -sp*st, cp] };
  }

  function poleRotation(eq) {
    // Minimum rotation from the ordinary north pole to the assumed pole.
    // Astronomy-style rows hold the images of the three basis vectors.
    const [x,y,z] = vector(eq), k = 1/(1+z);
    if (z < -1+1e-10) throw new Error('The assumed north pole cannot be the south celestial pole.');
    return {rot:[[1-x*x*k,-x*y*k,-x],[-x*y*k,1-y*y*k,-y],[x,y,z]]};
  }

  function axisPosition(eq, solution) {
    if (!solution || !solution._poleRotation) return eq;
    const v=vector(eq), m=solution._poleRotation.rot;
    // Inverse of the orthogonal assumed-axis rotation.
    return equatorial(m.map(row=>row[0]*v[0]+row[1]*v[1]+row[2]*v[2]));
  }

  function horizontal(eq, solution) {
    if (!solution || !solution.valid || !finite(eq && eq.raDeg) || !finite(eq && eq.decDeg)) {
      return { altitude: NaN, azimuth: NaN, hourAngleDeg: NaN };
    }
    const s = vector(eq), b = solution._basis || basis(solution), axial = axisPosition(eq,solution);
    const dot = v => s[0]*v[0]+s[1]*v[1]+s[2]*v[2];
    const east = dot(b.east), north = dot(b.north), up = dot(b.up);
    return {
      altitude: Math.atan2(up, Math.hypot(east, north)) * R2D,
      azimuth: norm(Math.atan2(east, north) * R2D),
      hourAngleDeg: Math.abs(axial.decDeg)>90-1e-9 ? NaN : signed(solution.lstDeg - Number(axial.raDeg))
    };
  }

  function fromHorizontal(altitude, azimuth, solution) {
    if (!solution || !solution.valid || !finite(altitude) || !finite(azimuth)) {
      return { raDeg: NaN, decDeg: NaN };
    }
    const h = Number(altitude)*D2R, a = Number(azimuth)*D2R;
    const b = solution._basis || basis(solution);
    return equatorial([0, 1, 2].map(i => Math.cos(h)*(Math.sin(a)*b.east[i]+Math.cos(a)*b.north[i])+Math.sin(h)*b.up[i]));
  }

  function position(star, solution) {
    if (!solution || !solution.valid || !star) return { raDeg: NaN, decDeg: NaN };
    if (solution._positions && solution._positions.has(star)) return solution._positions.get(star);
    let result;
    if (Array.isArray(star.anchorStars) && star.anchorStars.length > 1) {
      const positions = star.anchorStars.map(s => position(s, solution)).filter(p => finite(p.raDeg) && finite(p.decDeg));
      if (!positions.length) return { raDeg: NaN, decDeg: NaN };
      const sum = positions.map(vector).reduce((s,v) => s.map((n,i) => n+v[i]), [0,0,0]);
      result = { ...equatorial(sum), anchorCount: positions.length, properMotionApplied: positions.some(p => p.properMotionApplied), coordinateRole: 'propagated spherical centroid' };
    } else {
      // PM components are tangent to the native catalogue direction, when given.
      const native = finite(star.nativeRaDeg) && finite(star.nativeDecDeg) && finite(star.nativeEpoch);
      if (!native && (!finite(star.raDeg) || !finite(star.decDeg))) return { raDeg: NaN, decDeg: NaN };
      const ra = native ? Number(star.nativeRaDeg) : Number(star.raDeg);
      const dec = native ? Number(star.nativeDecDeg) : Number(star.decDeg);
      if (!Number.isFinite(ra) || !Number.isFinite(dec) || dec < -90 || dec > 90) return { raDeg: NaN, decDeg: NaN };
      const epoch = native ? Number(star.nativeEpoch) : finite(star.coordinateEpoch) ? Number(star.coordinateEpoch) : 2000;
      const a = ra*D2R, d = dec*D2R;
      const dt = solution.julianYear - epoch;
      const pmA = finite(star.pmRaMasYr) ? Number(star.pmRaMasYr)*MAS_RAD : 0;
      const pmD = finite(star.pmDecMasYr) ? Number(star.pmDecMasYr)*MAS_RAD : 0;
      const v = vector({raDeg:ra,decDeg:dec});
      const tangentA = [-Math.sin(a), Math.cos(a), 0];
      const tangentD = [-Math.sin(d)*Math.cos(a), -Math.sin(d)*Math.sin(a), Math.cos(d)];
      const moved = v.map((n,i) => n+dt*(pmA*tangentA[i]+pmD*tangentD[i]));
      const length = Math.hypot(...moved);
      result = { ...equatorial(rotate(moved.map(n => n/length), solution.rotation)), properMotionApplied: finite(star.pmRaMasYr) || finite(star.pmDecMasYr), sourceEpoch: epoch };
    }
    if (solution._positions) solution._positions.set(star, result);
    return result;
  }

  function phaseTime(year, seasonDeg) {
    const key = year + ':' + seasonDeg;
    if (seasonCache.has(key)) return seasonCache.get(key);
    const equinox = Astronomy.SearchSunLongitude(0, Calendar.fromCivil(year, 3, 10), 25);
    if (!equinox) throw new Error('The March equinox could not be located for this year.');
    const result = seasonDeg === 0 ? equinox : Astronomy.SearchSunLongitude(seasonDeg, equinox.AddDays(seasonDeg/360*365.2422-10), 20);
    if (!result) throw new Error('The selected solar seasonal phase could not be located.');
    if (seasonCache.size > 256) seasonCache.clear();
    seasonCache.set(key, result);
    return result;
  }

  // One nominal year: 365 elapsed days occupy 360 calendar units.
  const calendarPosition = elapsedDays => norm(Number(elapsedDays)*360/365);
  const calendarElapsedDays = position => norm(Number(position))*365/360;
  function calendarTime(year, position, poleStar) {
    const origin = poleStar ? assumedEquinox(year,poleStar) : phaseTime(year,0);
    return origin.AddDays(calendarElapsedDays(position));
  }

  function eclipticPosition(longitude, solution) {
    if (!solution || !solution.valid || !finite(longitude)) return {raDeg:NaN,decDeg:NaN};
    const angle=Number(longitude)*D2R;
    const rotation=solution._eclipticRotation||(solution._eclipticRotation=Astronomy.Rotation_ECT_EQD(solution.time));
    return equatorial(rotate([Math.cos(angle),Math.sin(angle),0],rotation));
  }

  function frame(time, latitude, longitude, poleStar) {
    time = Astronomy.MakeTime(time);
    const solution = {
      valid: true, time,
      latitude, longitude,
      lstDeg: norm(Astronomy.SiderealTime(time)*15+longitude),
      julianYear: 2000+time.tt/365.25,
      rotation: Astronomy.Rotation_EQJ_EQD(time),
      frame: 'True equator and equinox of date (EQD)',
      _positions: new WeakMap()
    };
    solution._basis = basis(solution);
    if (poleStar) {
      solution.polePosition=position(poleStar,solution);
      if (!finite(solution.polePosition.raDeg) || !finite(solution.polePosition.decDeg)) throw new Error('The selected pole star has no usable position.');
      solution.poleStar=poleStar;
      solution.poleOffsetDeg=90-solution.polePosition.decDeg;
      solution._poleRotation=poleRotation(solution.polePosition);
      solution._basis=Object.fromEntries(Object.entries(solution._basis).map(([key,v])=>[key,rotate(v,solution._poleRotation)]));
      solution.observerFrame='Assumed stellar rotation axis; minimum tilt from the physical pole, preserving ephemeris sidereal phase';
    }
    return solution;
  }

  function meanPole(time) {
    // The mean north pole expressed in true EQD. Removing nutation from the
    // fitting objective prevents its short-period oscillations choosing a year.
    const tilt=Astronomy.e_tilt(time), m=tilt.mobl*D2R, t=tilt.tobl*D2R, p=tilt.dpsi/3600*D2R;
    return equatorial([-Math.sin(p)*Math.sin(m),Math.cos(p)*Math.sin(m)*Math.cos(t)-Math.cos(m)*Math.sin(t),Math.cos(p)*Math.sin(m)*Math.sin(t)+Math.cos(m)*Math.cos(t)]);
  }

  function poleFit(star) {
    if (!star || typeof star!=='object') throw new Error('Select a measured pole star.');
    if (poleFitCache.has(star)) return poleFitCache.get(star);
    const minYear=-2999,maxYear=3000;
    const score=year=>{
      const time=Astronomy.MakeTime(Calendar.fromCivil(year,7,1)), solution=frame(time,0,0);
      const offsetDeg=separationDeg(position(star,solution),meanPole(time));
      if (!Number.isFinite(offsetDeg)) throw new Error('The selected pole star has no usable position.');
      return {year,offsetDeg};
    };
    let best=score(minYear);
    for(let year=minYear+20;year<=maxYear;year+=20){const next=score(year);if(next.offsetDeg<best.offsetDeg)best=next;}
    const edge=score(maxYear);if(edge.offsetDeg<best.offsetDeg)best=edge;
    const low=Math.max(minYear,best.year-20),high=Math.min(maxYear,best.year+20);
    for(let year=low;year<=high;year++){const next=score(year);if(next.offsetDeg<best.offsetDeg)best=next;}
    const result=Object.freeze({...best,minYear,maxYear,boundary:best.year===minYear||best.year===maxYear,method:'Closest mean-pole alignment at midyear, with catalogue proper motion; integer-year model fit'});
    poleFitCache.set(star,result);return result;
  }

  function solarPosition(solution, observer) {
    if (solution.poleStar) {
      const sun=Astronomy.GeoVector(Astronomy.Body.Sun,solution.time,true);
      return equatorial(rotate([sun.x,sun.y,sun.z],solution.rotation));
    }
    const sun=Astronomy.Equator(Astronomy.Body.Sun,solution.time,observer,true,true);
    return {raDeg:sun.ra*15,decDeg:sun.dec};
  }

  function bisectCrossing(value,start,a,b,direction) {
    for(let i=0;i<45 && b-a>1e-9;i++){
      const mid=(a+b)/2;
      if(direction*value(start.AddDays(mid))>=0)b=mid;else a=mid;
    }
    return start.AddDays((a+b)/2);
  }

  function assumedEquinox(year,poleStar) {
    let cache=poleEquinoxCache.get(poleStar);
    if(!cache){cache=new Map();poleEquinoxCache.set(poleStar,cache);}
    if(cache.has(year))return cache.get(year);
    const start=phaseTime(year,0).AddDays(-60);
    const value=time=>{const s=frame(time,0,0,poleStar);return axisPosition(solarPosition(s),s).decDeg;};
    let previous=value(start);
    for(let day=1;day<=120;day++){
      const current=value(start.AddDays(day));
      if(previous<=0&&current>=0){const result=bisectCrossing(value,start,day-1,day,1);cache.set(year,result);return result;}
      previous=current;
    }
    throw new Error('The assumed-pole spring equinox could not be located near the March equinox.');
  }

  function assumedSolarTime(settings,dayStart) {
    const direction=settings.period==='morning'?1:-1;
    const value=time=>{const s=frame(time,settings.latitude,settings.longitude,settings.poleStar);return horizontal(solarPosition(s),s).altitude-settings.sunAltitude;};
    const step=1/96, samples=[];
    // Include samples outside the day so a grazing event near midnight still
    // has an extrema bracket. Refine extrema to detect narrow polar crossings.
    for(let i=-1;i<=97;i++)samples.push({t:i*step,y:value(dayStart.AddDays(i*step))});
    const nodes=samples.filter(p=>p.t>=0&&p.t<=1);
    for(let i=1;i<samples.length-1;i++){
      const a=samples[i-1],b=samples[i],c=samples[i+1];
      const maximum=b.y>a.y&&b.y>c.y,minimum=b.y<a.y&&b.y<c.y;
      if(!maximum&&!minimum)continue;
      let lo=a.t,hi=c.t;
      for(let j=0;j<30;j++){
        const x=lo+(hi-lo)/3,z=hi-(hi-lo)/3;
        const fx=value(dayStart.AddDays(x)),fz=value(dayStart.AddDays(z));
        if(maximum?fx<fz:fx>fz)lo=x;else hi=z;
      }
      const t=(lo+hi)/2;if(t>0&&t<1)nodes.push({t,y:value(dayStart.AddDays(t))});
    }
    nodes.sort((a,b)=>a.t-b.t);
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i];
      if(direction*a.y<=0&&direction*b.y>0)return bisectCrossing(value,dayStart,a.t,b.t,direction);
    }
    return null;
  }

  function epochFrame(input) {
    const settings=Object.assign({year:-1199,calendarDay:90,latitude:32.54,longitude:44.42},input||{});
    try {
      for(const key of ['year','calendarDay','latitude','longitude']){
        if(!finite(settings[key]))throw new Error('Invalid '+key+'.');
        settings[key]=Number(settings[key]);
      }
      if(!Number.isInteger(settings.year)||settings.year < -2999||settings.year > 3000)throw new Error('Choose a year from 3000 BCE to 3000 CE.');
      if(!finite(settings.calendarDay)||settings.calendarDay<0||settings.calendarDay>=360)throw new Error('Choose a nominal calendar position from 0 up to 360.');
      if(settings.latitude < -90||settings.latitude > 90)throw new Error('Latitude must be between −90° and +90°.');
      if(settings.longitude < -180||settings.longitude > 180)throw new Error('Longitude must be between −180° and +180°.');
      const time=calendarTime(settings.year,settings.calendarDay,settings.poleStar);
      const result=frame(time,settings.latitude,settings.longitude,settings.poleStar);
      if(settings.poleStar)result.poleFit=poleFit(settings.poleStar);
      return Object.assign(result,{settings,calendarDay:settings.calendarDay,calendarElapsedDays:calendarElapsedDays(settings.calendarDay)});
    } catch(error){return {valid:false,reason:error.message||String(error),settings};}
  }

  function localLabels(time, longitude) {
    return Calendar.localLabels(Calendar.utDays(time.ut), longitude);
  }

  function solve(input) {
    const settings = Object.assign({ year: -1199, seasonDeg: 90, latitude: 32.54, longitude: 44.42, period: 'morning', sunAltitude: -9, timing: 'solar' }, input || {});
    try {
      if (!Astronomy) throw new Error('Astronomy Engine has not loaded.');
      ['year','seasonDeg','latitude','longitude','sunAltitude'].forEach(k => {
        if (!finite(settings[k])) throw new Error('Invalid '+k+'.');
        settings[k] = Number(settings[k]);
      });
      if (!Number.isInteger(settings.year) || settings.year < -2999 || settings.year > 3000) throw new Error('Choose a year from 3000 BCE to 3000 CE.');
      if (settings.latitude < -90 || settings.latitude > 90) throw new Error('Latitude must be between −90° and +90°.');
      if (settings.longitude < -180 || settings.longitude > 180) throw new Error('Longitude must be between −180° and +180°.');
      if (settings.sunAltitude < -30 || settings.sunAltitude > 0) throw new Error('Choose a solar altitude from −30° to 0°.');
      if (!['morning','evening'].includes(settings.period)) throw new Error('Choose morning or evening.');
      if (!['solar','culmination'].includes(settings.timing)) throw new Error('Choose solar or culmination timing.');
      settings.seasonDeg = norm(settings.seasonDeg);
      const nominalCalendar = settings.calendarDay !== undefined;
      if (nominalCalendar) {
        if (!finite(settings.calendarDay) || settings.calendarDay < 0 || settings.calendarDay >= 360) throw new Error('Choose a nominal calendar position from 0 up to 360.');
        settings.calendarDay = Number(settings.calendarDay);
      }
      const observer = new Astronomy.Observer(settings.latitude, settings.longitude, 0);
      const seasonalCrossing = nominalCalendar ? calendarTime(settings.year, settings.calendarDay, settings.poleStar) : phaseTime(settings.year, settings.seasonDeg);
      const dayStart = Astronomy.MakeTime(Calendar.localMeanMidnight(Calendar.utDays(seasonalCrossing.ut), settings.longitude));
      const solarTime = settings.poleStar ? assumedSolarTime(settings,dayStart) : Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, settings.period==='morning'?1:-1, dayStart, 1, settings.sunAltitude);
      let time = solarTime;
      if (!time && settings.timing==='solar') throw new Error('The Sun does not cross this altitude on the selected local day. Try another season, latitude, or solar altitude.');
      if (settings.timing==='culmination') {
        if (!settings.target || !finite(settings.target.raDeg) || !finite(settings.target.decDeg)) throw new Error('Select a measured star or located entry for culmination timing.');
        time = time || dayStart.AddDays(settings.period==='morning'?.25:.75);
        // Start at the selected twilight event, then find the nearest upper
        // transit. Recompute PM and date frame during iteration.
        for (let i=0; i<8; i++) {
          const current = frame(time, settings.latitude, settings.longitude, settings.poleStar);
          const eq = position(settings.target, current);
          const error = horizontal(eq,current).hourAngleDeg;
          if (!Number.isFinite(error)) throw new Error('A star on the rotation pole has no unique culmination. Select a different timing star.');
          if (Math.abs(error)<1e-7) break;
          time = time.AddDays(-error/SIDEREAL_DEG_PER_DAY);
        }
      }
      const solution = frame(time, settings.latitude, settings.longitude, settings.poleStar);
      const sunEquatorial = solarPosition(solution,observer);
      const sunHorizontal = horizontal(sunEquatorial, solution);
      const solarHour = sunHorizontal.hourAngleDeg;
      Object.assign(solution,localLabels(time,settings.longitude),{
        settings,
        observer,
        seasonalCrossing,
        solarReferenceTime: solarTime,
        seasonDeg: nominalCalendar ? Astronomy.SunPosition(seasonalCrossing).elon : settings.seasonDeg,
        calendarDay: nominalCalendar ? settings.calendarDay : null,
        calendarElapsedDays: nominalCalendar ? calendarElapsedDays(settings.calendarDay) : null,
        actualSolarLongitude: Astronomy.SunPosition(time).elon,
        sunEquatorial,
        sunAltitude: sunHorizontal.altitude,
        sunAzimuth: sunHorizontal.azimuth,
        period: settings.period,
        timing: settings.timing,
        isNight: sunHorizontal.altitude<0,
        matchesPeriod: settings.period==='morning'?solarHour<0:solarHour>0,
        warnings: []
      });
      if (settings.year < 1600) solution.warnings.push('Ancient solar position, Earth rotation, and stellar motion are extrapolated models; the displayed clock time is not an ancient timestamp.');
      if (settings.poleStar) {
        solution.poleFit=poleFit(settings.poleStar);
        solution.warnings.push('Idealized stellar rotation pole: the star is treated as the exact axis. Solar altitude is geocentric; sidereal phase follows the physical ephemeris under a minimum-tilt convention.');
      }
      if (settings.timing==='culmination') {
        solution.targetPosition=position(settings.target,solution);
        solution.targetHorizontal=horizontal(solution.targetPosition,solution);
        solution.targetName=settings.target.name||settings.target.properName||settings.target.ancientName||'Selected star';
        if (!solution.isNight) solution.warnings.push('The selected target culminates in daylight on this seasonal date.');
        if (!solution.matchesPeriod) solution.warnings.push('The nearest upper culmination lies outside the selected morning/evening half of the day.');
      }
      return solution;
    } catch(error) {
      return {valid:false,reason:error && error.message ? error.message : String(error),settings};
    }
  }

  return Object.freeze({solve,position,horizontal,fromHorizontal,eclipticPosition,separationDeg,normalizeDeg:norm,signedDeg:signed,calendarPosition,calendarElapsedDays,calendarTime,poleFit,epochFrame,frameAt:frame,axisPosition,
    version:'1.1.0',engineVersion:'2.1.19',modelNote:'Geometric horizon; precession and nutation of date; tangent-vector proper motion when catalogued. Optional assumed stellar axis with geocentric solar altitude and a corresponding spring equinox. No refraction, terrain, extinction, radial-velocity perspective acceleration, or star aberration.'});
});
