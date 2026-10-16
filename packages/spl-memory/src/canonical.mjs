// JCS (RFC 8785) JSON Canonicalization Scheme — zero-dependency implementation.
//
// Rules implemented:
// - Object keys sorted by UTF-16 code unit order (JS relational string order).
// - No insignificant whitespace.
// - Strings: escape `"`, `\`, and U+0000–U+001F (short forms \b \f \n \r \t,
//   else \u00xx lowercase); lone surrogates escaped as \uXXXX; paired
//   surrogates and all other characters emitted literally. `/` never escaped.
// - Numbers: shortest round-trip form; -0 serializes as 0; exponential
//   notation is expanded to plain decimal (JCS forbids `e` notation).
// - Arrays/objects recurse. Non-JSON values (undefined, functions, symbols,
//   bigint, non-finite numbers) throw — canonicalization must never
//   silently change data.

export function canonicalize(value) {
  return canonValue(value);
}

export function canonicalizeToBytes(value) {
  return Buffer.from(canonicalize(value), 'utf8');
}

function canonValue(v) {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'string') return quoteString(v);
  if (typeof v === 'number') return canonNumber(v);
  if (Array.isArray(v)) return '[' + v.map(canonValue).join(',') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return '{' + keys.map((k) => quoteString(k) + ':' + canonValue(v[k])).join(',') + '}';
  }
  throw new TypeError(`JCS: cannot canonicalize ${typeof v}`);
}

function quoteString(s) {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += '\\\\';
    else if (c === 0x08) out += '\\b';
    else if (c === 0x09) out += '\\t';
    else if (c === 0x0a) out += '\\n';
    else if (c === 0x0c) out += '\\f';
    else if (c === 0x0d) out += '\\r';
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else if (c >= 0xd800 && c <= 0xdbff) {
      // High surrogate: emit pair literally, or escape a lone surrogate.
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      } else {
        out += '\\u' + c.toString(16).padStart(4, '0');
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out += '\\u' + c.toString(16).padStart(4, '0'); // lone low surrogate
    } else {
      out += s[i];
    }
  }
  return out + '"';
}

function canonNumber(n) {
  if (!Number.isFinite(n)) throw new TypeError('JCS: non-finite number');
  if (Object.is(n, -0)) return '0';
  const s = n.toString();
  return /[eE]/.test(s) ? expandExponential(s) : s;
}

// Expand forms like "1e+21", "1.23e-7", "-5E+3" to plain decimal notation.
function expandExponential(s) {
  const m = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(s);
  if (!m) throw new TypeError(`JCS: bad number form ${s}`);
  const neg = m[1];
  const frac = m[3] || '';
  const exp = parseInt(m[4], 10);
  let digits = (m[2] + frac).replace(/^0+/, '');
  if (digits === '') return '0';
  let e = exp - frac.length; // value = digits × 10^e
  if (e >= 0) {
    return neg + digits + '0'.repeat(e);
  }
  const point = digits.length + e; // e < 0
  let out;
  if (point > 0) {
    out = digits.slice(0, point) + '.' + digits.slice(point);
  } else {
    out = '0.' + '0'.repeat(-point) + digits;
  }
  out = out.replace(/0+$/, '').replace(/\.$/, '');
  return neg + out;
}
