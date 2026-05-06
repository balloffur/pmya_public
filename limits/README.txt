This patch adds:
- input mode split: numeric input continues existing fit behavior
- type-query mode for inputs like int, double, integer, uint
- new info.js module
- new ./typeinfo/*.json datasets by language

Notes:
- C/C++ target-specific width notes use target ids from the existing limits config if they match lp64 / llp64 / ilp32.
- Go target-specific width notes use go32 / go64.
- Rust target-specific width notes use rust32 / rust64.
- If your actual target ids differ, just rename keys in typeinfo JSON.
