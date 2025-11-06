const init = async () => {
  const root = document.getElementById("gesture-editor");
  const svg = document.getElementById("gesture-svg");
  const toolbar = document.getElementById("gesture-toolbar");

  if (!root || !svg || !toolbar) {
    console.warn("[mediamime] Editor scaffolding missing – skipping editor boot.");
    return;
  }

  const [
    { initEditor },
    { initMediaPipeline },
    { initMapping },
    { initDrawing },
    { initInput },
    { initLayout }
  ] = await Promise.all([
    import("./editor/index.js"),
    import("./mediapipe/index.js"),
    import("./mapping/index.js"),
    import("./drawing/index.js"),
    import("./input/index.js"),
    import("./ui/layout.js")
  ]);

  initLayout();
  const editorApi = initEditor({ root, svg, toolbar });

  // The downstream modules receive the editor API so they can subscribe to
  // shape/selection changes once they are ported into this modular architecture.
  initMediaPipeline({ editor: editorApi });
  initMapping({ editor: editorApi });
  initDrawing({ editor: editorApi });
  initInput({ editor: editorApi });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init().catch((error) => {
    console.error("[mediamime] Failed to initialise application modules.", error);
  });
}
