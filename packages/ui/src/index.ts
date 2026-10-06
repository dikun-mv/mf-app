// Platform-owned presentational primitives (D12). Each app bundles its own copy, compiled from source.
// `tokens.css` is imported by each app's root, through `@baseline/ui/tokens.css`.
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { ErrorBoundary, type ErrorBoundaryFallbackProps, type ErrorBoundaryProps } from './ErrorBoundary';
export { InlineMessage, type InlineMessageProps, type InlineMessageTone } from './InlineMessage';
export { Spinner } from './Spinner';
export { vars } from './vars';
