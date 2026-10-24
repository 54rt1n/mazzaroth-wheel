import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

// No Date global is supplied: the actual generated calendar must be standalone.
const module = { exports: {} }
vm.runInNewContext(readFileSync(new URL('../../public/runtime/calendar.js', import.meta.url), 'utf8'), { module, exports: module.exports })
const C = module.exports
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`)
const plain = (value) => JSON.parse(JSON.stringify(value))

test('known astronomical day anchors and BCE/year-zero conventions', () => {
  assert.equal(C.fromCivil(2000, 1, 1, 12), 0)
  assert.equal(C.fromCivil(2000, 1, 1), -0.5)
  assert.equal(C.fromCivil(1970, 1, 1), -10957.5)
  assert.equal(C.astronomicalYear(1, 'bce'), 0)
  assert.equal(C.astronomicalYear(2, 'bce'), -1)
  assert.deepEqual(plain(C.eraYear(0)), { year: 1, era: 'bce' })
  assert.equal(C.localLabels(C.fromCivil(0, 1, 1), 0).dateLabel, '1 Jan 1 BCE')
  assert.equal(C.localLabels(C.fromCivil(1, 1, 1), 0).dateLabel, '1 Jan 1 CE')
})

test('Gregorian day conversions agree with an independent native calendar in its supported range', () => {
  for (const year of [-10000, -2999, -1200, -400, -100, -1, 0, 1, 4, 50, 99, 100, 400, 1582, 1900, 2000, 2100, 2400, 10000]) {
    for (const month of [1, 2, 3, 6, 12]) {
      const native = new Date(0)
      native.setUTCFullYear(year, month - 1, 15)
      native.setUTCHours(18, 34, 56, 0)
      const days = C.fromCivil(year, month, 15, 18, 34, 56)
      near(days, (native.getTime() - 946728000000) / 86400000)
      assert.equal(C.isoLabel(days), native.toISOString())
    }
  }
})

test('deep-time calendar dates round-trip beyond native Date limits', () => {
  for (const year of [-500000, -499999, -100000, 0, 500000]) {
    for (const [month, day] of [[1, 1], [2, 28], [3, 1], [12, 31]]) {
      const time = C.fromCivil(year, month, day, 12, 34, 56)
      const date = C.toCivil(time)
      assert.deepEqual([date.year, date.month, date.day, date.hour, date.minute, date.second], [year, month, day, 12, 34, 56])
      assert.ok(date.millisecond <= 3 || date.millisecond >= 997)
    }
    assert.equal(C.fromCivil(year + 400, 1, 1) - C.fromCivil(year, 1, 1), 146097)
  }
  assert.match(C.isoLabel(C.fromCivil(-499999, 1, 1)), /^-499999-01-01T/)
  assert.match(C.isoLabel(C.fromCivil(500000, 1, 1)), /^\+500000-01-01T/)
})

test('leap dates and invalid input are handled explicitly', () => {
  for (const year of [-400, 0, 400, 2000, 500000]) {
    assert.equal(C.isLeapYear(year), true)
    assert.equal(C.fromCivil(year, 3, 1) - C.fromCivil(year, 2, 28), 2)
  }
  for (const args of [[1900, 2, 29], [2100, 2, 29], [-100, 2, 29], [2024, 0, 1], [2024, 1, 0], [2024, 1, 1, 24]]) {
    assert.throws(() => C.fromCivil(...args))
  }
  assert.throws(() => C.utDays(NaN))
  assert.throws(() => C.utDays(Infinity))
  assert.throws(() => C.astronomicalYear(0, 'bce'))
})

test('local mean midnight and labels handle longitude and era crossings', () => {
  for (const year of [-499999, -1199, 0, 1, 2000, 500000]) {
    for (const longitude of [-180, -44.42, 0, 44.42, 180]) {
      const time = C.fromCivil(year, 1, 1, 23, 30)
      const start = C.localMeanMidnight(time, longitude)
      assert.ok(start <= time && time - start < 1)
      const local = C.toCivil(C.utDays(start + longitude / 360))
      assert.equal(local.hour, 0)
      assert.equal(local.minute, 0)
      assert.equal(local.second, 0)
    }
  }
  assert.equal(C.localLabels(C.fromCivil(1, 1, 1), -15).dateLabel, '31 Dec 1 BCE')
  assert.equal(C.localLabels(C.fromCivil(0, 12, 31, 23), 30).dateLabel, '1 Jan 1 CE')
})
