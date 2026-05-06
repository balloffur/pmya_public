// info.js
(() => {
  const $ = (id) => document.getElementById(id);

  const inp = $("inp");
  const langSel = $("lang");
  const targetSel = $("target");
  const out = $("out");
  const meta = $("meta");

  const FILES = {
    c: "c.json",
    java: "java.json",
    js: "js.json",
    go: "go.json",
    cs: "csharp.json",
    ktl: "kotlin.json",
    rust: "rust.json"
  };

  const cache = new Map();

  const clean = (s) => (s ?? "").toString().trim();
  const compact = (s) => clean(s).toLowerCase().replace(/[\s_\-./:]+/g, "");
  const looksLikeTypeQuery = (s) => /[a-zA-Z]/.test(s ?? "");
  const looksNumeric = (s) =>
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.test(
      clean(s).replace(/[\s_]+/g, "")
    );

  const isPrimitive = (v) =>
    typeof v === "string" || typeof v === "number" || typeof v === "boolean";

  const isPlainObject = (v) =>
    !!v && typeof v === "object" && !Array.isArray(v);

  const isLinkPair = (v) =>
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "string" &&
    typeof v[1] === "string" &&
    /^https?:\/\//i.test(v[1]);

  const isEmptyValue = (v) => {
    if (v == null) return true;
    if (typeof v === "string") return clean(v) === "";
    if (Array.isArray(v)) return v.filter((x) => !isEmptyValue(x)).length === 0;
    if (isPlainObject(v)) {
      return Object.entries(v).filter(([, val]) => !isEmptyValue(val)).length === 0;
    }
    return false;
  };

  const uniqueStrings = (arr) => {
    const seen = new Set();
    const out = [];
    for (const item of arr || []) {
      const s = clean(item);
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  };

  const humanizeKey = (key) => {
    const s = clean(key);
    if (!s) return "";

    // LP64, IEEE754, ILP32 и т.п. не трогаем
    if (/^[A-Z0-9_+\-/.]+$/.test(s)) return s;

    return s
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const mkLine = (k, v) => {
    const line = document.createElement("div");
    line.className = "line";

    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;

    const vv = document.createElement("div");
    vv.className = "v";

    if (typeof v === "string") {
      vv.textContent = v;
    } else if (v instanceof Node) {
      vv.appendChild(v);
    }

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

  const mkList = (items) => {
    const ul = document.createElement("ul");
    ul.className = "info-list";

    for (const item of items || []) {
      if (isEmptyValue(item)) continue;
      const li = document.createElement("li");
      li.appendChild(renderValue(item));
      ul.appendChild(li);
    }

    return ul;
  };

  const mkLinks = (items) => {
    const wrap = document.createElement("div");
    wrap.className = "ref-list";

    for (const item of items || []) {
      if (!isLinkPair(item)) continue;
      const a = document.createElement("a");
      a.href = item[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = item[0];
      wrap.appendChild(a);
    }

    return wrap;
  };

  const mkObject = (obj) => {
    const ul = document.createElement("ul");
    ul.className = "info-list";

    for (const [rawKey, rawValue] of Object.entries(obj || {})) {
      if (isEmptyValue(rawValue)) continue;

      const li = document.createElement("li");

      const key = document.createElement("span");
      key.className = "info-key";
      key.textContent = `${humanizeKey(rawKey)}: `;
      li.appendChild(key);

      if (isPrimitive(rawValue)) {
        const span = document.createElement("span");
        span.textContent = String(rawValue);
        li.appendChild(span);
      } else {
        li.appendChild(renderValue(rawValue));
      }

      ul.appendChild(li);
    }

    return ul;
  };

  function renderValue(value) {
    if (isEmptyValue(value)) {
      const span = document.createElement("span");
      span.textContent = "";
      return span;
    }

    if (isPrimitive(value)) {
      const span = document.createElement("span");
      span.textContent = String(value);
      return span;
    }

    if (Array.isArray(value)) {
      if (value.every(isLinkPair)) return mkLinks(value);
      return mkList(value);
    }

    if (isPlainObject(value)) {
      return mkObject(value);
    }

    const fallback = document.createElement("span");
    fallback.textContent = String(value);
    return fallback;
  }

  const appendField = (label, value) => {
    if (isEmptyValue(value)) return;
    out.appendChild(mkLine(label, renderValue(value)));
  };

  const loadInfo = async (langId) => {
    if (cache.has(langId)) return cache.get(langId);

    const file = FILES[langId];
    if (!file) throw new Error("unknown lang");

    const r = await fetch("./typeinfo/" + file, { cache: "no-cache" });
    if (!r.ok) throw new Error("load failed");

    const j = await r.json();
    cache.set(langId, j);
    return j;
  };

  const matchesTarget = (entry, targetId) => {
    if (!entry.targets || !entry.targets.length) return true;
    return entry.targets.includes(targetId);
  };

  const collectNames = (entry) => {
    return uniqueStrings([
      entry.id,
      entry.displayName,
      ...(entry.names || []),
      ...(entry.aliases || []),
      ...(entry.otherNames || [])
    ]);
  };

  const findTypeEntry = (db, query, targetId) => {
    const q = compact(query);
    if (!q) return null;

    let fallback = null;
    const suggestions = [];

    for (const entry of db.types || []) {
      if (!matchesTarget(entry, targetId)) continue;

      const names = collectNames(entry);
      const compactNames = names.map(compact);

      if (compactNames.includes(q)) {
        return { entry, suggestions: [] };
      }

      if (compactNames.some((name) => name.includes(q) || q.includes(name))) {
        suggestions.push(entry.displayName || entry.id || names[0]);
        if (!fallback) fallback = entry;
      }
    }

    return {
      entry: null,
      suggestions: uniqueStrings(suggestions).slice(0, 8),
      fallback
    };
  };

  const currentTargetId = () =>
    targetSel && targetSel.value ? targetSel.value : "";

  const renderTypeInfo = (db, entry, suggestions) => {
    window.__typeFitInfoActive = true;
    meta.textContent = `${db.name || langSel.value} • type info`;
    out.className = "result";
    out.style.display = "block";
    out.innerHTML = "";

    const typeName = entry.displayName || entry.id;
    const allNames = collectNames(entry);
    const otherNames = uniqueStrings(
      allNames.filter((x) => x !== typeName && x !== entry.id)
    );

    appendField("type", typeName);
    appendField("kind", entry.kind || entry.category);
    appendField("availability", entry.availability);
    appendField("definition", entry.definition);
    appendField("summary", entry.summary);

    const sizes = {};
    if (entry.standardGuarantee) sizes.standard = entry.standardGuarantee;
    if (entry.mainstreamSizes) sizes.mainstream = entry.mainstreamSizes;

    if (entry.targetSizes) {
      const t = currentTargetId();
      if (t && entry.targetSizes[t]) {
        sizes.selectedTarget = { [t]: entry.targetSizes[t] };
      } else {
        sizes.targetSpecific = entry.targetSizes;
      }
    }

    appendField("sizes", sizes);
    appendField("range", entry.range);
    appendField("precision", entry.precision);
    appendField("rounding", entry.rounding);
    appendField("examples", entry.examples);
    appendField("special rules", entry.specialRules);
    appendField("other names", otherNames);
    appendField("read more", entry.readMore);

    if (suggestions?.length) {
      out.appendChild(mkHdr("Related"));
      appendField("matches", suggestions);
    }
  };

  const renderNotFound = (db, query, suggestions) => {
    window.__typeFitInfoActive = true;
    meta.textContent = `${db.name || langSel.value} • type info`;
    out.className = "result invalid";
    out.style.display = "block";
    out.innerHTML = "";

    appendField("query", clean(query));
    appendField("status", "Type not found in this language dataset");
    if (suggestions?.length) appendField("maybe", suggestions);
  };

  const render = async () => {
    const raw = inp.value;

    if (!clean(raw)) {
      if (window.__typeFitInfoActive) {
        out.style.display = "none";
        out.className = "result";
        out.innerHTML = "";
        meta.textContent = "";
      }
      window.__typeFitInfoActive = false;
      return;
    }

    if (looksNumeric(raw)) {
      if (window.__typeFitInfoActive) {
        window.__typeFitInfoActive = false;
      }
      return;
    }

    if (!looksLikeTypeQuery(raw)) {
      return;
    }

    let db;
    try {
      db = await loadInfo(langSel.value);
    } catch {
      window.__typeFitInfoActive = true;
      meta.textContent = "";
      out.className = "result invalid";
      out.style.display = "block";
      out.textContent = "Cannot load type info";
      return;
    }

    const found = findTypeEntry(db, raw, currentTargetId());
    if (found && found.entry) {
      renderTypeInfo(db, found.entry, found.suggestions);
      return;
    }

    renderNotFound(db, raw, (found && found.suggestions) || []);
  };

  if (langSel) langSel.addEventListener("change", () => setTimeout(render, 0));
  if (targetSel) targetSel.addEventListener("change", () => setTimeout(render, 0));
  if (inp) inp.addEventListener("input", () => setTimeout(render, 0));

  setTimeout(render, 0);
})();
