# Input Layer System - Implementation Notes

## Overview
Started implementing a multi-input layer system inspired by the v0 branch. Simplified scope: each input (camera/video) now only stores crop (normalized rectangle) and flip (horizontal/vertical) metadata. All spatial transforms (position, scale, rotation, opacity) will be applied later when the input is placed as a shape on the canvas.

## Architecture

### Data Structure
Each input source has (current simplified model):
```javascript
{
  id: string,              // Unique identifier
  name: string,            // Display name
  type: 'camera' | 'video', // Source type
  stream: MediaStream,     // Video stream
  crop: {                 // Normalized crop rectangle
    x: number,            // Left (0-1)
    y: number,            // Top (0-1)
    w: number,            // Width (0-1)
    h: number             // Height (0-1)
  },
  flip: {
    horizontal: boolean,  // Flip horizontally
    vertical: boolean     // Flip vertically
  }
}
```

### UI Components (`index.html`)

**Input Panel Structure:**
- Header with add camera/video buttons
- Input source list (similar to shape list in Map panel)
- Empty state prompt
- Detail form with:
  - Name input
  - Type indicator (camera/video)
  - Video preview (16:9 aspect ratio)
  - Crop controls (x, y, w, h normalized 0–1)
  - Flip toggles (horizontal, vertical)
  - Delete button

### Styling (`style.css`)

Added styles for:
- `.input-source-list` - List container matching shape list style
- `.input-empty` - Empty state message
- `.input-detail` - Detail panel
- `.input-preview-wrapper` - 16:9 video preview container
- `.input-preview-video` - Video element styling

### JavaScript Module (`scripts/input/index.js`)

**State Management:**
- `inputs[]` - Array of all input sources
- `activeInputId` - Currently selected input for editing
- `isSyncing` - Flag to prevent feedback loops

**Core Functions:**
- `addCameraInput()` - Request camera access via getUserMedia
- `addVideoInput()` - File picker for video files, creates video element with captureStream()
- `deleteInput()` - Cleanup stream/video and remove from list
- `updateInputMeta()` - Update crop or flip metadata
- `updateUI()` - Re-render list and detail panel
- `syncDetailForm()` - Populate detail form from active input

**Public API:**
```javascript
{
  getInputs(),      // Get all inputs
  getActiveInput(), // Get currently selected input
  dispose()         // Cleanup all streams
}
```

## Integration

- Added to `app.js` alongside other modules (editor, mapping, drawing, mediapipe)
- Receives editor API (though not currently used - ready for future canvas rendering)

## Next Steps

### Rendering Layer (Deferred Transforms)
1. Create canvas rendering system for video inputs
2. When placing input as a shape, apply transform matrix (translate, scale, rotate, opacity)
3. Crop first, then flip, then spatial transform for consistent ordering
4. Support flip via scale(-1,1) or vertical via scale(1,-1) after crop
5. Layer ordering system

### MediaPipe Integration
1. Route each input through its own MediaPipe instance
2. Support multiple simultaneous pose/hand detections
3. Blend/composite multiple landmark sets

### Persistence
1. Add to JSON export (save source type, name, crop, flip)
2. Restore camera inputs on import (request permission)
3. Video inputs: save file path/reference (browser limitations)

### Advanced Features
1. Blend modes (normal, multiply, screen, etc.)
2. Masks/clipping regions
3. Input chaining (use one input's output as mask for another)
4. Real-time effects (blur, saturation, etc.)

## Technical Considerations

**Camera Access:**
- Requires HTTPS or localhost
- User must grant permission
- Permission persists per origin

**Video Files:**
- Uses `captureStream()` - supported in modern browsers
- File URL kept in memory (createObjectURL)
- Video element kept alive but not in DOM

**Performance:**
- Each input requires separate MediaStream
- Multiple MediaPipe instances may be CPU-intensive
- Consider worker threads for processing
- Canvas compositing should be hardware-accelerated

## Design Notes

- Mirrors Map panel UX: list + detail view pattern
- Normalized crop (0–1) simplifies resolution-agnostic composition
- Flip stored separately avoids premature pixel manipulation
- All heavy transforms postponed to canvas composition stage for performance & clarity

This implementation provides the foundation for a flexible multi-input layer system while maintaining the app's existing UX patterns.
