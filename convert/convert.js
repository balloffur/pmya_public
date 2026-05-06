(() => {
  const DIG = "0123456789abcdefghijklmnopqrstuvwxyz";
  const DIGU = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const $ = (id) => document.getElementById(id);

  const inp = $("inp");
  const baseInInp = $("baseIn");
  const baseOutInp = $("baseOut");
  const caseModeSel = $("caseMode");
  const cPrefixesBtn = $("cPrefixes");
  const out = $("out");
  const meta = $("meta");

  const clean = (s) => (s ?? "").toString().trim().replace(/[\s_]+/g, "");

  const charVal = (c) => {
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 65 && code <= 90) return 10 + (code - 65);
    if (code >= 97 && code <= 122) return 10 + (code - 97);
    return -1;
  };

  const parseBaseField = (s) => {
    s = (s ?? "").toString().trim();
    if (!s) return NaN;
    if (!/^\d+$/.test(s)) return NaN;
    const b = parseInt(s, 10);
    if (!Number.isFinite(b) || b < 2 || b > 36) return NaN;
    return b | 0;
  };

  const normalizeBaseField = (el, dflt) => {
    const b = parseBaseField(el.value);
    el.value = Number.isNaN(b) ? String(dflt) : String(b);
  };

  const parseWithBase = (s, base) => {
    if (!(base >= 2 && base <= 36)) return { ok: false, err: "bad base" };
    if (!s) return { ok: false, err: "empty" };

    let sign = 1n;
    if (s[0] === "+") s = s.slice(1);
    else if (s[0] === "-") { sign = -1n; s = s.slice(1); }
    if (!s) return { ok: false, err: "empty" };

    let x = 0n;
    const B = BigInt(base);
    for (let i = 0; i < s.length; i++) {
      const v = charVal(s[i]);
      if (v < 0 || v >= base) return { ok: false, err: "invalid digit", pos: i };
      x = x * B + BigInt(v);
    }
    return { ok: true, value: x * sign };
  };

  const toBase = (x, base, upper) => {
    if (x === 0n) return "0";
    const B = BigInt(base);
    const A = upper ? DIGU : DIG;
    let sign = "";
    if (x < 0n) { sign = "-"; x = -x; }
    let s = "";
    while (x > 0n) {
      const r = Number(x % B);
      s = A[r] + s;
      x = x / B;
    }
    return sign + s;
  };

  const bitLen = (x) => {
    if (x === 0n) return 0;
    if (x < 0n) x = -x;
    return x.toString(2).length;
  };

  const mkLine = (label, value) => {
    const line = document.createElement("div");
    line.className = "line";

    const k = document.createElement("div");
    k.className = "k";
    k.textContent = label;

    const v = document.createElement("div");
    v.className = "v";
    v.textContent = value;

    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = "Copy";
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(value); } catch {}
    });

    line.appendChild(k);
    line.appendChild(v);
    line.appendChild(b);
    return line;
  };

  let cPrefixes = false;

  const withPrefixes = (base, s) => {
    if (!cPrefixes) return s;
    if (s === "0" || s === "-0") return s;
    if (base === 16) return (s[0] === "-" ? "-0x" + s.slice(1) : "0x" + s);
    if (base === 2)  return (s[0] === "-" ? "-0b" + s.slice(1) : "0b" + s);
    if (base === 8)  return (s[0] === "-" ? "-0o" + s.slice(1) : "0o" + s);
    return s;
  };

  const stripPrefixForParse = (raw, base) => {
    if (!raw) return raw;
    let s = raw;
    let sign = "";
    if (s[0] === "+" || s[0] === "-") { sign = s[0]; s = s.slice(1); }
    const lo = s.slice(0, 2).toLowerCase();
    if (base === 16 && lo === "0x") s = s.slice(2);
    else if (base === 2 && lo === "0b") s = s.slice(2);
    else if (base === 8 && lo === "0o") s = s.slice(2);
    return sign + s;
  };

  const autoBaseFromPrefix = (raw0) => {
    let s = (raw0 ?? "").toString().trim();
    if (!s) return 0;
    if (s[0] === "+" || s[0] === "-") s = s.slice(1);
    if (s.length < 2) return 0;
    const p = s.slice(0, 2);
    if (p === "0x" || p === "0X") return 16;
    if (p === "0b" || p === "0B") return 2;
    if (p === "0o" || p === "0O") return 8;
    return 0;
  };

  out.style.display = "none";


  function remove_separator(n){
    return n.replace(/[_ ',.]/g,"");
  }

  
  const render = () => {
    const raw0 = remove_separator(inp.value);

    if (!raw0.trim()) {
      meta.textContent = "";
      out.innerHTML = "";
      out.className = "result";
      out.style.display = "none";
      return;
    }
    out.style.display = "";

    const prefB = autoBaseFromPrefix(raw0);
    if (prefB) {
      const cur = parseBaseField(baseInInp.value);
      if (cur !== prefB) baseInInp.value = String(prefB);
    }

    const bi = parseBaseField(baseInInp.value);
    const bo = parseBaseField(baseOutInp.value);

    out.innerHTML = "";
    out.className = "result";

    if (Number.isNaN(bi) || Number.isNaN(bo)) {
      meta.textContent = "";
      out.classList.add("invalid");
      out.textContent = "Base 2..36";
      return;
    }

    let raw = clean(raw0);
    raw = stripPrefixForParse(raw, bi);

    const p = parseWithBase(raw, bi);
    if (!p.ok) {
      meta.textContent = "";
      out.classList.add("invalid");
      out.textContent = (p.err === "invalid digit") ? ("Invalid digit @" + (p.pos ?? 0)) : "Invalid";
      return;
    }

    const upper = (caseModeSel.value === "upper");
    const x = p.value;

    const bl = bitLen(x);
    const decDigits = (x < 0n ? (-x) : x).toString(10).length;
    meta.textContent = (x === 0n) ? "0 bits" : (bl + " bits, " + decDigits + " digits");

    out.appendChild(mkLine("out",   withPrefixes(bo, toBase(x, bo, upper))));
    out.appendChild(mkLine("base10", toBase(x, 10, upper)));
    out.appendChild(mkLine("base2",  withPrefixes(2,  toBase(x, 2,  upper))));
    out.appendChild(mkLine("base8",  withPrefixes(8,  toBase(x, 8,  upper))));
    out.appendChild(mkLine("base16", withPrefixes(16, toBase(x, 16, upper))));
  };

  cPrefixesBtn.addEventListener("click", () => {
    cPrefixes = !cPrefixes;
    cPrefixesBtn.style.opacity = cPrefixes ? "1" : ".85";
    render();
  });

  inp.addEventListener("input", render);
  baseInInp.addEventListener("input", render);
  baseOutInp.addEventListener("input", render);
  caseModeSel.addEventListener("change", render);

  baseInInp.addEventListener("blur", () => { normalizeBaseField(baseInInp, 10); render(); });
  baseOutInp.addEventListener("blur", () => { normalizeBaseField(baseOutInp, 2); render(); });

  render();
})();
