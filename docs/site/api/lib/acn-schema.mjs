/**
 * ACN schema check — dependency-free JSON Schema subset validator.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Checks the acn-protocol schemas against their canonical examples in
 * the repo test suite. Covers exactly the keywords the protocol uses:
 * type (incl. unions + integer), const, enum, required, properties,
 * items, anyOf, oneOf, pattern, minLength/maxLength, minimum/maximum,
 * additionalProperties. Anything fancier belongs in a full validator,
 * not in this gate. Pure: no network, no disk (callers load files).
 */

function jsType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeOk(declared, value) {
  const t = jsType(value);
  const list = Array.isArray(declared) ? declared : [declared];
  return list.some((d) => {
    if (d === "integer") return t === "integer";
    if (d === "number") return t === "number" || t === "integer";
    return d === t;
  });
}

/**
 * Validate value against schema. Returns [] when valid, else a list of
 * "path: problem" strings. Never throws on bad input.
 */
export function validate(schema, value, path = "$") {
  const errs = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return [`${path}: bad schema`];
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errs.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errs.push(`${path}: not one of ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type !== undefined && !typeOk(schema.type, value)) {
    errs.push(`${path}: expected ${JSON.stringify(schema.type)}, got ${jsType(value)}`);
    return errs;
  }
  if (typeof value === "string") {
    if (Number.isFinite(schema.minLength) && value.length < schema.minLength) {
      errs.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) {
      errs.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (typeof schema.pattern === "string") {
      let re = null;
      try {
        re = new RegExp(schema.pattern);
      } catch {
        errs.push(`${path}: bad pattern ${schema.pattern}`);
      }
      if (re && !re.test(value)) errs.push(`${path}: does not match ${schema.pattern}`);
    }
  }
  if (typeof value === "number") {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      errs.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (Number.isFinite(schema.maximum) && value > schema.maximum) {
      errs.push(`${path}: above maximum ${schema.maximum}`);
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of Array.isArray(schema.required) ? schema.required : []) {
      if (!(k in value)) errs.push(`${path}: missing required ${JSON.stringify(k)}`);
    }
    const props = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const [k, sub] of Object.entries(props)) {
      if (k in value) errs.push(...validate(sub, value[k], `${path}.${k}`));
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in props)) errs.push(`${path}: extra property ${JSON.stringify(k)}`);
      }
    }
  }
  if (Array.isArray(value) && schema.items && typeof schema.items === "object") {
    value.forEach((item, i) => errs.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  for (const key of ["anyOf", "oneOf"]) {
    const subs = schema[key];
    if (!Array.isArray(subs)) continue;
    const passes = subs.filter((sub) => validate(sub, value, path).length === 0).length;
    if (key === "anyOf" && passes === 0) errs.push(`${path}: matches none of anyOf`);
    if (key === "oneOf" && passes !== 1) errs.push(`${path}: matches ${passes} of oneOf (need exactly 1)`);
  }
  return errs;
}
