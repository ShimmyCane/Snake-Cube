// ════════════════════════════════════════════════════════════════════
//  ROMAN NUMERALS — pure, no DOM.
//  Every snake's value is an integer; its body is toRoman(value).
//
//  Up to MMMCMXCIX (3999) it is ordinary Roman notation. Past that the numeral goes on with
//  overlines (the old vinculum): a letter with one bar over it counts a thousand times,
//  with two bars a million times, and so on. So IV̅ is 4000, V̅ is 5000, M̅ is a million.
//  Every positive whole number has a numeral, so the count never runs out.
// ════════════════════════════════════════════════════════════════════

const BAR = '̅';                       // combining overline: one bar = x1000
const ROMAN_TABLE = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

// Subtractive pairs are read as one symbol: IV is one ligature, not I then V.
const LIGATURE_PAIRS = ['IV', 'IX', 'XL', 'XC', 'CD', 'CM'];

// The plain numeral for 0..999 (no M, no bars). Used for the last three digits.
function plainNumeral(n) {
  let s = '';
  for (const [v, sym] of ROMAN_TABLE) {
    while (n >= v) { s += sym; n -= v; }
  }
  return s;
}

// Add one bar to every letter of a token: IV becomes I̅V̅, and a barred letter gets one more.
function barText(text) {
  return text.replace(/[A-Z]̅*/g, m => m + BAR);
}

// Tokens for the plain part 1..999: one per symbol, subtractive pairs as one ligature.
function groupTokens(n) {
  const num = plainNumeral(n);
  const out = [];
  let i = 0;
  while (i < num.length) {
    const pair = num.substr(i, 2);
    const text = pair.length === 2 && LIGATURE_PAIRS.includes(pair) ? pair : num[i];
    const value = text.length === 2 ? ROMAN_VALUES[text[1]] - ROMAN_VALUES[text[0]] : ROMAN_VALUES[text];
    out.push({ text, value });
    i += text.length;
  }
  return out;
}

// Split a value into symbols, one per body cell (index 0 is the head). Each is { text, value }.
// 1000..3000 are plain M's. From 4000 up, the thousands are a barred numeral: 4321 is IV̅CCCXXI.
function numeralTokens(n) {
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new RangeError('toRoman: ' + n + ' is not a whole number from 1 up');
  }
  const tokens = [];
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  if (thousands >= 1 && thousands <= 3) {
    for (let i = 0; i < thousands; i++) tokens.push({ text: 'M', value: 1000 });
  } else if (thousands >= 4) {
    for (const t of numeralTokens(thousands)) tokens.push({ text: barText(t.text), value: t.value * 1000 });
  }
  if (rest) tokens.push(...groupTokens(rest));
  return tokens;
}

function toRoman(n) {
  return numeralTokens(n).map(t => t.text).join('');
}

// Reads a canonical numeral back to a number. Throws on anything Romans would not write
// (IIII, VV, IC…), because round-tripping must match. Barred letters count their thousands.
function fromRoman(s) {
  const letters = [];
  for (const ch of s) {
    if (ch === BAR) {
      if (!letters.length) throw new Error('fromRoman: a bar with no symbol under it');
      letters[letters.length - 1].level += 1;
      continue;
    }
    const v = ROMAN_VALUES[ch];
    if (v === undefined) throw new Error('fromRoman: bad symbol ' + ch);
    letters.push({ v, level: 0 });
  }
  let total = 0;
  for (let i = 0; i < letters.length; i++) {
    const cur = letters[i], next = letters[i + 1];
    const nextV = next && next.level === cur.level ? next.v : 0;
    total += (cur.v < nextV ? -cur.v : cur.v) * Math.pow(1000, cur.level);
  }
  if (toRoman(total) !== s) throw new Error('fromRoman: not a canonical numeral: ' + s);
  return total;
}

// Number of body cells a snake needs for this value: one per symbol, head included.
// A subtractive pair (IV, IX, XL, XC, CD, CM) is one symbol, so 4 is a single cell.
function romanLength(n) {
  return numeralTokens(n).length;
}

// The label shown when a numeral collapses, e.g. "III + I → IV".
// Kids see the sum and the rewrite side by side.
function popLabel(from, eaten, to) {
  return toRoman(from) + ' + ' + toRoman(eaten) + ' → ' + toRoman(to);
}

// Sum of a list of tokens: the value they spell. A suffix of a numeral's tokens is itself canonical.
function tokensValue(tokens) {
  return tokens.reduce((sum, t) => sum + t.value, 0);
}
