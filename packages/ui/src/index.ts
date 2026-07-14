// @fundi/ui — shared design-system components (Sprint 1, US-002).
// Import the token stylesheet once per app:  import '@fundi/ui/styles.css';

export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { Badge } from './components/Badge';
export type { BadgeProps } from './components/Badge';

export { Tag } from './components/Tag';
export type { TagProps } from './components/Tag';

export { Tabs } from './components/Tabs';
export type { TabsProps, TabItem } from './components/Tabs';

export { Modal } from './components/Modal';
export type { ModalProps } from './components/Modal';

export { Drawer } from './components/Drawer';
export type { DrawerProps } from './components/Drawer';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

export { OfflineBanner } from './components/OfflineBanner';
export type { OfflineBannerProps } from './components/OfflineBanner';

// Shared primitives
export { Spinner } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';

export { ProgressBar } from './components/ProgressBar';
export type { ProgressBarProps } from './components/ProgressBar';

export { AvatarInitial } from './components/AvatarInitial';
export type { AvatarInitialProps } from './components/AvatarInitial';

export { RelativeTime } from './components/RelativeTime';
export type { RelativeTimeProps } from './components/RelativeTime';

export { Fab } from './components/Fab';
export type { FabProps } from './components/Fab';

// Shared utilities
export { SIGNAL_META, FALLBACK_SIGNAL_META, getSignalMeta } from './signal-meta';
export type { SignalMeta } from './signal-meta';

export { formatRelativeTime } from './lib/relative-time';
export type { RelativeTimeInput } from './lib/relative-time';
export { initials } from './lib/initials';

export { useBreakpoint, BREAKPOINTS } from './lib/use-breakpoint';
export type { Breakpoint } from './lib/use-breakpoint';

export { usePrefersReducedMotion } from './lib/use-reduced-motion';

// Modules — reusable feature compositions (see ADR-ENG-0001)
export { MessageComposer } from './modules/MessageComposer';
export type { MessageComposerProps } from './modules/MessageComposer';

export { OtpInput } from './modules/OtpInput';
export type { OtpInputProps } from './modules/OtpInput';

export { AuthFlow } from './modules/AuthFlow';
export type { AuthFlowProps } from './modules/AuthFlow';

export { PhoneInput, DEFAULT_PHONE_REGION, DEFAULT_DIAL_CODE } from './modules/PhoneInput';
export type { PhoneInputProps } from './modules/PhoneInput';

// Creator triage queue ("Needs You")
export { SignalBadge } from './modules/SignalBadge';
export type { SignalBadgeProps } from './modules/SignalBadge';

export { ExceptionCard } from './modules/ExceptionCard';
export type { ExceptionCardProps } from './modules/ExceptionCard';

export { ExceptionTableRow, EXCEPTION_ROW_COLUMNS } from './modules/ExceptionTableRow';
export type { ExceptionTableRowProps } from './modules/ExceptionTableRow';

export { SnoozePicker } from './modules/SnoozePicker';
export type { SnoozePickerProps } from './modules/SnoozePicker';

export { ActionSheet } from './modules/ActionSheet';
export type { ActionSheetProps } from './modules/ActionSheet';

export { FilterTagRow } from './modules/FilterTagRow';
export type { FilterTagRowProps, FilterTagOption } from './modules/FilterTagRow';

export { SortToggle } from './modules/SortToggle';
export type { SortToggleProps } from './modules/SortToggle';

export { FilterSortBar } from './modules/FilterSortBar';
export type { FilterSortBarProps } from './modules/FilterSortBar';

// Enrollment & cohort management
export { ENROLLMENT_META, FALLBACK_ENROLLMENT_META, getEnrollmentMeta } from './enrollment-meta';
export type { EnrollmentMeta } from './enrollment-meta';

export { EnrollmentBadge } from './modules/EnrollmentBadge';
export type { EnrollmentBadgeProps } from './modules/EnrollmentBadge';

export { PendingInviteRow } from './modules/PendingInviteRow';
export type { PendingInviteRowProps } from './modules/PendingInviteRow';

export { CohortTab } from './modules/CohortTab';
export type { CohortTabProps } from './modules/CohortTab';

export { RosterRow, ROSTER_ROW_COLUMNS } from './modules/RosterRow';
export type { RosterRowProps } from './modules/RosterRow';

export { InviteApprove } from './modules/InviteApprove';
export type { InviteApproveProps, PendingInvite } from './modules/InviteApprove';

export { CohortRoster } from './modules/CohortRoster';
export type { CohortRosterProps, Cohort, CohortRosterLearner } from './modules/CohortRoster';

// AI draft review
export { DraftCard } from './modules/DraftCard';
export type { DraftCardProps } from './modules/DraftCard';

export { VariableChip } from './modules/VariableChip';
export type { VariableChipProps } from './modules/VariableChip';

export { AuditRow } from './modules/AuditRow';
export type { AuditRowProps, AuditAction } from './modules/AuditRow';

export { DraftQueue } from './modules/DraftQueue';
export type { DraftQueueProps, Draft } from './modules/DraftQueue';

export { DraftEditor } from './modules/DraftEditor';
export type { DraftEditorProps, EditableDraft } from './modules/DraftEditor';

export { AuditTrail } from './modules/AuditTrail';
export type { AuditTrailProps, AuditEntry } from './modules/AuditTrail';
