(() => {
  const TokenType = {
    NUMBER: 0, OPERATOR: 1, FUNCTION: 2, PARENTHESIS: 3, PREV: 4, VARIABLE: 5
  };

  let TIMEOUT_TIME = 5000;

  const math_constants = Object.freeze({
    pi: "3.141592653589793",
    e:  "2.718281828459045",
    phi:"1.618033988749895",
  });

  const float_FUNCS = new Set([
    "sin","cos","tan","tg","ctg",
    "arcsin","arccos","arctan","arctg","arcctg","arccot",
    "ln","lg","log","sqrt","abs",
    "ceil","floor","round",
    "gcd","lcm"
  ]);

  const float_CONSTS = new Set(["pi","e","phi"]);

  const BANNED_NAMES = new Set([
    "pi","e","phi","euler","gamma",
    "sin","cos","tan","tg","ctg","cot","sec","csc","asin","acos","atan","atan2","arcsin","arccos",
    "arctan","arctg","arcctg","arccot","sinh","cosh","tanh","asinh","acosh","atanh",
    "ln","lg","log","log2","log10","exp","exp2",
    "sqrt","cbrt","pow","sqr","square","cube",
    "abs","fabs","ceil","floor","round","trunc","max","min","sum","avg","mean","factorial","fact","lgamma",
    "fib","fibonacci","gcd","lcm","powmod","binomial","c",
    "ans","prev","last","result","help","exit","quit","clear","cls",
    "deg","rad","mode","vars","variables","var","v","float","int","bigint","exact","aprox",
    "mod","div","and","or","not","xor","if","then","else","for","while","do","true","false","null","undefined","infinity","nan",
    "system","eval","calc","function","let","const"
  ]);

  const DEG_TO_RAD = 0.01745329251994329576923690768488612713412398;

  const evl = window.evl = {
    auto_mode: true,
    set_auto_mode(v){ this.auto_mode = !!v; },
    trig_mode_degrees: false,
    float_answer: 0,
    bigint_answer: 0n,
    float_variables: Object.create(null),
    bigint_variables: Object.create(null),
    _deadline_ms: 0,
    clear_variables(){
      this.float_variables = Object.create(null);
      this.bigint_variables = Object.create(null);
    }
  };

  function startDeadline(){
    if (TIMEOUT_TIME > 0) evl._deadline_ms = performance.now() + TIMEOUT_TIME;
    else evl._deadline_ms = 0;
  }

  function checkTimeout(){
    const d = evl._deadline_ms;
    if (d && performance.now() > d) throw new Error("Timeout");
  }

  function detect_mode(expr){
    const s = String(expr).toLowerCase();
    if (/\d+\.\d*|\.\d+/.test(s)) return "float";
    if (s.includes("/")) return "float";
    for (const c of float_CONSTS) if (new RegExp(`\\b${c}\\b`).test(s)) return "float";
    for (const f of float_FUNCS) if (new RegExp(`\\b${f}\\s*\\(`).test(s)) return "float";
    return "BIGINT";
  }

  function precedence(op){
    if (op === "!") return 6;
    if (op === "~") return 5;
    if (op === "^") return 4;
    if (op === "*" || op === "/" || op === "%") return 3;
    if (op === "+" || op === "-") return 2;
    return 0;
  }

  function is_right_associative(op){
    return op === "^" || op === "!" || op === "~";
  }

  function tokenize(expr){
    const tokens = [];
    let num = "";

    const isSpace = c => c===" "||c==="\t"||c==="\n"||c==="\r";
    const isDigit = c => c>="0"&&c<="9";
    const isAlpha = c => (c>="A"&&c<="Z")||(c>="a"&&c<="z");
    const isAlnum_ = c => isAlpha(c)||isDigit(c)||c==="_";

    for (let i=0;i<expr.length;i++){
      const ch = expr[i];
      if (isSpace(ch)) continue;

      if (ch === ","){ tokens.push({type:TokenType.OPERATOR,value:","}); continue; }

      if (isDigit(ch) || ch === "."){
        let has_dot = (ch === ".");
        num += ch;
        while (i+1<expr.length && (isDigit(expr[i+1]) || expr[i+1]===".")){
          if (expr[i+1]==="."){
            if (has_dot) throw new Error("float .");
            has_dot = true;
          }
          num += expr[++i];
        }
        tokens.push({type:TokenType.NUMBER,value:num});
        num = "";
        continue;
      }

      if (isAlpha(ch)){
        let id = ch;
        while (i+1<expr.length && isAlnum_(expr[i+1])) id += expr[++i];
        const key = id.toLowerCase();

        if (key === "ans"){
          tokens.push({type:TokenType.PREV,value:""});
          continue;
        }
        if (math_constants[key] != null){
          tokens.push({type:TokenType.NUMBER,value:math_constants[key]});
          continue;
        }

        let j = i + 1;
        while (j < expr.length && isSpace(expr[j])) j++;
        const isCall = (j < expr.length && expr[j] === "(");

        if (isCall) tokens.push({type:TokenType.FUNCTION,value:key});
        else tokens.push({type:TokenType.VARIABLE,value:id});
        continue;
      }

      if (ch === "-"){
        if (
          tokens.length === 0 ||
          (tokens.at(-1).type === TokenType.OPERATOR && tokens.at(-1).value !== "!") ||
          (tokens.at(-1).type === TokenType.PARENTHESIS && tokens.at(-1).value === "(")
        ){
          tokens.push({type:TokenType.OPERATOR,value:"~"});
        } else {
          tokens.push({type:TokenType.OPERATOR,value:"-"});
        }
        continue;
      }

      if (ch==="+"||ch==="*"||ch==="/"||ch==="%"||ch==="^"||ch==="!"){
        tokens.push({type:TokenType.OPERATOR,value:ch});
        continue;
      }

      if (ch==="("||ch===")"){
        tokens.push({type:TokenType.PARENTHESIS,value:ch});
        continue;
      }

      throw new Error("Unknown character in expression");
    }

    return tokens;
  }

  function to_postfix(tokens){
    const output = [];
    const ops = [];

    for (const token of tokens){
      if (token.type === TokenType.NUMBER || token.type === TokenType.PREV || token.type === TokenType.VARIABLE){
        output.push(token);
        continue;
      }

      if (token.type === TokenType.FUNCTION){
        ops.push(token);
        continue;
      }

      if (token.type === TokenType.OPERATOR){
        if (token.value === ","){
          while (ops.length && !(ops.at(-1).type === TokenType.PARENTHESIS && ops.at(-1).value === "(")){
            output.push(ops.pop());
          }
          continue;
        }

        if (token.value === "!"){
          output.push(token);
          continue;
        }

        while (ops.length && (
          ops.at(-1).type === TokenType.FUNCTION ||
          (ops.at(-1).type === TokenType.OPERATOR &&
            (precedence(ops.at(-1).value) > precedence(token.value) ||
             (precedence(ops.at(-1).value) === precedence(token.value) && !is_right_associative(token.value))))
        )){
          output.push(ops.pop());
        }
        ops.push(token);
        continue;
      }

      if (token.type === TokenType.PARENTHESIS && token.value === "("){
        ops.push(token);
        continue;
      }

      if (token.type === TokenType.PARENTHESIS && token.value === ")"){
        while (ops.length && !(ops.at(-1).type === TokenType.PARENTHESIS && ops.at(-1).value === "(")){
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error("Mismatched parentheses");
        ops.pop();
        while (ops.length && ops.at(-1).type === TokenType.FUNCTION) output.push(ops.pop());
        continue;
      }
    }

    while (ops.length){
      const t = ops.pop();
      if (t.type === TokenType.PARENTHESIS) throw new Error("Mismatched parentheses");
      output.push(t);
    }
    return output;
  }

  function safe_popA(stk){
    if (!stk.length) throw new Error("Stack underflow - insufficient operands");
    return stk.pop();
  }

  function biToNumberLoose(x){
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error("BigInt too large for Number");
    return n;
  }

  function numToBigIntStrict(x){
    if (!Number.isFinite(x)) throw new Error("Non-finite float to bigint");
    if (!Number.isInteger(x)) throw new Error("Non-integer float to bigint");
    if (Math.abs(x) > Number.MAX_SAFE_INTEGER) throw new Error("float too large for exact bigint");
    return BigInt(x);
  }

  function eval_postfix_float(postfix){
    const stk = [];

    for (const token of postfix){
      checkTimeout();

      if (token.type === TokenType.NUMBER){
        stk.push(Number(token.value));
        continue;
      }
      if (token.type === TokenType.PREV){
        stk.push(Number(evl.float_answer));
        continue;
      }
      if (token.type === TokenType.VARIABLE){
        if (Object.prototype.hasOwnProperty.call(evl.float_variables, token.value)){
          stk.push(Number(evl.float_variables[token.value]));
        } else if (Object.prototype.hasOwnProperty.call(evl.bigint_variables, token.value)){
          stk.push(biToNumberLoose(evl.bigint_variables[token.value]));
        } else {
          throw new Error("Undefined variable: " + token.value);
        }
        continue;
      }

      if (token.type === TokenType.OPERATOR || token.type === TokenType.FUNCTION){
        const v = token.value;

        if (v === "+"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a+b); }
        else if (v === "-"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a-b); }
        else if (v === "*"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a*b); }
        else if (v === "/"){ const b=safe_popA(stk), a=safe_popA(stk); if (b===0) throw new Error("Division by zero"); stk.push(a/b); }
        else if (v === "%"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a%b); }
        else if (v === "^"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(Math.pow(a,b)); }
        else if (v === "~"){ const a=safe_popA(stk); stk.push(-a); }
        else {
          if (v === "gcd"){
            let b = Math.abs(Math.trunc(safe_popA(stk)));
            let a = Math.abs(Math.trunc(safe_popA(stk)));
            while (b !== 0){
              checkTimeout();
              const t = a % b; a = b; b = t;
            }
            stk.push(a);
          } else if (v === "lcm"){
            let b = Math.abs(Math.trunc(safe_popA(stk)));
            let a = Math.abs(Math.trunc(safe_popA(stk)));
            const g = (()=>{ let x=a,y=b; while (y!==0){ checkTimeout(); const t=x%y; x=y; y=t; } return x; })();
            stk.push(g===0 ? 0 : (a/g)*b);
          } else if (v === "log"){
            const arg = safe_popA(stk);
            const base = safe_popA(stk);
            if (arg <= 0 || base <= 0 || base === 1) throw new Error("Logarithm error");
            stk.push(Math.log(arg) / Math.log(base));
          } else {
            const a0 = safe_popA(stk);
            const t = (evl.trig_mode_degrees ? a0*DEG_TO_RAD : a0);

            if (v === "sin") stk.push(Math.sin(t));
            else if (v === "cos") stk.push(Math.cos(t));
            else if (v === "tan" || v === "tg") stk.push(Math.tan(t));
            else if (v === "ctg") stk.push(1.0 / Math.tan(t));
            else if (v === "arcsin"){ if (a0<-1||a0>1) throw new Error("arcsin out of domain"); stk.push(Math.asin(a0)); }
            else if (v === "arccos"){ if (a0<-1||a0>1) throw new Error("arccos out of domain"); stk.push(Math.acos(a0)); }
            else if (v === "arctan" || v === "arctg") stk.push(Math.atan(a0));
            else if (v === "arcctg" || v === "arccot"){ if (a0===0) throw new Error("arcctg undefined for zero"); stk.push(Math.atan(1.0/a0)); }
            else if (v === "ln") stk.push(Math.log(a0));
            else if (v === "lg") stk.push(Math.log10(a0));
            else if (v === "sqrt") stk.push(Math.sqrt(a0));
            else if (v === "abs") stk.push(Math.abs(a0));
            else if (v === "ceil") stk.push(Math.ceil(a0));
            else if (v === "floor") stk.push(Math.floor(a0));
            else if (v === "round") stk.push(Math.round(a0));
            else throw new Error("Unknown function: " + v);
          }
        }
      }
    }

    if (stk.length !== 1) throw new Error("Incorrect expression");
    return stk[0];
  }

  function BI(x){ return BigInt(x); }
  function absBI(a){ return a < 0n ? -a : a; }

  function gcdBI(a,b){
    a = absBI(a); b = absBI(b);
    while (b !== 0n){
      checkTimeout();
      const t = a % b; a = b; b = t;
    }
    return a;
  }

  function lcmBI(a,b){
    a = absBI(a); b = absBI(b);
    if (a === 0n || b === 0n) return 0n;
    return (a / gcdBI(a,b)) * b;
  }

  function powBI(a, e){
    if (e < 0n) throw new Error("Negative exponent in BigInt");
    let r = 1n;
    while (e !== 0n){
      checkTimeout();
      if (e & 1n) r *= a;
      a *= a;
      e >>= 1n;
    }
    return r;
  }

  function powmodBI(a, e, m){
    if (m === 0n) throw new Error("powmod mod=0");
    if (e < 0n) throw new Error("Negative exponent in powmod");
    a %= m;
    let r = 1n % m;
    while (e !== 0n){
      checkTimeout();
      if (e & 1n) r = (r * a) % m;
      a = (a * a) % m;
      e >>= 1n;
    }
    return r;
  }

  function fibBI(n){
    if (n < 0n) throw new Error("fib negative");
    let a = 0n, b = 1n;
    while (n !== 0n){
      checkTimeout();
      const t = a + b;
      a = b;
      b = t;
      n -= 1n;
    }
    return a;
  }

  function factorialBI(n){
    if (n < 0n) throw new Error("factorial negative");
    let r = 1n;
    for (let i = 2n; i <= n; i++){
      checkTimeout();
      r *= i;
    }
    return r;
  }

  function binomialBI(n,k){
    if (n < 0n || k < 0n) throw new Error("binomial negative");
    if (k > n) return 0n;
    if (k > n - k) k = n - k;
    let r = 1n;
    for (let i = 1n; i <= k; i++){
      checkTimeout();
      r = (r * (n - k + i)) / i;
    }
    return r;
  }

  function isqrtBI(n){
    if (n < 0n) throw new Error("sqrt negative");
    if (n < 2n) return n;
    let x = n;
    let y = (x + 1n) >> 1n;
    while (y < x){
      checkTimeout();
      x = y;
      y = (x + n / x) >> 1n;
    }
    return x;
  }

  function eval_postfix_bigint(postfix){
    const stk = [];

    for (const token of postfix){
      checkTimeout();

      if (token.type === TokenType.NUMBER){
        if (token.value.includes(".")) throw new Error("BigInt number with dot");
        stk.push(BI(token.value));
        continue;
      }
      if (token.type === TokenType.PREV){
        stk.push(evl.bigint_answer);
        continue;
      }
      if (token.type === TokenType.VARIABLE){
        if (Object.prototype.hasOwnProperty.call(evl.bigint_variables, token.value)){
          stk.push(evl.bigint_variables[token.value]);
        } else if (Object.prototype.hasOwnProperty.call(evl.float_variables, token.value)){
          stk.push(numToBigIntStrict(Number(evl.float_variables[token.value])));
        } else {
          throw new Error("Undefined variable: " + token.value);
        }
        continue;
      }

      if (token.type === TokenType.OPERATOR || token.type === TokenType.FUNCTION){
        const v = token.value;

        if (v === "+"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a+b); }
        else if (v === "-"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a-b); }
        else if (v === "*"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a*b); }
        else if (v === "/"){ const b=safe_popA(stk), a=safe_popA(stk); if (b===0n) throw new Error("Division by zero"); stk.push(a/b); }
        else if (v === "%"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(a%b); }
        else if (v === "^"){ const b=safe_popA(stk), a=safe_popA(stk); stk.push(powBI(a,b)); }
        else if (v === "!"){ const a=safe_popA(stk); stk.push(factorialBI(a)); }
        else if (v === "~"){ const a=safe_popA(stk); stk.push(-a); }
        else {
          if (v === "gcd"){
            const b=safe_popA(stk), a=safe_popA(stk);
            stk.push(gcdBI(a,b));
          } else if (v === "lcm"){
            const b=safe_popA(stk), a=safe_popA(stk);
            stk.push(lcmBI(a,b));
          } else if (v === "powmod"){
            const mod=safe_popA(stk), pow=safe_popA(stk), a=safe_popA(stk);
            stk.push(powmodBI(a,pow,mod));
          } else if (v === "c"){
            const b=safe_popA(stk), a=safe_popA(stk);
            stk.push(binomialBI(a,b));
          } else {
            const a=safe_popA(stk);
            if (v === "sqr") stk.push(a*a);
            else if (v === "sqrt") stk.push(isqrtBI(a));
            else if (v === "abs") stk.push(absBI(a));
            else if (v === "fib") stk.push(fibBI(a));
            else throw new Error("Unknown function: " + v);
          }
        }
      }
    }

    if (stk.length !== 1) throw new Error("Incorrect expression");
    return stk[0];
  }

  function assign_parse(expression){
    const eq = expression.indexOf("=");
    if (eq <= 0 || eq === expression.length - 1) return null;

    let name = expression.slice(0, eq).replace(/\s+/g, "");
    const rhs = expression.slice(eq + 1);

    if (!name.length) return null;
    if (!(/[A-Za-z]/.test(name[0]))) return null;
    if (!/^[A-Za-z0-9_]+$/.test(name)) return null;

    const low = name.toLowerCase();
    if (BANNED_NAMES.has(low)) throw new Error("Banned variable name: " + name);

    return { name, rhs };
  }

  function eval_do_float(expression){
    const toks = tokenize(expression);
    const rpn  = to_postfix(toks);
    return eval_postfix_float(rpn);
  }

  function eval_bi(expression){
    const toks = tokenize(expression);
    const rpn  = to_postfix(toks);
    return eval_postfix_bigint(rpn);
  }

  function formatfloat(x){
    if (!Number.isFinite(x)) return String(x);
    const ax = Math.abs(x);
    const r = Math.round(x);
    const eps = 1e-12 * Math.max(1, ax);
    if (Math.abs(x - r) <= eps) return String(r);
    return String(x);
  }

  function formatOut(mode, value){
    if (mode === "BIGINT") return value.toString();
    return formatfloat(value);
  }

  function render_vars(){
    const el = document.getElementById("vars_list");
    if (!el) return;

    const dk = Object.keys(evl.float_variables).sort((a,b)=>a.localeCompare(b));
    const bk = Object.keys(evl.bigint_variables).sort((a,b)=>a.localeCompare(b));

    if (!dk.length && !bk.length){ el.textContent = ""; return; }

    let s = "";
    if (dk.length){
      s += "float:\n";
      s += dk.map(k => `${k} = ${formatfloat(Number(evl.float_variables[k]))}`).join("\n");
      s += "\n";
    }
    if (bk.length){
      s += "bigint:\n";
      s += bk.map(k => `${k} = ${evl.bigint_variables[k].toString()}`).join("\n");
    }
    el.textContent = s.trimEnd();
  }

  function eval_line(line){
    startDeadline();

    const ap = assign_parse(line);
    const mode = detect_mode(ap ? ap.rhs : line);

    if (ap){
      if (mode === "float"){
        const v = eval_do_float(ap.rhs);
        evl.float_variables[ap.name] = v;
        delete evl.bigint_variables[ap.name];
        evl.float_answer = v;
        return { mode, value: v };
      } else {
        const v = eval_bi(ap.rhs);
        evl.bigint_variables[ap.name] = v;
        delete evl.float_variables[ap.name];
        evl.bigint_answer = v;
        return { mode, value: v };
      }
    } else {
      if (mode === "float"){
        const v = eval_do_float(line);
        evl.float_answer = v;
        return { mode, value: v };
      } else {
        const v = eval_bi(line);
        evl.bigint_answer = v;
        return { mode, value: v };
      }
    }
  }

  function directive(line){
    const s = line.slice(1).trim();
    const low = s.toLowerCase();

    if (low === "deg"){ evl.trig_mode_degrees = true; return { kind:"mode" }; }
    if (low === "rad"){ evl.trig_mode_degrees = false; return { kind:"mode" }; }

    if (low === "clear" || low === "cls"){
      evl.clear_variables();
      evl.float_answer = 0;
      evl.bigint_answer = 0n;
      return { kind:"noop" };
    }

    if (low === "vars"){
      return { kind:"vars" };
    }

    if (low.startsWith("timeout")){
      const m = s.match(/^timeout\s*=\s*(-?\d+)\s*$/i);
      if (!m) throw new Error("Bad directive: #timeout=<ms>");
      TIMEOUT_TIME = Number(m[1]);
      if (!Number.isFinite(TIMEOUT_TIME)) TIMEOUT_TIME = 0;
      return { kind:"noop" };
    }

    if (low === "mode"){
      return { kind:"mode" };
    }

    throw new Error("Unknown directive: #" + s);
  }

  function parseRepeat(line){
    const m = line.match(/^#repeat\s+(\d+)(?:\s+(\d+))?\s*$/i);
    if (!m) return null;
    const a = Number(m[1]);
    const b = (m[2] != null) ? Number(m[2]) : null;
    if (!Number.isFinite(a) || a < 0 || (a|0) !== a) throw new Error("Bad #repeat n");
    if (b != null && (!Number.isFinite(b) || b < 0 || (b|0) !== b)) throw new Error("Bad #repeat n m");
    return { n: a, m: b };
  }

  const exprEl = document.getElementById("expr");
  const outEl  = document.getElementById("out");

  function autosize(){
    if (!exprEl) return;
    exprEl.style.height = "0px";
    exprEl.style.height = exprEl.scrollHeight + "px";
  }

  function runLines(text){
    const raw = String(text).replace(/;/g, "\n").split(/\r?\n/);
    const lines = [];
    for (let i=0;i<raw.length;i++){
      const s = raw[i].trim();
      if (s) lines.push(s);
    }

    let last = null;
    let didVars = false;
    let didMode = false;

    function execRange(lo, hi, times){
      for (let t=0; t<times; t++){
        for (let i=lo; i<hi; i++){
          const s = lines[i];
          if (!s) continue;

          const rep = (s[0] === "#") ? parseRepeat(s) : null;
          if (rep){
            if (rep.m == null){
              const n = rep.n;
              if (n === 0) return;
              execRange(i+1, hi, n);
              return;
            } else {
              const blockLen = rep.n;
              const blockTimes = rep.m;
              const j = Math.min(hi, i + 1 + blockLen);
              if (blockTimes > 0 && blockLen > 0) execRange(i+1, j, blockTimes);
              i = j - 1;
              continue;
            }
          }

          if (s[0] === "#"){
            const r = directive(s);
            if (r.kind === "vars") didVars = true;
            else if (r.kind === "mode") didMode = true;
            continue;
          }

          last = eval_line(s);
        }
      }
    }

    execRange(0, lines.length, 1);

    if (last) outEl.textContent = formatOut(last.mode, last.value);
    else if (didMode) outEl.textContent = (evl.trig_mode_degrees ? "DEG" : "RAD");
    else if (didVars && outEl) outEl.textContent = "";

    render_vars();
  }

  function runNow(){
    try{
      runLines(exprEl.value);
    }catch(e){
      if (evl.auto_mode){
        return;
      }
      outEl.textContent = e && e.message ? e.message : "error";
      render_vars();
    }
  }

  window.evl_run = runNow;

  if (exprEl && outEl){
    autosize();

    exprEl.addEventListener("input", () => {
      autosize();
    });

    exprEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        if (!evl.auto_mode) runNow();
      }
    });
}
})();
