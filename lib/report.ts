// Reasons a participant can choose when reporting a match (same list as the reports table check).
export const REPORT_REASONS = ['harassment', 'sexual', 'threat', 'spam', 'fake', 'unsafe', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const MAX_REPORT_DETAILS = 1000;
