/**
 * The tokens from `tokens.css` as `var(...)` strings, for the rare value needed in TypeScript
 * (an inline style, a canvas colour). Everything else uses `var(--bl-…)` in a CSS Module.
 */
export const vars = {
  colorPrimary: 'var(--bl-color-primary)',
  colorPrimaryContrast: 'var(--bl-color-primary-contrast)',
  colorInfo: 'var(--bl-color-info)',
  colorDanger: 'var(--bl-color-danger)',
  colorWarning: 'var(--bl-color-warning)',
  colorSuccess: 'var(--bl-color-success)',
  colorSurface: 'var(--bl-color-surface)',
  colorSurfaceMuted: 'var(--bl-color-surface-muted)',
  colorSurfaceSunken: 'var(--bl-color-surface-sunken)',
  colorBorder: 'var(--bl-color-border)',
  colorBorderStrong: 'var(--bl-color-border-strong)',
  colorText: 'var(--bl-color-text)',
  colorTextMuted: 'var(--bl-color-text-muted)',
  space1: 'var(--bl-space-1)',
  space2: 'var(--bl-space-2)',
  space3: 'var(--bl-space-3)',
  space4: 'var(--bl-space-4)',
  space5: 'var(--bl-space-5)',
  radius: 'var(--bl-radius)',
  radiusLg: 'var(--bl-radius-lg)',
  font: 'var(--bl-font)',
} as const;
