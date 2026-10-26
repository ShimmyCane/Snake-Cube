// ════════════════════════════════════════════════════════════════════
//  ROMAN NUMERALS — pure, no DOM.
//  Every snake's value is an integer; its body is toRoman(value).
// ════════════════════════════════════════════════════════════════════

const ROMAN_TABLE = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

// Romans had no zero, so the valid range is 1..3999 (standard notation).
function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError('toRoman: ' + n + ' is outside 1..3999');
  }
  let s = '';
  for (const [v, sym] of ROMAN_TABLE) {
    while (n >= v) { s += sym; n -= v; }
  }
  return s;
}

// Reads a canonical numeral back to a number. Throws on anything Romans
// would not write (IIII, VV, IC…), because round-tripping must match.
function fromRoman(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]];
    if (v === undefined) throw new Error('fromRoman: bad symbol ' + s[i]);
    const next = ROMAN_VALUES[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  if (toRoman(total) !== s) throw new Error('fromRoman: not a canonical numeral: ' + s);
  return total;
}

// Number of body cells a snake needs for this value.
function romanLength(n) {
  return toRoman(n).length;
}

// The label shown when a numeral collapses, e.g. "III + I → IV".
// Kids see the sum and the rewrite side by side.
function popLabel(from, eaten, to) {
  return toRoman(from) + ' + ' + toRoman(eaten) + ' → ' + toRoman(to);
}

// Subtractive pairs are read as one symbol: IV is one ligature, not I then V.
const LIGATURE_PAIRS = ['IV', 'IX', 'XL', 'XC', 'CD', 'CM'];

// Split a value's numeral into drawable tokens, one per body symbol.
// A ligature token spans two cells; every other token spans one.
// Returns [{ start, len, text }] with start = index of the first cell.
function numeralTokens(n) {
  const num = toRoman(n);
  const tokens = [];
  let i = 0;
  while (i < num.length) {
    const pair = num.substr(i, 2);
    if (pair.length === 2 && LIGATURE_PAIRS.includes(pair)) {
      tokens.push({ start: i, len: 2, text: pair });
      i += 2;
    } else {
      tokens.push({ start: i, len: 1, text: num[i] });
      i += 1;
    }
  }
  return tokens;
}
