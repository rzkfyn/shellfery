import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrivacyConsentModal, PRIVACY_STORAGE_KEY } from '../PrivacyConsentModal';
import { useSettingsStore } from '../../../stores/settingsStore';

describe('PrivacyConsentModal', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, val: string) => {
        localStorageMock[key] = val;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });

    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        sendCrashReports: true,
      },
    });
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(<PrivacyConsentModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders privacy notice, what is collected, and what is never collected when isOpen is true', () => {
    const html = renderToStaticMarkup(<PrivacyConsentModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('Privacy &amp; Diagnostic Telemetry');
    expect(html).toContain('What is collected:');
    expect(html).toContain('What is NEVER collected:');
    expect(html).toContain('SSH keys');
    expect(html).toContain('Allow Diagnostic Reports (Recommended)');
    expect(html).toContain('Disable Diagnostics');
    expect(html).toContain('Settings -&gt; Security &amp; Privacy');
  });

  it('handles allow action: enables crash reporting, sets localStorage, closes modal', () => {
    const onClose = vi.fn();
    const elem = PrivacyConsentModal({ isOpen: true, onClose });
    
    // Find the Allow button's onClick
    const buttons = findButtons(elem);
    const allowBtn = buttons.find((b) =>
      typeof b.props.children === 'string' && b.props.children.includes('Allow Diagnostic Reports')
    );
    expect(allowBtn).toBeDefined();

    allowBtn.props.onClick();

    expect(useSettingsStore.getState().settings.sendCrashReports).toBe(true);
    expect(localStorageMock[PRIVACY_STORAGE_KEY]).toBe('acknowledged');
    expect(onClose).toHaveBeenCalled();
  });

  it('handles disable action: disables crash reporting, sets localStorage, closes modal', () => {
    const onClose = vi.fn();
    const elem = PrivacyConsentModal({ isOpen: true, onClose });

    const buttons = findButtons(elem);
    const disableBtn = buttons.find((b) =>
      typeof b.props.children === 'string' && b.props.children.includes('Disable Diagnostics')
    );
    expect(disableBtn).toBeDefined();

    disableBtn.props.onClick();

    expect(useSettingsStore.getState().settings.sendCrashReports).toBe(false);
    expect(localStorageMock[PRIVACY_STORAGE_KEY]).toBe('acknowledged');
    expect(onClose).toHaveBeenCalled();
  });
});

function findButtons(node: any): any[] {
  const result: any[] = [];
  if (!node || typeof node !== 'object') return result;
  if (node.type === 'button') {
    result.push(node);
  }
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children.flat(Infinity)
      : [node.props.children];
    for (const child of children) {
      result.push(...findButtons(child));
    }
  }
  return result;
}
