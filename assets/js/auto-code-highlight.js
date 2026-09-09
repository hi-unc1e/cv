(() => {
  const plainLanguages = new Set(["", "text", "plaintext", "plain"]);
  const tokenPattern = /(#.*$|\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|else|elif|return|require|and|or|not|in|for|while|is|has|contains|from|import|true|false|null|none)\b|\b[A-Z][A-Z0-9_]{2,}\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()|[=<>!]=?|->|[+*/%()-]|[{}[\],:])/gm;

  const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const tokenClass = (token) => {
    if (/^(#|\/\/)/.test(token)) return "comment";
    if (/^["']/.test(token)) return "string";
    if (/^(if|else|elif|return|require|and|or|not|in|for|while|is|has|contains|from|import|true|false|null|none)$/.test(token)) return "keyword";
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(token)) return "constant";
    if (/^\d/.test(token)) return "number";
    if (/^[A-Za-z_]/.test(token)) return "function";
    return "operator";
  };

  const highlight = (code) => {
    if (code.dataset.autoHighlighted === "true" || code.querySelector("[class^=chroma-]")) return;
    const language = [...code.classList]
      .find((name) => name.startsWith("language-"))
      ?.slice("language-".length) ?? "";
    if (!plainLanguages.has(language)) return;

    const source = code.textContent;
    let cursor = 0;
    let html = "";
    for (const match of source.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index ?? 0;
      html += escapeHtml(source.slice(cursor, index));
      html += `<span class="auto-hl-${tokenClass(token)}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    code.innerHTML = html + escapeHtml(source.slice(cursor));
    code.classList.add("auto-highlighted");
    code.dataset.autoHighlighted = "true";
  };

  const run = () => document.querySelectorAll("pre > code").forEach(highlight);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
