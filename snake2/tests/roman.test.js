const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { toRoman, fromRoman, romanLength, popLabel, numeralTokens, tokensValue } = ctx;
const BAR = '̅';
const bared = s => [...s].map(ch => ch + BAR).join('');

test('round-trips every number from 1 to 20000', () => {
  for (let n = 1; n <= 20000; n++) assert.equal(fromRoman(toRoman(n)), n, 'n=' + n);
});

test('known numerals, including the old goal and Felix\'s birth year', () => {
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(90), 'XC');
  assert.equal(toRoman(400), 'CD');
  assert.equal(toRoman(900), 'CM');
  assert.equal(toRoman(1000), 'M');
  assert.equal(toRoman(3000), 'MMM');
  assert.equal(toRoman(3999), 'MMMCMXCIX');
  assert.equal(toRoman(1888), 'MDCCCLXXXVIII');
  assert.equal(toRoman(2021), 'MMXXI');
});

test('past MMMCMXCIX the numeral goes on with overlines: a bar is a thousand times', () => {
  assert.equal(toRoman(4000), bared('IV'));
  assert.equal(toRoman(5000), bared('V'));
  assert.equal(toRoman(9000), bared('IX'));
  assert.equal(toRoman(10000), bared('X'));
  assert.equal(toRoman(4321), bared('IV') + 'CCCXXI');
  assert.equal(toRoman(1000000), bared('M'));
  assert.equal(toRoman(1004000), bared('M') + bared('IV'));
});

test('big numbers round-trip too, so the count never runs out', () => {
  for (const n of [3999999, 4000000, 123456789, 1999999999, 2 ** 40 + 7]) {
    assert.equal(fromRoman(toRoman(n)), n, 'n=' + n);
  }
});

test('body length is the number of symbols; IV, IX, XL, XC, CD, CM count as one', () => {
  const table = { 3: 3, 4: 1, 6: 2, 8: 4, 9: 1, 10: 1, 20: 2, 38: 7, 39: 4, 40: 1, 88: 8, 90: 1, 1888: 13, 1994: 4, 2021: 5, 4000: 1 };
  for (const [n, len] of Object.entries(table)) assert.equal(romanLength(Number(n)), len, 'n=' + n);
});

test('there is no zero, and nothing below I', () => {
  assert.throws(() => toRoman(0), { name: 'RangeError' });
  assert.throws(() => toRoman(-3), { name: 'RangeError' });
});

test('non-integer inputs are rejected', () => {
  assert.throws(() => toRoman(2.5), { name: 'RangeError' });
  assert.throws(() => toRoman(NaN), { name: 'RangeError' });
});

test('fromRoman refuses numerals Romans would not write', () => {
  for (const bad of ['IIII', 'VV', 'IC', 'IIV', 'XXXX', 'Q', BAR]) {
    assert.throws(() => fromRoman(bad), undefined, bad);
  }
});

test('popLabel shows the sum and the rewrite', () => {
  assert.equal(popLabel(3, 1, 4), 'III + I → IV');
  assert.equal(popLabel(8, 1, 9), 'VIII + I → IX');
  assert.equal(popLabel(9, 1, 10), 'IX + I → X');
  assert.equal(popLabel(3999, 1, 4000), 'MMMCMXCIX + I → ' + bared('IV'));
});

test('subtractive pairs are one ligature token, other symbols are single', () => {
  const texts = n => JSON.parse(JSON.stringify(numeralTokens(n).map(t => t.text)));
  assert.deepEqual(texts(4), ['IV']);
  assert.deepEqual(texts(3), ['I', 'I', 'I']);
  assert.deepEqual(texts(1994), ['M', 'CM', 'XC', 'IV']);
  assert.deepEqual(texts(2021), ['M', 'M', 'X', 'X', 'I']);
  // One token per body cell, so the token count is the body length.
  for (let n = 1; n <= 5000; n++) {
    assert.equal(numeralTokens(n).length, romanLength(n), 'n=' + n);
  }
});

test('each token carries the value it spells, and they add up to the number', () => {
  for (const n of [1, 4, 1994, 3999, 4321, 1004000, 987654321]) {
    assert.equal(tokensValue(numeralTokens(n)), n, 'n=' + n);
  }
  assert.equal(numeralTokens(1994)[1].value, 900, 'CM is 900');
  assert.equal(numeralTokens(4000)[0].value, 4000, 'IV̅ is 4000');
});

test('dropping leading symbols leaves a canonical numeral, for every value up to 5000', () => {
  for (let v = 1; v <= 5000; v++) {
    const tokens = numeralTokens(v);
    for (let keep = 1; keep <= tokens.length; keep++) {
      const rest = tokens.slice(keep);
      if (!rest.length) continue;
      const text = rest.map(t => t.text).join('');
      assert.equal(fromRoman(text), tokensValue(rest), `${text} from ${v}`);
    }
  }
});
