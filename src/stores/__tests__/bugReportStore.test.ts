import { describe, it, expect, beforeEach } from 'vitest';
import { useBugReportStore } from '../bugReportStore';

describe('useBugReportStore', () => {
  beforeEach(() => {
    useBugReportStore.setState({ isOpen: false, category: 'Bug Report' });
  });

  it('initializes with default closed state and Bug Report category', () => {
    const state = useBugReportStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.category).toBe('Bug Report');
  });

  it('opens bug report with default category', () => {
    useBugReportStore.getState().openBugReport();
    expect(useBugReportStore.getState().isOpen).toBe(true);
    expect(useBugReportStore.getState().category).toBe('Bug Report');
  });

  it('opens bug report with specified category', () => {
    useBugReportStore.getState().openBugReport('UI Glitch');
    expect(useBugReportStore.getState().isOpen).toBe(true);
    expect(useBugReportStore.getState().category).toBe('UI Glitch');

    useBugReportStore.getState().openBugReport('Feature Idea');
    expect(useBugReportStore.getState().isOpen).toBe(true);
    expect(useBugReportStore.getState().category).toBe('Feature Idea');
  });

  it('closes bug report modal', () => {
    useBugReportStore.getState().openBugReport();
    expect(useBugReportStore.getState().isOpen).toBe(true);

    useBugReportStore.getState().closeBugReport();
    expect(useBugReportStore.getState().isOpen).toBe(false);
  });
});
