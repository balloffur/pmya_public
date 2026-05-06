// fit.js
(() => {
  const $ = (id) => document.getElementById(id);

  const inp = $("inp");
  const langSel = $("lang");
  const targetSel = $("target");
  const out = $("out");
  const meta = $("meta");

  const legendBtn = $("legendBtn");
  const legendBox = $("legendBox");

  const refsBtn = $("refsBtn");
  const refsBox = $("refsBox");
  const refs = $("refs");

  const hideLegend = () => { if (legendBox) legendBox.classList.add("hidden"); };
  const toggleLegend = () => { if (legendBox) legendBox.classList.toggle("hidden"); };

  const hideRefs = () => { if (refsBox) refsBox.classList.add("hidden"); };
  const toggleRefs = () => { if (refsBox) refsBox.classList.toggle("hidden"); };

  if (legendBtn && legendBox) {
    legendBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideRefs();
      toggleLegend();
    });
  }
  if (refsBtn && refsBox) {
    refsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideLegend();
      toggleRefs();
    });
  }

  document.addEventListener("click", (e) => {
    if (legendBox && !legendBox.classList.contains("hidden")) {
      if (!(legendBox.contains(e.target) || (legendBtn && legendBtn.contains(e.target)))) hideLegend();
    }
    if (refsBox && !refsBox.classList.contains("hidden")) {
      if (!(refsBox.contains(e.target) || (refsBtn && refsBtn.contains(e.target)))) hideRefs();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { hideLegend(); hideRefs(); }
  });

  const MAX_SIZE = 10000;
  const TIMEOUT_MS = 5000;

  const HUGE_DIGITS = 5000;
  const HUGE_SCALE = 5000;
  const LOG2_10 = 3.321928094887362;

  const clean = (s) => (s ?? "").toString().trim().replace(/[\s_]+/g, "");
  const normalizeTypeToken = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const looksLikeTypeQuery = (s) => /[a-zA-Z]/.test(s ?? "");
  const hideNumericResult = () => {
    if (!window.__typeFitInfoActive) {
      meta.textContent = "";
      out.style.display = "none";
      out.className = "result";
      out.innerHTML = "";
    }
  };

  const gcd = (a, b) => {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  };

  const pow10 = (k) => {
    let r = 1n, a = 10n, e = BigInt(k);
    while (e > 0n) {
      if (e & 1n) r *= a;
      a *= a;
      e >>= 1n;
    }
    return r;
  };

  const parseDecimalRational = (s0) => {
    const s = clean(s0);
    if (!s) return { ok:false, err:"empty" };
    if (s.length > MAX_SIZE) return { ok:false, err:"too_long" };

    const m = s.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
    if (!m) return { ok:false, err:"invalid" };

    const sign = (m[1] === "-") ? -1n : 1n;
    const ip = m[2] ?? "";
    const fpA = m[3] ?? "";
    const fpB = m[4] ?? "";
    const fp = (fpB ? fpB : fpA);
    const expS = m[5] ?? "0";

    const hasDot = s.includes(".");
    const hasExp = /[eE]/.test(s);

    const digitsRaw = (ip + fp);
    const digits = digitsRaw.replace(/^0+/, "") || "0";
    const fracLen = fp.length;

    let exp10 = parseInt(expS, 10);
    if (!Number.isFinite(exp10)) return { ok:false, err:"invalid" };
    exp10 -= fracLen;

    const isFloatSyntax = hasDot || hasExp;

    if (digits.length > HUGE_DIGITS || Math.abs(exp10) > HUGE_SCALE) {
      return {
        ok: true,
        huge: true,
        sign,
        digitsLen: digits.length,
        exp10,
        isInteger: false,
        isFloatSyntax,
        raw: s
      };
    }

    let num = BigInt(digits) * sign;
    let den = 1n;

    if (exp10 >= 0) num *= pow10(exp10);
    else den = pow10(-exp10);

    const g = gcd(num, den);
    num /= g;
    den /= g;

    const isInteger = (den === 1n);
    return { ok:true, num, den, isInteger, isFloatSyntax, raw:s };
  };

  const truncTowardZero = (num, den) => num / den;
  const abs = (x) => (x < 0n ? -x : x);

  const bitLen = (x) => {
    if (x === 0n) return 0;
    x = abs(x);
    return x.toString(2).length;
  };

  const uMax = (bits) => (bits <= 0) ? 0n : ((1n << BigInt(bits)) - 1n);
  const sMin = (bits) => (bits <= 0) ? 0n : (-(1n << BigInt(bits - 1)));
  const sMax = (bits) => (bits <= 0) ? 0n : ((1n << BigInt(bits - 1)) - 1n);

  const fitsU = (x, bits) => x >= 0n && x <= uMax(bits);
  const fitsS = (x, bits) => x >= sMin(bits) && x <= sMax(bits);

  const floatStatusFromRat = (num0, den0, mantissa_bits, max_finite_exp2) => {
    if (num0 === 0n) return { status:"exact", detail:"0" };

    let num = abs(num0);
    let den = den0;
    const g = gcd(num, den);
    num /= g;
    den /= g;

    let den2 = 0;
    while ((den & 1n) === 0n) { den >>= 1n; den2++; }
    if (den !== 1n) return { status:"rounding", detail:"non-power-of-two denominator" };

    let t = 0;
    while ((num & 1n) === 0n) { num >>= 1n; t++; }

    const L = num.toString(2).length;
    const e = BigInt(t - den2);
    const exp2 = e + BigInt(L - 1);

    if (exp2 > BigInt(max_finite_exp2)) return { status:"conversion", detail:"overflow (Inf)" };
    if (L <= mantissa_bits) return { status:"exact", detail:"exactly representable" };
    return { status:"rounding", detail:`mantissa ${mantissa_bits} bits` };
  };

  const statusRank = (st) => {
    if (st === "exact") return 0;
    if (st === "rounding") return 1;
    if (st === "conversion") return 2;
    if (st === "implementation-defined") return 3;
    if (st === "reject") return 4;
    return 9;
  };

  const groupRank = (g) => (g === "conv" ? 1 : 0);

  const mkLine = (k, v) => {
    const line = document.createElement("div");
    line.className = "line";
    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v";
    vv.textContent = v;
    line.appendChild(kk);
    line.appendChild(vv);
    return line;
  };

  const mkHdr = (t) => {
    const d = document.createElement("div");
    d.className = "hdr";
    d.textContent = t;
    return d;
  };

  // ========= references (links.json) =========

  let LINKS = null;

  const loadLinks = async () => {
    if (LINKS) return LINKS;
    try {
      const r = await fetch("./links.json", { cache:"no-cache" });
      if (!r.ok) return (LINKS = {});
      const j = await r.json();
      if (!j || typeof j !== "object") return (LINKS = {});
      return (LINKS = j);
    } catch {
      return (LINKS = {});
    }
  };

  const updateRefs = async (langId, cfgName) => {
    if (!refs) return;
    const map = await loadLinks();
    const list = map && map[langId];

    if (!Array.isArray(list) || !list.length) {
      refs.innerHTML = "";
      if (refsBox) refsBox.classList.add("hidden");
      return;
    }

    refs.innerHTML =
      `<div class="refs-title">References — ${cfgName || ""}</div>` +
      list.map((it) => {
        if (!Array.isArray(it) || it.length < 2) return "";
        const t = String(it[0] ?? "");
        const u = String(it[1] ?? "");
        if (!t || !u) return "";
        return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
      }).join("");
  };

  // ========= data loading =========

  const LANGS = [
    { id:"c", name:"C/C++", file:"c.json" },
    { id:"java", name:"Java", file:"java.json" },
    { id:"js", name:"JavaScript", file:"js.json" },
    { id:"go", name:"Go", file:"go.json" },
    { id:"cs", name:"C#", file:"csharp.json" },
    { id:"ktl", name:"Kotlin", file:"kotlin.json" },
    { id:"rust", name:"Rust", file:"rust.json" }
  ];

  const cache = new Map();

  const loadLang = async (langId) => {
    if (cache.has(langId)) return cache.get(langId);
    const lang = LANGS.find(x => x.id === langId) || LANGS[0];
    const r = await fetch("./limits/" + lang.file, { cache:"no-cache" });
    if (!r.ok) throw new Error("load failed");
    const j = await r.json();
    cache.set(langId, j);
    return j;
  };

  const fillLang = () => {
    langSel.innerHTML = "";
    for (const l of LANGS) {
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.name;
      langSel.appendChild(o);
    }
    langSel.value = LANGS[0].id;
  };

  const fillTargets = (cfg) => {
    targetSel.innerHTML = "";
    for (const t of (cfg.targets || [])) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      targetSel.appendChild(o);
    }
    if (cfg.targets && cfg.targets.length) targetSel.value = cfg.targets[0].id;
  };

  const findTarget = (cfg) =>
    (cfg.targets || []).find(t => t.id === targetSel.value) || (cfg.targets || [])[0] || null;

  // ========= evaluation =========

  const normalizeRule = (rules, key, dflt) => {
    const v = rules && rules[key];
    if (v === "exact" || v === "rounding" || v === "conversion" || v === "implementation-defined" || v === "reject") return v;
    return dflt;
  };

  const pickInputMode = (cfg, pv) => {
    const parseCfg = cfg.parse || {};
    const mode = parseCfg.mode || "auto";
    if (mode === "integer") return "integer";
    if (mode === "float") return "float";
    return pv.isFloatSyntax ? "float" : "integer";
  };

  const evalIntType = (x, bits, isSigned, rules, sourceMode, sourceIsInteger, sourceNum, sourceDen) => {
    if (sourceMode === "integer") {
      if (isSigned) {
        if (fitsS(x, bits)) return { status:"exact", detail:`fits in ${bits}-bit signed` };
        return { status: normalizeRule(rules, "signed_out_of_range", "implementation-defined"), detail:`out of range for ${bits}-bit signed` };
      } else {
        if (fitsU(x, bits)) return { status:"exact", detail:`fits in ${bits}-bit unsigned` };
        if (rules && rules.unsigned_wrap) return { status:"conversion", detail:`mod 2^${bits}` };
        return { status: normalizeRule(rules, "unsigned_out_of_range", "implementation-defined"), detail:`out of range for ${bits}-bit unsigned` };
      }
    }

    const trunc = truncTowardZero(sourceNum, sourceDen);
    const changed = !sourceIsInteger || (trunc !== x);
    const inRange = isSigned ? fitsS(trunc, bits) : fitsU(trunc, bits);

    if (!inRange) {
      return { status: normalizeRule(rules, "float_to_int_out_of_range", "reject"), detail:`float->int out of range (${bits} bits)` };
    }

    if (changed) {
      return { status: normalizeRule(rules, "float_to_int_truncation", "conversion"), detail:"trunc toward zero" };
    }

    return { status:"exact", detail:"exact integer value" };
  };

  const evalFloatType = (num, den, mantissa_bits, max_finite_exp2, pv) => {
    if (pv && pv.huge) {
      const approxLog2 = (pv.digitsLen - 1 + pv.exp10) * LOG2_10;
      if (approxLog2 > max_finite_exp2 + 4) return { status:"conversion", detail:"overflow (Inf)" };
      return { status:"rounding", detail:"too large to analyze exactly" };
    }
    const r = floatStatusFromRat(num, den, mantissa_bits, max_finite_exp2);
    return { status:r.status, detail:r.detail };
  };

  // ========= ops registry =========

  const opParams = (tp) => {
    const p = tp && typeof tp.params === "object" && tp.params ? tp.params : tp;
    return p || {};
  };

  const OPS = Object.create(null);
  const registerOp = (name, fn) => { OPS[name] = fn; };

  const conv_toIntN_value = (pv, bits, signed) => {
    const B = BigInt(bits);
    const twoB = 1n << B;
    const twoBm1 = 1n << (B - 1n);

    const t = truncTowardZero(pv.num, pv.den);
    let u = t % twoB;
    if (u < 0n) u += twoB;

    if (!signed) return u;
    return (u >= twoBm1) ? (u - twoB) : u;
  };

  const conv_toUint8Clamp_value = (pv) => {
    const n = pv.num;
    const d = pv.den;

    if (n <= 0n) return 0n;

    const max = 255n;
    if (n >= max * d) return 255n;

    const q = n / d;
    const r = n - q * d;

    const twice = 2n * r;
    if (twice < d) return q;
    if (twice > d) return (q + 1n);

    return (q & 1n) ? (q + 1n) : q;
  };

  const conv_bigIntN_value = (x, bits, signed) => {
    const B = BigInt(bits);
    const twoB = 1n << B;
    const twoBm1 = 1n << (B - 1n);

    let u = x % twoB;
    if (u < 0n) u += twoB;

    if (!signed) return u;
    return (u >= twoBm1) ? (u - twoB) : u;
  };

  const mkCtx = (pv, cfg, target, sourceMode) => ({
    pv,
    cfg,
    target,
    sourceMode,
    rules: cfg.rules || {},
    bitsMap: (target && target.bits) ? target.bits : {}
  });

  registerOp("toIntN", (tp, ctx) => {
    if (ctx.pv.huge) return { status:"implementation-defined", detail:"too large to evaluate exactly" };

    const p = opParams(tp);
    const bits = p.bits | 0;
    const signed = !!p.signed;

    const y = conv_toIntN_value(ctx.pv, bits, signed);
    const x = ctx.pv.isInteger ? ctx.pv.num : truncTowardZero(ctx.pv.num, ctx.pv.den);
    const inRange = signed ? fitsS(x, bits) : fitsU(x, bits);
    const exact = ctx.pv.isInteger && inRange && (y === x);

    if (exact) return { status:"exact", detail:`no change (${bits}-bit ${signed ? "signed" : "unsigned"})` };
    return { status:"conversion", detail:`${signed ? "ToInt" : "ToUint"}${bits}` };
  });

  registerOp("toUint8Clamp", (_tp, ctx) => {
    if (ctx.pv.huge) return { status:"implementation-defined", detail:"too large to evaluate exactly" };

    const y = conv_toUint8Clamp_value(ctx.pv);
    const exact = ctx.pv.isInteger && ctx.pv.num >= 0n && ctx.pv.num <= 255n && y === ctx.pv.num;
    if (exact) return { status:"exact", detail:"no change (0..255)" };
    return { status:"conversion", detail:"ToUint8Clamp" };
  });

  registerOp("bigIntN", (tp, ctx) => {
    if (ctx.pv.huge) return { status:"reject", detail:"requires integer input" };
    if (!ctx.pv.isInteger) return { status:"reject", detail:"requires integer input" };

    const p = opParams(tp);
    const bits = p.bits | 0;
    const signed = !!p.signed;

    const y = conv_bigIntN_value(ctx.pv.num, bits, signed);
    const min = signed ? sMin(bits) : 0n;
    const max = signed ? sMax(bits) : uMax(bits);
    const exact = ctx.pv.num >= min && ctx.pv.num <= max && y === ctx.pv.num;

    if (exact) return { status:"exact", detail:`no change (${bits}-bit ${signed ? "signed" : "unsigned"})` };
    return { status:"conversion", detail:`BigInt.as${signed ? "Int" : "Uint"}N(${bits})` };
  });

  registerOp("requireInteger", (_tp, ctx) => {
    if (ctx.pv.isInteger) return { status:"exact", detail:"" };
    return { status:"reject", detail:"requires integer input" };
  });

  registerOp("quantizeFloat", (tp, ctx) => {
    const p = opParams(tp);
    const mb = p.mantissa_bits | 0;
    const emax = p.max_finite_exp2 | 0;
    const r = evalFloatType(ctx.pv.num, ctx.pv.den, mb, emax, ctx.pv);
    return { status:r.status, detail:`quantize (mantissa ${mb}, emax ${emax})` };
  });

  registerOp("checkedIntN", (tp, ctx) => {
    if (ctx.pv.huge) return { status:"implementation-defined", detail:"too large to evaluate exactly" };

    const p = opParams(tp);
    const bits = p.bits | 0;
    const signed = !!p.signed;

    const x = ctx.pv.isInteger ? ctx.pv.num : truncTowardZero(ctx.pv.num, ctx.pv.den);
    const changed = !ctx.pv.isInteger;
    const inRange = signed ? fitsS(x, bits) : fitsU(x, bits);

    if (!inRange) return { status:"reject", detail:`out of range (${bits}-bit ${signed ? "signed" : "unsigned"})` };
    if (changed) return { status:"rounding", detail:"trunc toward zero" };
    return { status:"exact", detail:"no change" };
  });

  registerOp("clampIntN", (tp, ctx) => {
    if (ctx.pv.huge) return { status:"implementation-defined", detail:"too large to evaluate exactly" };

    const p = opParams(tp);
    const bits = p.bits | 0;
    const signed = !!p.signed;

    const x = ctx.pv.isInteger ? ctx.pv.num : truncTowardZero(ctx.pv.num, ctx.pv.den);
    const changed = !ctx.pv.isInteger;
    const min = signed ? sMin(bits) : 0n;
    const max = signed ? sMax(bits) : uMax(bits);

    const y = x < min ? min : (x > max ? max : x);
    const exact = !changed && y === x;

    if (exact) return { status:"exact", detail:`no change (${bits}-bit ${signed ? "signed" : "unsigned"})` };
    if (y !== x) return { status:"conversion", detail:`clamp to [${min}, ${max}]` };
    return { status:"rounding", detail:"trunc toward zero" };
  });

  registerOp("pipe", (tp, ctx0) => {
    const steps = (tp && Array.isArray(tp.steps)) ? tp.steps : [];
    if (!steps.length) return { status:"implementation-defined", detail:"empty pipe" };

    let worst = { status:"exact", detail:"" };
    for (const st of steps) {
      const op = (st && st.op) ? st.op : "";
      const fn = OPS[op];
      if (!fn) return { status:"implementation-defined", detail:`unknown op: ${op}` };
      const r = fn(st, ctx0);
      if (!r || !r.status) return { status:"implementation-defined", detail:`bad op result: ${op}` };

      if (statusRank(r.status) > statusRank(worst.status)) worst = r;
      if (r.status === "reject") return r;
    }
    return worst;
  });

  const evalConvType = (pv, cfg, target, tp, sourceMode) => {
    const op = tp.op || "";
    const fn = OPS[op];
    if (!fn) return { status:"implementation-defined", detail:`unknown conv op: ${op}` };
    const ctx = mkCtx(pv, cfg, target, sourceMode);
    const r = fn(tp, ctx);
    if (!r || !r.status) return { status:"implementation-defined", detail:`bad conv op: ${op}` };
    return r;
  };

  const evalType = (pv, cfg, target, tp, sourceMode) => {
    if (tp.whenTarget && target && tp.whenTarget !== target.id) return null;

    const rules = cfg.rules || {};
    const bitsMap = (target && target.bits) ? target.bits : {};

    if (tp.kind === "unbounded") return { name: tp.name, status:"exact", detail:"unbounded", group:"types" };

    if (tp.kind === "float") {
      const p = tp.mantissa_bits | 0;
      const emax = tp.max_finite_exp2 | 0;
      const r = evalFloatType(pv.num, pv.den, p, emax, pv);
      return { name: tp.name, status: r.status, detail: r.detail, group:"types" };
    }

    if (tp.kind === "conv") {
      const r = evalConvType(pv, cfg, target, tp, sourceMode);
      return { name: tp.name, status: r.status, detail: r.detail, group:"conv" };
    }

    if (pv.huge && (tp.kind === "s" || tp.kind === "u" || tp.kind === "alias")) {
      const bits = (tp.kind === "alias") ? bitsMap[tp.key] : (tp.bits | 0);
      if (typeof bits !== "number") {
        if (tp.kind === "alias" && tp.impl_if_missing) return { name: tp.name, status:"implementation-defined", detail:`unknown ${tp.key} width`, group:"types" };
        return null;
      }
      const approxBits = Math.max(0, Math.floor((pv.digitsLen - 1 + pv.exp10) * LOG2_10) + 1);
      const stKey = (tp.kind === "s" || !!tp.signed) ? "signed_out_of_range" : "unsigned_out_of_range";
      if (approxBits > bits + 2) {
        return { name: tp.name, status: normalizeRule(rules, stKey, "implementation-defined"), detail:`out of range (${bits} bits)`, group:"types" };
      }
      return { name: tp.name, status:"implementation-defined", detail:"too large to evaluate exactly", group:"types" };
    }

    const xInt = pv.isInteger ? pv.num : truncTowardZero(pv.num, pv.den);

    if (tp.kind === "s") {
      const r = evalIntType(xInt, tp.bits | 0, true, rules, sourceMode, pv.isInteger, pv.num, pv.den);
      return { name: tp.name, status: r.status, detail: r.detail, group:"types" };
    }

    if (tp.kind === "u") {
      const r = evalIntType(xInt, tp.bits | 0, false, rules, sourceMode, pv.isInteger, pv.num, pv.den);
      return { name: tp.name, status: r.status, detail: r.detail, group:"types" };
    }

    if (tp.kind === "alias") {
      const b = bitsMap[tp.key];
      if (typeof b !== "number") {
        if (tp.impl_if_missing) return { name: tp.name, status:"implementation-defined", detail:`unknown ${tp.key} width`, group:"types" };
        return null;
      }
      const r = evalIntType(xInt, b | 0, !!tp.signed, rules, sourceMode, pv.isInteger, pv.num, pv.den);
      return { name: tp.name, status: r.status, detail: r.detail, group:"types" };
    }

    if (tp.kind === "range") {
      if (pv.huge) return { name: tp.name, status:"reject", detail:"out of range", group:"types" };

      const min = BigInt(tp.min);
      const max = BigInt(tp.max);
      const x = pv.isInteger ? pv.num : truncTowardZero(pv.num, pv.den);
      if (x < min || x > max) return { name: tp.name, status:"reject", detail:"out of range", group:"types" };
      if (!pv.isInteger) return { name: tp.name, status:"conversion", detail:"trunc toward zero", group:"types" };
      return { name: tp.name, status:"exact", detail:"in range", group:"types" };
    }

    return null;
  };

  // ========= render =========

  let renderSeq = 0;

  const render = async () => {
    const mySeq = ++renderSeq;

    let timedOut = false;
    const tmo = setTimeout(() => {
      timedOut = true;
      if (mySeq !== renderSeq) return;
      meta.textContent = "";
      out.className = "result invalid";
      out.style.display = "block";
      out.textContent = "Timeout";
    }, TIMEOUT_MS);

    try {
      const s0 = inp.value;

      if (!s0.trim()) {
        window.__typeFitInfoActive = false;
        meta.textContent = "";
        out.style.display = "none";
        out.className = "result";
        out.innerHTML = "";
        return;
      }

      if (looksLikeTypeQuery(s0) && !parseDecimalRational(s0).ok) {
        window.__typeFitInfoActive = true;
        return;
      }

      window.__typeFitInfoActive = false;

      if (s0.length > MAX_SIZE) {
        meta.textContent = "";
        out.className = "result invalid";
        out.style.display = "block";
        out.textContent = `Input too long (max ${MAX_SIZE})`;
        return;
      }

      const pv = parseDecimalRational(s0);
      if (!pv.ok) {
        if (looksLikeTypeQuery(s0)) return;
        meta.textContent = "";
        out.className = "result invalid";
        out.style.display = "block";
        out.textContent = (pv.err === "too_long") ? `Input too long (max ${MAX_SIZE})` : "Invalid number";
        return;
      }

      let cfg;
      try { cfg = await loadLang(langSel.value); }
      catch {
        meta.textContent = "";
        out.className = "result invalid";
        out.style.display = "block";
        out.textContent = "Cannot load limits";
        return;
      }

      if (timedOut || mySeq !== renderSeq) return;

      const target = findTarget(cfg);
      const sourceMode = pickInputMode(cfg, pv);

      const head = [];
      head.push(`${cfg.name}${target ? " • " + target.name : ""}`);
      head.push(sourceMode === "float" ? "input: float syntax" : "input: integer syntax");

      if (pv.huge) {
        const approxBits = Math.max(0, Math.floor((pv.digitsLen - 1 + pv.exp10) * LOG2_10) + 1);
        head.push(`value bitlen: ~${approxBits} (approx)`);
      } else if (pv.isInteger) {
        head.push(`value bitlen: ${bitLen(pv.num)}`);
      } else {
        head.push(`rational: ${pv.num.toString()}/${pv.den.toString()}`);
      }

      meta.textContent = head.join(" • ");

      const rows = [];
      for (const tp of (cfg.types || [])) {
        if (timedOut || mySeq !== renderSeq) return;
        const r = evalType(pv, cfg, target, tp, sourceMode);
        if (!r) continue;
        rows.push(r);
      }

      rows.sort((a,b) =>
        groupRank(a.group) - groupRank(b.group) ||
        statusRank(a.status) - statusRank(b.status) ||
        a.name.localeCompare(b.name)
      );

      out.className = "result";
      out.style.display = "block";
      out.innerHTML = "";

      const stat = { exact:0, rounding:0, conversion:0, "implementation-defined":0, reject:0 };
      for (const it of rows) stat[it.status] = (stat[it.status] || 0) + 1;

      out.appendChild(mkLine(
        "summary",
        `exact ${stat.exact} • rounding ${stat.rounding} • conversion ${stat.conversion} • impl ${stat["implementation-defined"]} • reject ${stat.reject}`
      ));

      let curG = "";
      for (const it of rows) {
        if (timedOut || mySeq !== renderSeq) return;
        if (it.group !== curG) {
          curG = it.group;
          out.appendChild(mkHdr(curG === "conv" ? "Conversions" : "Types"));
        }
        out.appendChild(mkLine(it.status, it.detail ? `${it.name} — ${it.detail}` : it.name));
      }
    } finally {
      clearTimeout(tmo);
    }
  };

  const setLang = async (langId) => {
    const cfg = await loadLang(langId);
    fillTargets(cfg);
    await updateRefs(langId, cfg.name);
    hideLegend();
    hideRefs();
    await render();
  };

  langSel.addEventListener("change", async () => { await setLang(langSel.value); });
  targetSel.addEventListener("change", () => { render(); });
  inp.addEventListener("input", () => { render(); });

  fillLang();
  setLang(langSel.value);
})();
