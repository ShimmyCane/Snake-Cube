const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { toRoman, fromRoman, romanLength, popLabel, numeralTokens } = ctx;

test('round-trips every number from 1 to 2021', () => {
  for (let n = 1; n <= 2021; n++) assert.equal(fromRoman(toRoman(n)), n, 'n=' + n);
});

test('known numerals, including the goal and Felix\'s birth year', () => {
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(90), 'XC');
  assert.equal(toRoman(400), 'CD');
  assert.equal(toRoman(900), 'CM');
  assert.equal(toRoman(1888), 'MDCCCLXXXVIII');
  assert.equal(toRoman(2021), 'MMXXI');
});

test('body length is the number of symbols; IV, IX, XL, XC, CD, CM count as one', () => {
  const table = { 3: 3, 4: 1, 6: 2, 8: 4, 9: 1, 10: 1, 20: 2, 38: 7, 39: 4, 40: 1, 88: 8, 90: 1, 1888: 13, 1994: 4, 2021: 5 };
  for (const [n, len] of Object.entries(table)) assert.equal(romanLength(Number(n)), len, 'n=' + n);
});

test('there is no zero, and nothing below I', () => {
  assert.throws(() => toRoman(0), { name: 'RangeError' });
  assert.throws(() => toRoman(-3), { name: 'RangeError' });
});

test('out-of-range and non-integer inputs are rejected', () => {
  assert.throws(() => toRoman(4000), { name: 'RangeError' });
  assert.throws(() => toRoman(2.5), { name: 'RangeError' });
});

test('fromRoman refuses numerals Romans would not write', () => {
  for (const bad of ['IIII', 'VV', 'IC', 'IIV', 'XXXX', 'Q']) {
    assert.throws(() => fromRoman(bad), undefined, bad);
  }
});

test('popLabel shows the sum and the rewrite', () => {
  assert.equal(popLabel(3, 1, 4), 'III + I → IV');
  assert.equal(popLabel(8, 1, 9), 'VIII + I → IX');
  assert.equal(popLabel(9, 1, 10), 'IX + I → X');
});

test('subtractive pairs are one ligature token, other symbols are single', () => {
  const texts = n => JSON.parse(JSON.stringify(numeralTokens(n).map(t => t.text)));
  assert.deepEqual(texts(4), ['IV']);
  assert.deepEqual(texts(3), ['I', 'I', 'I']);
  assert.deepEqual(texts(1994), ['M', 'CM', 'XC', 'IV']);
  assert.deepEqual(texts(2021), ['M', 'M', 'X', 'X', 'I']);
  // One token per body cell, so the token count is the body length.
  for (let n = 1; n <= 2021; n++) {
    assert.equal(numeralTokens(n).length, romanLength(n), 'n=' + n);
  }
});
