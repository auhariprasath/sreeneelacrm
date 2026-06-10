// Theme color picker disabled — the app uses one fixed premium theme
// defined in src/styles.css. Exports kept as no-ops so existing imports
// in the app shell continue to work without rendering a swatch picker.

export function applyStoredThemeColor() {
  // intentionally a no-op
}

export function ThemeColorPicker() {
  return null;
}
