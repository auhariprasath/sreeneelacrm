## Problem
Dragging an image file from the desktop onto the photo gallery causes Chrome to open it in a new tab instead of uploading. Current drag handlers only support reordering existing photos, not file drops from the OS.

## Fix
Update `src/components/settings/photo-gallery-section.tsx` to also accept external file drops:

1. **Wrap the grid in a drop zone** — add `onDragOver` (preventDefault) and `onDrop` handlers on the container so the browser doesn't open the dropped file.
2. **Detect external files vs internal reorder** — in `onDrop`, check `e.dataTransfer.files`. If files are present, upload them; otherwise fall back to existing reorder logic.
3. **Multi-file upload loop** — iterate dropped files, skip non-images, respect the `MAX = 10` limit, and call the existing `upload()` flow sequentially so each one persists.
4. **Visual feedback** — add an `isDraggingFile` state highlighting the whole grid (dashed ring) while a file is hovered over it; clear on dragleave/drop.
5. **Keep existing behavior** — reorder via the per-photo drag handles still works; "Add photo" button still works.

No backend or schema changes.
