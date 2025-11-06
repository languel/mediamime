# Input Layer System - Implementation Notes

## Overview
Started implementing a multi-input layer system inspired by the v0 branch, where each input (camera/video) is treated as a transformed rectangle with position, scale, rotation, and opacity controls.

## Architecture

### Data Structure
Each input source has:
```javascript
{
  id: string,              // Unique identifier
  name: string,            // Display name
  type: 'camera' | 'video', // Source type
  stream: MediaStream,     // Video stream
  transform: {
    x: number,            // Position X (normalized 0-1)
    y: number,            // Position Y (normalized 0-1)
    width: number,        // Scale width
    height: number,       // Scale height
    rotation: number,     // Rotation in degrees
    opacity: number,      // Opacity 0-1
    mirror: boolean       // Mirror/flip horizontally
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
  - Transform controls (x, y, width, height, rotation)
  - Opacity slider
  - Mirror toggle
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
- `updateInputTransform()` - Update transform properties
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

### Rendering Layer
1. Create canvas rendering system for video inputs
2. Apply transform matrix (translate, scale, rotate)
3. Apply opacity via globalAlpha
4. Support mirror/flip via scale(-1, 1)
5. Layer ordering system

### MediaPipe Integration
1. Route each input through its own MediaPipe instance
2. Support multiple simultaneous pose/hand detections
3. Blend/composite multiple landmark sets

### Persistence
1. Add to JSON export (save source type, name, transform)
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
- Transform controls use normalized coordinates (0-1) for consistency with drawing system
- Preview helps users verify camera/video before adding to main canvas
- Opacity/mirror controls match existing patterns in app

This implementation provides the foundation for a flexible multi-input layer system while maintaining the app's existing UX patterns.
