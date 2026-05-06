# /calc/ — README

Expression evaluator with two numeric modes: **float (Number)** and **BIGINT (BigInt)**.  
Mode is selected automatically per line (unless forced by input/features). No `eval`.

---

## Numeric model

### Float mode (`mode = "float"`)
- Type: JavaScript `Number` (IEEE-754 binary64)
- Literals:
  - integers: `1`
  - decimals: `1.0`, `.25`
  - exponent: `1e3`, `2e-6`, `4E22`
- Constants (always float): `pi`, `e`, `phi`
- Division `/` forces float mode (auto-detect).

### BIGINT mode (`mode = "BIGINT"`)
- Type: JavaScript `BigInt` (integers only)
- Literals:
  - integers only (no `.`); otherwise error: `BigInt number with dot`
- Exponentiation `^` uses integer exponent only (negative exponent error).

### Auto mode selection (per expression)
Auto-detect chooses **float** if any of these are present:
- a decimal point in a literal
- operator `/`
- any of: `pi`, `e`, `phi`
- any of the “float functions” called with `name(` (see list below)

Otherwise it chooses **BIGINT**.

---

## Operators

Binary:
- `+` `-` `*` `/` `%` `^`

Unary:
- `~`  (unary minus; produced from leading `-` or after operator / `(`)
- `!`  (postfix factorial; BIGINT only)

Other:
- `,`  (function argument separator)

Parentheses:
- `(` `)`

---

## Identifiers

### Special
- `ans` — previous answer for the current mode:
  - float: `evl.float_answer`
  - BIGINT: `evl.bigint_answer`

### Constants (case-insensitive)
- `pi`
- `e`
- `phi`

### Variables
- Syntax: `[A-Za-z][A-Za-z0-9_]*`
- Assignment: `name = expression`
- Storage is split by numeric mode:
  - float vars: `evl.float_variables`
  - bigint vars: `evl.bigint_variables`
- Reading cross-mode variables:
  - BIGINT var in float expression → converted to `Number` (must be finite)
  - float var in BIGINT expression → must be finite integer and `|x| <= Number.MAX_SAFE_INTEGER`

### Forbidden variable names
Many names are banned (constants, functions, keywords, UI words). Any banned name throws:
- `Banned variable name: <name>`

---

## Functions

All function names are case-insensitive.

### Float functions
Trig (uses current angle mode for input):
- `sin(x)`
- `cos(x)`
- `tan(x)`
- `tg(x)`
- `ctg(x)`

Inverse trig (returns radians; input is NOT converted by DEG mode):
- `arcsin(x)`  (domain [-1,1])
- `arccos(x)`  (domain [-1,1])
- `arctan(x)`
- `arctg(x)`
- `arcctg(x)` / `arccot(x)`  (undefined for 0)

Logs / roots / abs:
- `ln(x)`
- `lg(x)`
- `sqrt(x)`
- `abs(x)`

Rounding:
- `ceil(x)`
- `floor(x)`
- `round(x)`

Number theory (integerized via `trunc` + `abs` internally):
- `gcd(a,b)`
- `lcm(a,b)`

Special (two-argument):
- `log(base, arg)`  (checks: `arg>0`, `base>0`, `base!=1`)

### BIGINT functions
Unary:
- `abs(x)`
- `sqr(x)`
- `sqrt(x)`  (integer sqrt)
- `fib(n)`
- factorial via postfix: `n!`

Binary:
- `gcd(a,b)`
- `lcm(a,b)`
- `c(n,k)`  (binomial)

Ternary:
- `powmod(a, e, m)`  (requires `e >= 0`, `m != 0`)

---

## Directives (lines starting with `#`)

Mode:
- `#deg`  — set trig input mode to degrees
- `#rad`  — set trig input mode to radians
- `#mode` — prints current trig mode (`DEG` / `RAD`) if no expression result

State:
- `#clear` / `#cls` — clear variables and reset answers (`0`, `0n`)
- `#vars` — refresh variables view (no expression output)

Execution limit:
- `#timeout=<ms>` — set per-evaluation deadline (integer ms). Negative/0 disables deadline.

Repeat macro:
- `#repeat N` — repeat all subsequent lines `N` times
- `#repeat LEN TIMES` — repeat the next `LEN` lines `TIMES` times

---

## Output formatting

- Float:
  - finite numbers printed with small integer snapping (epsilon-based)
  - non-finite printed as `Infinity`, `-Infinity`, `NaN`
- BIGINT:
  - `toString()`

---

## Errors (typical)

- `Unknown character in expression`
- `float .`
- `Mismatched parentheses`
- `Stack underflow - insufficient operands`
- `Undefined variable: <name>`
- `Division by zero`
- `Timeout`
- `Bad directive: #timeout=<ms>`
- `Unknown directive: #...`
- `Unknown function: <name>`
