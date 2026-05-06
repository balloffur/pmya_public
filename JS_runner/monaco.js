// monaco.js
(() => {
  const CDN_VS = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs";

  window.MonacoEnvironment = {
    getWorkerUrl: function () {
      const proxy = `
        self.MonacoEnvironment = { baseUrl: "${CDN_VS}/" };
        importScripts("${CDN_VS}/base/worker/workerMain.js");
      `;
      return URL.createObjectURL(new Blob([proxy], { type: "text/javascript" }));
    }
  };

  require.config({ paths: { "vs": CDN_VS } });

  function defineRunnerThemes() {
    monaco.editor.defineTheme("runnerLight", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "4b5563", fontStyle: "italic" },
        { token: "comment.doc", foreground: "4b5563", fontStyle: "italic" },
        { token: "keyword", foreground: "1e40af", fontStyle: "bold" },
        { token: "keyword.operator", foreground: "111827" },
        { token: "identifier", foreground: "0f172a" },
        { token: "type.identifier", foreground: "115e59" },
        { token: "function", foreground: "5b21b6" },
        { token: "method", foreground: "5b21b6" },
        { token: "string", foreground: "064e3b" },
        { token: "string.escape", foreground: "0f766e" },
        { token: "number", foreground: "92400e" },
        { token: "regexp", foreground: "86198f" },
        { token: "constant", foreground: "7f1d1d" },
        { token: "delimiter", foreground: "0f172a" },
        { token: "delimiter.bracket", foreground: "0f172a" },
        { token: "operator", foreground: "0f172a" },
      ],
      colors: {
        "editor.background": "#f3f4f6",
        "editor.foreground": "#0f172a",
        "editorCursor.foreground": "#0f172a",
        "editor.selectionBackground": "#6b728033",
        "editor.inactiveSelectionBackground": "#6b728022",
        "editor.selectionHighlightBackground": "#6b72801c",
        "editor.lineHighlightBackground": "#00000010",
        "editor.lineHighlightBorder": "#00000000",
        "editor.rangeHighlightBackground": "#00000018",
        "editor.findMatchBackground": "#d9770655",
        "editor.findMatchHighlightBackground": "#d9770633",
        "editor.findRangeHighlightBackground": "#d9770622",
        "editorLink.activeForeground": "#1e40af",
        "editorLineNumber.foreground": "#374151",
        "editorLineNumber.activeForeground": "#111827",
        "editorGutter.background": "#f3f4f6",
        "editorIndentGuide.background1": "#00000022",
        "editorIndentGuide.activeBackground1": "#0000003a",
        "editorWhitespace.foreground": "#0000002a",
        "editorBracketMatch.background": "#6b728033",
        "editorBracketMatch.border": "#6b728088",
        "scrollbarSlider.background": "#00000026",
        "scrollbarSlider.hoverBackground": "#00000033",
        "scrollbarSlider.activeBackground": "#00000044",
        "editorWidget.background": "#e5e7eb",
        "editorWidget.border": "#9ca3af",
        "editorHoverWidget.background": "#e5e7eb",
        "editorHoverWidget.border": "#9ca3af",
        "editorSuggestWidget.background": "#e5e7eb",
        "editorSuggestWidget.border": "#9ca3af",
        "editorSuggestWidget.selectedBackground": "#6b728033",
        "peekView.border": "#9ca3af",
        "peekViewEditor.background": "#f3f4f6",
        "peekViewResult.background": "#e5e7eb",
        "peekViewTitle.background": "#e5e7eb",
        "editorError.foreground": "#7f1d1d",
        "editorWarning.foreground": "#92400e",
        "editorInfo.foreground": "#1e40af",
      }
    });

    monaco.editor.defineTheme("runnerDark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
        { token: "comment.doc", foreground: "94a3b8", fontStyle: "italic" },
        { token: "keyword", foreground: "93c5fd", fontStyle: "bold" },
        { token: "keyword.operator", foreground: "e5e7eb" },
        { token: "identifier", foreground: "f3f4f6" },
        { token: "type.identifier", foreground: "99f6e4" },
        { token: "function", foreground: "d8b4fe" },
        { token: "method", foreground: "d8b4fe" },
        { token: "string", foreground: "86efac" },
        { token: "string.escape", foreground: "5eead4" },
        { token: "number", foreground: "fdba74" },
        { token: "regexp", foreground: "f0abfc" },
        { token: "constant", foreground: "fca5a5" },
        { token: "delimiter", foreground: "f3f4f6" },
        { token: "delimiter.bracket", foreground: "f3f4f6" },
        { token: "operator", foreground: "f3f4f6" },
      ],
      colors: {
        "editor.background": "#1f2937",
        "editor.foreground": "#f3f4f6",
        "editorCursor.foreground": "#f9fafb",
        "editor.selectionBackground": "#94a3b833",
        "editor.inactiveSelectionBackground": "#94a3b822",
        "editor.selectionHighlightBackground": "#94a3b81a",
        "editor.lineHighlightBackground": "#ffffff10",
        "editor.lineHighlightBorder": "#00000000",
        "editor.rangeHighlightBackground": "#ffffff12",
        "editor.findMatchBackground": "#f59e0b55",
        "editor.findMatchHighlightBackground": "#f59e0b33",
        "editor.findRangeHighlightBackground": "#f59e0b22",
        "editorLink.activeForeground": "#93c5fd",
        "editorLineNumber.foreground": "#9ca3af",
        "editorLineNumber.activeForeground": "#f3f4f6",
        "editorGutter.background": "#1f2937",
        "editorIndentGuide.background1": "#ffffff24",
        "editorIndentGuide.activeBackground1": "#ffffff44",
        "editorWhitespace.foreground": "#ffffff2a",
        "editorBracketMatch.background": "#94a3b833",
        "editorBracketMatch.border": "#94a3b888",
        "scrollbarSlider.background": "#ffffff24",
        "scrollbarSlider.hoverBackground": "#ffffff33",
        "scrollbarSlider.activeBackground": "#ffffff44",
        "editorWidget.background": "#111827",
        "editorWidget.border": "#374151",
        "editorHoverWidget.background": "#111827",
        "editorHoverWidget.border": "#374151",
        "editorSuggestWidget.background": "#111827",
        "editorSuggestWidget.border": "#374151",
        "editorSuggestWidget.selectedBackground": "#1f2937",
        "peekView.border": "#374151",
        "peekViewEditor.background": "#1f2937",
        "peekViewResult.background": "#111827",
        "peekViewTitle.background": "#111827",
        "editorError.foreground": "#fca5a5",
        "editorWarning.foreground": "#fdba74",
        "editorInfo.foreground": "#93c5fd",
      }
    });
  }

  function getThemeName() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "runnerDark" : "runnerLight";
  }

  window.initMonaco = function initMonaco(opts) {
    const element = opts && opts.element;
    const initialValue = (opts && typeof opts.initialValue === "string") ? opts.initialValue : "";
    const onReady = opts && typeof opts.onReady === "function" ? opts.onReady : null;

    if (!element) throw new Error("initMonaco: opts.element is required");

    require(["vs/editor/editor.main"], () => {
      defineRunnerThemes();
      monaco.editor.setTheme(getThemeName());

      const editor = monaco.editor.create(element, {
        value: initialValue,
        language: "javascript",
        theme: getThemeName(),
        automaticLayout: true,
        minimap: { enabled: false },
        fontLigatures: false,
        scrollBeyondLastLine: false,
        fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Courier New",monospace',
      });

      window.addEventListener("pmya-theme-change", () => {
        monaco.editor.setTheme(getThemeName());
      });

      if (onReady) onReady(editor);
    });
  };
})();
