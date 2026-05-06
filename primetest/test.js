const base64 = [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n];
const base51 = [2n, 3n, 5n, 7n];
const base32 = [2n, 3n, 61n];
const base16 = [2n, 3n];

const baseBigSeed = [2n, 3n, 5n, 7n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n];

const small_primes = [
  2n, 3n, 5n, 7n, 11n,
  13n, 17n, 19n, 23n, 29n,
  31n, 37n, 41n, 43n, 47n,
  53n, 59n, 61n, 67n, 71n,
  73n, 79n, 83n, 89n, 97n
];

const powMod = (base, exponent, modulus) => {
  if (modulus === 1n) return 0n;
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    exponent >>= 1n;
    base = (base * base) % modulus;
  }
  return result;
};

const factorNS1 = (n) => {
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  return { d, s };
};

const checkComposite = (n, a, d, s) => {
  let x = powMod(a, d, n);
  if (x === 1n || x === n - 1n) return false;
  for (let r = 1; r < s; r++) {
    x = (x * x) % n;
    if (x === n - 1n) return false;
  }
  return true;
};

// MR-ядро: без small_primes, без n<2, предполагает n — нечётное и не делится на малые простые
const isPrimeMR_core = (n, bases) => {
  const { d, s } = factorNS1(n);
  for (const a0 of bases) {
    const a = a0 % n;
    if (a === 0n) continue;
    if (checkComposite(n, a, d, s)) return false;
  }
  return true;
};

const bitLength = (n) => n.toString(2).length;

const randBigIntBelow = (limit) => {
  const bytes = (bitLength(limit) + 7) >> 3;
  const buf = new Uint8Array(bytes);
  while (true) {
    crypto.getRandomValues(buf);
    let x = 0n;
    for (let i = 0; i < buf.length; i++) x = (x << 8n) | BigInt(buf[i]);
    if (x < limit) return x;
  }
};

const isPrimeMR_Big = (n, rounds = 8) => {
  if (!isPrimeMR_core(n, baseBigSeed)) return false;
  if (rounds <= 0) return true;

  const { d, s } = factorNS1(n);
  const span = n - 3n;
  for (let i = 0; i < rounds; i++) {
    const a = randBigIntBelow(span) + 2n;
    if (checkComposite(n, a, d, s)) return false;
  }
  return true;
};

const isPrime = (n, rounds = 8) => {
  n = BigInt(n);

  if (n < 2n) return false;

  for (const p of small_primes) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }

  if ((n & 1n) === 0n) return false;

  if (n < (1n << 16n)) return isPrimeMR_core(n, base16);
  if (n < (1n << 32n)) return isPrimeMR_core(n, base32);
  if (n < (1n << 51n)) return isPrimeMR_core(n, base51);
  if (n < (1n << 64n)) return isPrimeMR_core(n, base64);

  return isPrimeMR_Big(n, rounds);
};


const inp = document.getElementById("name");
const out = document.getElementById("result");
const digitsEl = document.getElementById("digits");

const HINT = "Deterministic up to 2\u2076\u2074, probabilistic for larger BigInt";

const normalizeInput = (s) =>
  s.replace(/[\s\u00A0_,']/g, "");

const isValidDec = (s) => /^-?\d+$/.test(s);
const isValidHex = (s) => /^-?[0-9a-fA-F]+$/.test(s);

inp.addEventListener("input", (e) => {
  const raw = e.target.value;
  let s = normalizeInput(raw);

  if (s === "") {
    digitsEl.textContent = "";
    out.textContent = HINT;
    out.className = "result neutral";
    return;
  }

  const isHex = /[a-fA-F]/.test(s);

  if (isHex) {
    if (!isValidHex(s)) {
      digitsEl.textContent = "";
      out.textContent = "invalid integer";
      out.className = "result invalid";
      return;
    }

    const neg = s[0] === "-";
    const body = neg ? s.slice(1) : s;
    digitsEl.textContent = `(HEX ${body.length} digits)`;

    const n = BigInt((neg ? "-0x" : "0x") + body);

    if (n < 2n) {
      out.textContent = "not prime";
      out.className = "result composite";
      return;
    }

    const prime = isPrime(n, 8);
    out.textContent = prime ? "prime" : "composite";
    out.className = prime ? "result prime" : "result composite";
    return;
  }

  if (!isValidDec(s)) {
    digitsEl.textContent = "";
    out.textContent = "invalid integer";
    out.className = "result invalid";
    return;
  }

  const digits = (s[0] === "-" ? s.length - 1 : s.length);
  digitsEl.textContent = `(${digits} digits)`;

  const n = BigInt(s);

  if (n < 2n) {
    out.textContent = "not prime";
    out.className = "result composite";
    return;
  }

  const prime = isPrime(n, 8);
  out.textContent = prime ? "prime" : "composite";
  out.className = prime ? "result prime" : "result composite";
});
