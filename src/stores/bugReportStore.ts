import { create } from 'zustand';

export type FeedbackCategory = 'Bug Report' | 'UI Glitch' | 'Feature Idea';

interface BugReportState {
  isOpen: boolean;
  category: FeedbackCategory;
  openBugReport: (category?: FeedbackCategory) => void;
  closeBugReport: () => void;
}

export const useBugReportStore = create<BugReportState>((set) => ({
  isOpen: false,
  category: 'Bug Report',
  openBugReport: (category = 'Bug Report') => set({ isOpen: true, category }),
  closeBugReport: () => set({ isOpen: false }),
}));
