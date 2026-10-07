// Platform-owned presentational primitives (D12). Each app bundles its own copy, compiled from source.
// `tokens.css` is imported by each app's root, through `@baseline/ui/tokens.css`.
export { Button, type ButtonProps, type ButtonVariant } from './components/Button/Button';
export { Dialog, type DialogProps } from './components/Dialog/Dialog';
export {
  ErrorBoundary,
  type ErrorBoundaryFallbackProps,
  type ErrorBoundaryProps,
} from './components/ErrorBoundary/ErrorBoundary';
export {
  InlineMessage,
  type InlineMessageProps,
  type InlineMessageTone,
} from './components/InlineMessage/InlineMessage';
export { Spinner } from './components/Spinner/Spinner';
export { PageHeader, type PageHeaderProps } from './components/PageHeader/PageHeader';
export { Select, type SelectProps } from './components/Select/Select';
export {
  Table,
  TableCell,
  TableHeaderCell,
  type TableCellProps,
  type TableHeaderCellProps,
} from './components/Table/Table';
export { TextField, type TextFieldProps } from './components/TextField/TextField';
export { StatusMessage } from './components/StatusMessage/StatusMessage';
export { vars } from './vars';
