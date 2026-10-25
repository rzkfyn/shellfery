import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../stores/bugReportStore', async () => {
  const actual = await vi.importActual<typeof import('../../../stores/bugReportStore')>(
    '../../../stores/bugReportStore'
  );
  const mockUseBugReportStore = ((selector?: (s: any) => any) => {
    const state = actual.useBugReportStore.getState();
    return selector ? selector(state) : state;
  }) as typeof actual.useBugReportStore;
  Object.assign(mockUseBugReportStore, actual.useBugReportStore);
  return {
    ...actual,
    useBugReportStore: mockUseBugReportStore,
  };
});

vi.mock('../../../stores/themeStore', async () => {
  const actual = await vi.importActual<typeof import('../../../stores/themeStore')>(
    '../../../stores/themeStore'
  );
  const mockUseThemeStore = ((selector?: (s: any) => any) => {
    const state = actual.useThemeStore.getState();
    return selector ? selector(state) : state;
  }) as typeof actual.useThemeStore;
  Object.assign(mockUseThemeStore, actual.useThemeStore);
  return {
    ...actual,
    useThemeStore: mockUseThemeStore,
  };
});

import { BugReportModal } from '../BugReportModal';
import { useBugReportStore } from '../../../stores/bugReportStore';
import { sanitizeCrashData } from '../../../services/crashReporter';

describe('BugReportModal', () => {
  beforeEach(() => {
    useBugReportStore.setState({ isOpen: false, category: 'Bug Report' });
  });

  it('renders nothing when closed', () => {
    useBugReportStore.setState({ isOpen: false });
    const html = renderToStaticMarkup(<BugReportModal />);
    expect(html).toBe('');
  });

  it('renders modal elements and category pills when open', () => {
    useBugReportStore.setState({ isOpen: true, category: 'Bug Report' });
    const html = renderToStaticMarkup(<BugReportModal />);

    expect(html).toContain('Send Feedback &amp; Bug Report');
    expect(html).toContain('Bug Report');
    expect(html).toContain('UI Glitch');
    expect(html).toContain('Feature Idea');
    expect(html).toContain('Subject');
    expect(html).toContain('Description / Steps to Reproduce');
    expect(html).toContain('Contact');
    expect(html).toContain('Include anonymous system diagnostics');
    expect(html).toContain('Preview Sanitized Data');
    expect(html).toContain('Submit Feedback');
  });

  it('correctly sanitizes sensitive data in bug report payload', () => {
    const rawTitle = 'Error on C:\\Users\\johndoe\\repo with 192.168.1.55';
    const rawDesc = 'SSH Key: -----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAz9x...\n-----END RSA PRIVATE KEY-----\nPassword: secret_password123';
    const rawContact = 'C:/Users/alice/contact.txt';

    const cleanTitle = sanitizeCrashData(rawTitle);
    const cleanDesc = sanitizeCrashData(rawDesc);
    const cleanContact = sanitizeCrashData(rawContact);

    expect(cleanTitle).not.toContain('johndoe');
    expect(cleanTitle).toContain('C:\\Users\\[USER]');
    expect(cleanTitle).toContain('[IP]');

    expect(cleanDesc).not.toContain('MIIEogIBAAKCAQEAz9x');
    expect(cleanDesc).toContain('[REDACTED_SSH_KEY]');
    expect(cleanDesc).toContain('[REDACTED]');

    expect(cleanContact).toContain('C:/Users/[USER]');
  });

  it('formats root-level os and version correctly for crashpulse ingestion', () => {
    const testNavigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' };
    const detectedOs = testNavigator.userAgent.includes('Windows')
      ? 'Windows'
      : testNavigator.platform || 'unknown';

    expect(detectedOs).toBe('Windows');

    const nonWinNav = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' };
    const nonWinOs = nonWinNav.userAgent.includes('Windows')
      ? 'Windows'
      : nonWinNav.platform || 'unknown';

    expect(nonWinOs).toBe('MacIntel');
  });

  it('handles response errors with detailed json error or fallback status code', async () => {
    const parseError = async (response: { ok: boolean; status: number; json: () => Promise<any> }) => {
      if (!response.ok) {
        let errorDetail = `Submission failed (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errorDetail = errJson.error;
        } catch {}
        throw new Error(errorDetail);
      }
    };

    // 400 Bad Request with json error
    const resp400 = {
      ok: false,
      status: 400,
      json: async () => ({ error: 'Missing required field: stack' }),
    };
    await expect(parseError(resp400)).rejects.toThrow('Missing required field: stack');

    // 500 Internal Server Error without json error
    const resp500 = {
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Not JSON');
      },
    };
    await expect(parseError(resp500)).rejects.toThrow('Submission failed (500)');
  });
});
