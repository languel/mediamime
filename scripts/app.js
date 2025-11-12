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
    { initLayers },
    { initLayout }
  ] = await Promise.all([
    import("./editor/index.js"),
    import("./mediapipe/index.js"),
    import("./mapping/index.js"),
    import("./drawing/index.js"),
    import("./input/index.js"),
    import("./layers/index.js"),
    import("./ui/layout.js")
  ]);

  const layoutApi = initLayout();
  const editorApi = initEditor({ root, svg, toolbar });

  // The downstream modules receive the editor API so they can subscribe to
  // shape/selection changes once they are ported into this modular architecture.
  const inputApi = initInput({ editor: editorApi });
  const layersApi = initLayers({ editor: editorApi }); // Initialize layers before mapping so streams are available
  initMediaPipeline({ editor: editorApi });
  const mappingApi = initMapping({ editor: editorApi });
  initDrawing({ editor: editorApi });

  // Set up reset to default score functionality
  window.addEventListener('mediamime:clear-all', async () => {
    console.log('[mediamime] Resetting to default score...');
    
    // 1. Reset panel positions
    if (layoutApi && typeof layoutApi.resetLayout === 'function') {
      layoutApi.resetLayout();
    }
    
    // 2. Clear existing inputs and streams
    if (inputApi && typeof inputApi.clearAll === 'function') {
      inputApi.clearAll();
    }
    if (layersApi && typeof layersApi.clearAll === 'function') {
      layersApi.clearAll();
    }
    
    // 3. Create default camera input (flipped horizontally)
    if (inputApi && typeof inputApi.addCameraInput === 'function') {
      const cameraInput = await inputApi.addCameraInput({ 
        persist: true, 
        setActive: true,
        flip: { horizontal: true, vertical: false }
      });
      
      if (cameraInput && layersApi && typeof layersApi.createStream === 'function') {
        // 4. Create default stream mapped to pose
        const stream = layersApi.createStream({
          name: 'Pose',
          process: 'pose',
          source: cameraInput.id,
          enabled: true
        });
        
        if (stream && mappingApi && typeof mappingApi.createDefaultShape === 'function') {
          // 5. Create default rectangle shape with C60 note on enter/exit
          mappingApi.createDefaultShape(stream.id);
        }
      }
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init().catch((error) => {
    console.error("[mediamime] Failed to initialise application modules.", error);
  });
}
