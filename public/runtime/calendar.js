(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.MazzarothTime = {}));
})(this, (function(exports2) {
  "use strict";
  const MILLISECONDS_PER_DAY = 864e5;
  const UNIX_DAYS_AT_J2000 = 10957.5;
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function utDays(value) {
    if (!Number.isFinite(value)) throw new RangeError("UT day value must be finite.");
    return value;
  }
  function astronomicalYear(year, era) {
    if (!Number.isSafeInteger(year) || year < 1) throw new RangeError("Era year must be a positive integer.");
    if (era !== "bce" && era !== "ce") throw new RangeError("Era must be BCE or CE.");
    return era === "bce" ? 1 - year : year;
  }
  function eraYear(year) {
    if (!Number.isSafeInteger(year)) throw new RangeError("Astronomical year must be an integer.");
    return Object.freeze({ year: year <= 0 ? 1 - year : year, era: year <= 0 ? "bce" : "ce" });
  }
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  function civilDay(year, month, day) {
    const shiftedYear = year - (month <= 2 ? 1 : 0);
    const era = Math.floor(shiftedYear / 400);
    const yearInEra = shiftedYear - era * 400;
    const shiftedMonth = month + (month > 2 ? -3 : 9);
    const dayInYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
    const dayInEra = yearInEra * 365 + Math.floor(yearInEra / 4) - Math.floor(yearInEra / 100) + dayInYear;
    return era * 146097 + dayInEra - 719468;
  }
  function fromCivil(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
    if (!Number.isSafeInteger(year) || Math.abs(year) > 1e6) throw new RangeError("Calendar year must be an integer within ±1000000.");
    const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > monthDays[month - 1]) throw new RangeError("Invalid Gregorian date.");
    for (const [value, limit] of [[hour, 24], [minute, 60], [second, 60], [millisecond, 1e3]]) {
      if (!Number.isInteger(value) || value < 0 || value >= limit) throw new RangeError("Invalid civil clock time.");
    }
    const fraction = (((hour * 60 + minute) * 60 + second) * 1e3 + millisecond) / MILLISECONDS_PER_DAY;
    return utDays(civilDay(year, month, day) - UNIX_DAYS_AT_J2000 + fraction);
  }
  function toCivil(time) {
    const unixDays = utDays(time) + UNIX_DAYS_AT_J2000;
    let wholeDay = Math.floor(unixDays);
    let milliseconds = Math.round((unixDays - wholeDay) * MILLISECONDS_PER_DAY);
    if (milliseconds === MILLISECONDS_PER_DAY) {
      wholeDay++;
      milliseconds = 0;
    }
    const shiftedDay = wholeDay + 719468;
    const era = Math.floor(shiftedDay / 146097);
    const dayInEra = shiftedDay - era * 146097;
    const yearInEra = Math.floor((dayInEra - Math.floor(dayInEra / 1460) + Math.floor(dayInEra / 36524) - Math.floor(dayInEra / 146096)) / 365);
    const dayInYear = dayInEra - (365 * yearInEra + Math.floor(yearInEra / 4) - Math.floor(yearInEra / 100));
    const shiftedMonth = Math.floor((5 * dayInYear + 2) / 153);
    const day = dayInYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
    const month = shiftedMonth + (shiftedMonth < 10 ? 3 : -9);
    const year = yearInEra + era * 400 + (month <= 2 ? 1 : 0);
    const hour = Math.floor(milliseconds / 36e5);
    const minute = Math.floor(milliseconds / 6e4) % 60;
    const second = Math.floor(milliseconds / 1e3) % 60;
    return Object.freeze({ year, month, day, hour, minute, second, millisecond: milliseconds % 1e3 });
  }
  function localMeanMidnight(time, longitude) {
    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError("Longitude must be between −180° and +180°.");
    return utDays(Math.floor(time + 0.5 + longitude / 360) - 0.5 - longitude / 360);
  }
  const pad = (value, digits = 2) => String(value).padStart(digits, "0");
  function isoLabel(time) {
    const date = toCivil(time);
    const year = date.year >= 0 && date.year <= 9999 ? pad(date.year, 4) : `${date.year < 0 ? "-" : "+"}${pad(Math.abs(date.year), 6)}`;
    return `${year}-${pad(date.month)}-${pad(date.day)}T${pad(date.hour)}:${pad(date.minute)}:${pad(date.second)}.${pad(date.millisecond, 3)}Z`;
  }
  function localLabels(time, longitude) {
    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError("Longitude must be between −180° and +180°.");
    const date = toCivil(utDays(time + longitude / 360));
    const era = eraYear(date.year);
    return {
      dateLabel: `${date.day} ${MONTH_NAMES[date.month - 1]} ${era.year} ${era.era.toUpperCase()}`,
      localTimeLabel: `${pad(date.hour)}:${pad(date.minute)}:${pad(date.second)} local mean solar time`,
      calendarLabel: "Proleptic Gregorian date corresponding to the selected readout",
      utcLabel: isoLabel(time)
    };
  }
  exports2.astronomicalYear = astronomicalYear;
  exports2.eraYear = eraYear;
  exports2.fromCivil = fromCivil;
  exports2.isLeapYear = isLeapYear;
  exports2.isoLabel = isoLabel;
  exports2.localLabels = localLabels;
  exports2.localMeanMidnight = localMeanMidnight;
  exports2.toCivil = toCivil;
  exports2.utDays = utDays;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
}));
