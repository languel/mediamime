const PLACEHOLDER_HTML = `
  <div class="editor-placeholder__inner">
    <h2>Preview placeholder</h2>
    <p>The camera/preview pipeline has not been wired up yet.</p>
    <p>Use the toolbar to create shapes; the new SVG editor is active.</p>
  </div>
`;

export function initDrawing({ editor }) {
  const container = document.getElementById("mediamime-sketch");
  let placeholder = null;
  if (container) {
    placeholder = document.createElement("div");
    placeholder.className = "editor-placeholder";
    placeholder.innerHTML = PLACEHOLDER_HTML;
    container.replaceChildren(placeholder);
  }

  console.info("[mediamime] Drawing/preview module initialised (stub).");
  return {
    dispose() {
      if (placeholder?.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      console.info("[mediamime] Drawing/preview module disposed.");
    }
  };
}
