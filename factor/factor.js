"use strict";

(() => {
  const TIMEOUT_MS = 10_000;
  const SMALL_PRIME_LIMIT = 100000;
  const YIELD_EVERY = 2048;

  const $ = (id) => document.getElementById(id);

  const number = $("n");
  const button = $("factorBtn");
  const out = $("out");
  const btnCopy = $("btnCopy");

  let lastFactors = null;

  function yieldToUI(){
    return new Promise(r => setTimeout(r, 0));
  }

  function refreshOutClass(){
    const t = (out.textContent || "");
    const isErr = /invalid|timeout|error/i.test(t);
    out.classList.toggle("err", isErr);
    out.classList.toggle("ok", !isErr);
  }

  function toFactorJSON(factors){
    const arr = [];
    for (let i = 0; i < factors.length; i++){
      arr.push([factors[i][0].toString(), factors[i][1].toString()]);
    }
    return JSON.stringify({ factors: arr, timedOut: !!factors.timedOut });
  }

  async function copyText(text){
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {}
  }

  window.getFactorJSON = () => (lastFactors ? toFactorJSON(lastFactors) : "");

  window.runFactor = async () => {
    const raw = (number.value || "").trim();
    out.textContent = "working...";
    refreshOutClass();
    btnCopy.disabled = true;
    lastFactors = null;

    await yieldToUI();

    try {
      const factors = await factorAsync(raw, TIMEOUT_MS);
      lastFactors = factors;
      out.textContent = (factors && factors.timedOut) ? (pretty(factors) + " (partial)") : pretty(factors);
      btnCopy.disabled = !(lastFactors && lastFactors.length);
      refreshOutClass();
    } catch (e) {
      out.textContent = (e && e.message) ? e.message : String(e);
      btnCopy.disabled = true;
      refreshOutClass();
    }
  };

  button.addEventListener("click", () => window.runFactor());

  number.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      window.runFactor();
    }
  });

  btnCopy.addEventListener("click", async () => {
    const json = window.getFactorJSON();
    if (!json) return;
    await copyText(json);
  });

  const mo = new MutationObserver(() => refreshOutClass());
  mo.observe(out, { childList: true, characterData: true, subtree: true });

  refreshOutClass();

  const superDigits = {
    "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴",
    "5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"
  };

  function toSup(n){
    return n.toString().split("").map(d => superDigits[d]).join("");
  }

  function pretty(factors){
    if (!factors || factors.length === 0) return "";
    let ans = "";
    for (let i = 0; i < factors.length; i++){
      const p = factors[i][0];
      const e = factors[i][1];
      if (i > 0) ans += " · ";
      ans += (e === 1n) ? `${p}` : `${p}${toSup(e)}`;
    }
    return ans;
  }

  function makeDeadline(timeoutMs){
    return Date.now() + timeoutMs;
  }

  async function checkpoint(state){
    state.tick++;
    if ((state.tick & (YIELD_EVERY - 1)) === 0) {
      if (Date.now() > state.deadline) {
        const err = new Error("Timeout (10s)");
        err.timeout = true;
        throw err;
      }
      await yieldToUI();
    }
  }

  function gcdEuclid(a, b) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    while (b !== 0n) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  function gcdBinary(a, b) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;

    if (a === 0n) return b;
    if (b === 0n) return a;

    let shift = 0;
    while (((a | b) & 1n) === 0n) {
      a >>= 1n;
      b >>= 1n;
      shift++;
    }

    while ((a & 1n) === 0n) a >>= 1n;

    while (b !== 0n) {
      while ((b & 1n) === 0n) b >>= 1n;
      if (a > b) { const t = a; a = b; b = t; }
      b -= a;
    }

    return a << BigInt(shift);
  }

  const _GCD_THRESHOLD_N = 1n << 128n;

  function gcd(a, b) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    if (a === 0n) return b;
    if (b === 0n) return a;
    return (a < _GCD_THRESHOLD_N && b < _GCD_THRESHOLD_N) ? gcdEuclid(a, b) : gcdBinary(a, b);
  }

  function abs(n){ return n < 0n ? -n : n; }

  let _seed = 88172645463393265n;
  function rand64(){
    _seed = (_seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return _seed;
  }

  function randBelow(n){
    if (n <= 4n) return 2n;
    return 2n + (rand64() % (n - 3n));
  }

  function modMul(a, b, m){
    return (a * b) % m;
  }

  function powMod(a, d, mod){
    let r = 1n;
    let x = a % mod;
    while (d > 0n){
      if (d & 1n) r = (r * x) % mod;
      x = (x * x) % mod;
      d >>= 1n;
    }
    return r;
  }

  function isCompositeWitness(n, a, d, s){
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) return false;
    for (let i = 1; i < s; i++){
      x = (x * x) % n;
      if (x === n - 1n) return false;
    }
    return true;
  }

  function millerRabin(n, bases){
    let d = n - 1n;
    let s = 0;
    while ((d & 1n) === 0n){
      d >>= 1n;
      s++;
    }
    for (const a of bases){
      if (a % n === 0n) continue;
      if (isCompositeWitness(n, a, d, s)) return false;
    }
    return true;
  }

  const BASE_32 = [2n, 3n, 61n];
  const BASE_51 = [2n, 3n, 5n, 7n];
  const BASE_64 = [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n];

  const LIM_2_32 = 1n << 32n;
  const LIM_2_51 = 1n << 51n;
  const LIM_2_64 = 1n << 64n;

  function probabilisticBases(rounds){
    const bases = [
      2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n,
      31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n,
      73n, 79n, 83n, 89n, 97n
    ];
    return bases.slice(0, Math.max(1, Math.min(rounds, bases.length)));
  }

  function deterministicMillerRabin64(n){
    if (n < LIM_2_32) return millerRabin(n, BASE_32);
    if (n < LIM_2_51) return millerRabin(n, BASE_51);
    if (n < LIM_2_64) return millerRabin(n, BASE_64);
    return null;
  }

  function millerRabinAuto(n, opts = {}){
    n = typeof n === "bigint" ? n : BigInt(n);
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if ((n & 1n) === 0n) return false;

    const det = deterministicMillerRabin64(n);
    if (det !== null) return det;

    const bases = opts.bases ?? probabilisticBases(opts.rounds ?? 16);
    return millerRabin(n, bases);
  }

  const SMALL_PRIMES_TABLE = buildPrimeTable(SMALL_PRIME_LIMIT);

  function buildPrimeTable(limit){
    const L = limit | 0;
    const sieve = new Uint8Array(L + 1);
    const primes = [2];
    for (let i = 3; i <= L; i += 2){
      if (!sieve[i]){
        primes.push(i);
        if (i * i <= L){
          for (let j = i * i; j <= L; j += i << 1) sieve[j] = 1;
        }
      }
    }
    return primes.map(BigInt);
  }

  async function trialDivideTable(n, outArr, state){
    for (let idx = 0; idx < SMALL_PRIMES_TABLE.length; idx++){
      state.lastN = n;
      const p = SMALL_PRIMES_TABLE[idx];
      const pp = p * p;
      if (pp > n) break;

      if (n % p === 0n){
        let e = 0n;
        while (n % p === 0n){
          n /= p;
          e++;
          state.lastN = n;
          if ((e & 63n) === 0n) await checkpoint(state);
        }
        outArr.push([p, e]);
        if (n > 1n && millerRabinAuto(n)){
          outArr.push([n, 1n]);
          return 1n;
        }
      }

      if ((idx & 255) === 0) await checkpoint(state);
    }
    state.lastN = n;
    return n;
  }

  async function pollardRhoBrent(n, state){
    if ((n & 1n) === 0n) return 2n;
    if (n % 3n === 0n) return 3n;

    const gcdLocal = (n < _GCD_THRESHOLD_N) ? gcdEuclid : gcdBinary;

    while (true){
      const y0 = randBelow(n);
      const c  = randBelow(n);
      const m  = 128;

      let y = y0;
      let r = 1;
      let q = 1n;
      let g = 1n;

      const f = (v) => (modMul(v, v, n) + c) % n;

      while (g === 1n){
        let x = y;

        for (let i = 0; i < r; i++){
          y = f(y);
          if ((i & 127) === 0) await checkpoint(state);
        }

        let k = 0;
        while (k < r && g === 1n){
          const ys = y;
          const lim = Math.min(m, r - k);

          for (let i = 0; i < lim; i++){
            y = f(y);
            q = modMul(q, abs(x - y), n);
            if ((i & 127) === 0) await checkpoint(state);
          }

          g = gcdLocal(q, n);
          k += lim;

          if (g === n){
            y = ys;
            do {
              y = f(y);
              g = gcdLocal(abs(x - y), n);
              await checkpoint(state);
            } while (g === 1n);
          }
        }

        r <<= 1;
        await checkpoint(state);
      }

      if (g !== n) return g;
    }
  }

  async function factorRhoRec(n, primes, state, remBox){
    if (n === 1n) return;
    if (millerRabinAuto(n)){
      primes.push(n);
      if (remBox && remBox.v % n === 0n) remBox.v /= n;
      return;
    }
    const d = await pollardRhoBrent(n, state);
    await factorRhoRec(d, primes, state, remBox);
    await factorRhoRec(n / d, primes, state, remBox);
  }

  function packFactors(primes){
    primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const outArr = [];
    for (const p of primes){
      if (outArr.length && outArr[outArr.length - 1][0] === p) outArr[outArr.length - 1][1] += 1n;
      else outArr.push([p, 1n]);
    }
    return outArr;
  }

  async function factor_big(n, state){
    const primes = [];
    const remBox = { v: n };
    try {
      await factorRhoRec(n, primes, state, remBox);
      return packFactors(primes);
    } catch (e) {
      if (!(e && e.timeout)) throw e;
      const packed = packFactors(primes);
      if (remBox.v > 1n) packed.push([remBox.v, 1n]);
      packed.timedOut = true;
      return packed;
    }
  }

  function remove_separator(n){
  return n.replace(/[_ ',.]/g,"");
  }
  
  async function factorAsync(raw, timeoutMs){
    const state = { deadline: makeDeadline(timeoutMs), tick: 0, lastN: 0n };
    let n=remove_separator(raw);
    try {
      n = BigInt(n);
    } catch {
      throw new Error("Invalid integer");
    }
    if (n < 2n) return [];

    const ans = [];
    try {
      n = await trialDivideTable(n, ans, state);

      if (n === 1n) return ans;
      if (millerRabinAuto(n)){
        ans.push([n, 1n]);
        return ans;
      }

      const big = await factor_big(n, state);
      const res = ans.concat(big);
      if (big && big.timedOut) res.timedOut = true;
      return res;
    } catch (e) {
      if (!(e && e.timeout)) throw e;
      const res = ans.slice();
      const tail = state.lastN && state.lastN > 1n ? state.lastN : 0n;
      if (tail > 1n) res.push([tail, 1n]);
      res.timedOut = true;
      return res;
    }
  }
})();
