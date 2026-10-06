/**
 * The tokens from `tokens.css` as `var(...)` strings, for the rare value needed in TypeScript
 * (an inline style, a canvas colour). Everything else uses `var(--bl-…)` in a CSS Module.
 */
export const vars = {
  colorPrimary: 'var(--bl-color-primary)',
  colorPrimaryContrast: 'var(--bl-color-primary-contrast)',
  colorDanger: 'var(--bl-color-danger)',
  colorWarning: 'var(--bl-color-warning)',
  colorSurface: 'var(--bl-color-surface)',
  colorSurfaceMuted: 'var(--bl-color-surface-muted)',
  colorBorder: 'var(--bl-color-border)',
  colorText: 'var(--bl-color-text)',
  colorTextMuted: 'var(--bl-color-text-muted)',
  space1: 'var(--bl-space-1)',
  space2: 'var(--bl-space-2)',
  space3: 'var(--bl-space-3)',
  radius: 'var(--bl-radius)',
  font: 'var(--bl-font)',
} as const;
