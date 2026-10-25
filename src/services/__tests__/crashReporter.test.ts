import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeCrashData,
  sanitizeObject,
  reportCrash,
  clearReportCache,
  CRASHPULSE_ENDPOINT,
  DEFAULT_PROJECT_KEY,
} from '../crashReporter';
import { useSettingsStore } from '../../stores/settingsStore';

describe('crashReporter', () => {
  beforeEach(() => {
    clearReportCache();
    useSettingsStore.getState().resetSettings();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearReportCache();
  });

  describe('sanitizeCrashData', () => {
    it('sanitizes Windows user paths', () => {
      const input = 'Error in C:\\Users\\Alice.Smith_01\\AppData\\Local\\ShellFerry\\app.log';
      const output = sanitizeCrashData(input);
      expect(output).toBe('Error in C:\\Users\\[USER]\\AppData\\Local\\ShellFerry\\app.log');
    });

    it('sanitizes escaped Windows user paths', () => {
      const input = '{"file":"C:\\\\Users\\\\Bob_123\\\\Projects\\\\main.ts"}';
      const output = sanitizeCrashData(input);
      expect(output).toBe('{"file":"C:\\\\Users\\\\[USER]\\\\Projects\\\\main.ts"}');
    });

    it('sanitizes Unix user paths', () => {
      const input = 'Failed at /home/charlie-dev/projects/openterm/src/main.rs';
      const output = sanitizeCrashData(input);
      expect(output).toBe('Failed at /home/[USER]/projects/openterm/src/main.rs');
    });

    it('sanitizes macOS user paths', () => {
      const input = 'Failed at /Users/david/Library/Application Support/ShellFerry';
      const output = sanitizeCrashData(input);
      expect(output).toBe('Failed at /Users/[USER]/Library/Application Support/ShellFerry');
    });

    it('strips SSH private key blocks and headers', () => {
      const keyBlock =
        'Error loading key:\n-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\n-----END OPENSSH PRIVATE KEY-----\nConnection aborted';
      const output = sanitizeCrashData(keyBlock);
      expect(output).toBe('Error loading key:\n[REDACTED_SSH_KEY]\nConnection aborted');
      expect(output).not.toContain('b3BlbnNza');

      const standaloneHeader = 'Key header: -----BEGIN RSA PRIVATE KEY-----';
      expect(sanitizeCrashData(standaloneHeader)).toBe('Key header: [REDACTED_SSH_KEY]');
    });

    it('strips passwords, secrets, and bearer tokens', () => {
      const input = 'Auth failed for user admin: password="SuperSecretPassword!" token=abc-xyz-123';
      const output = sanitizeCrashData(input);
      expect(output).toContain('password="[REDACTED]"');
      expect(output).toContain('token=[REDACTED]');
      expect(output).not.toContain('SuperSecretPassword!');
      expect(output).not.toContain('abc-xyz-123');

      const bearerInput = 'Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.sig';
      const bearerOutput = sanitizeCrashData(bearerInput);
      expect(bearerOutput).toBe('Headers: Authorization: Bearer [REDACTED]');
    });

    it('strips IPv4 addresses without altering semantic versions', () => {
      const input = 'Failed to connect to 192.168.1.42:22 on version 0.8.2';
      const output = sanitizeCrashData(input);
      expect(output).toBe('Failed to connect to [IP]:22 on version 0.8.2');
    });

    it('strips IPv6 addresses', () => {
      const input = 'Connection timeout to 2001:0db8:85a3:0000:0000:8a2e:0370:7334:22';
      const output = sanitizeCrashData(input);
      expect(output).toBe('Connection timeout to [IP]:22');
    });
  });

  describe('sanitizeObject', () => {
    it('recursively sanitizes nested metadata', () => {
      const raw = {
        meta: {
          path: 'C:\\Users\\JohnDoe\\config.json',
          ip: '10.0.0.1',
        },
        tags: ['/home/alice/script.sh', 'normal-tag'],
      };
      const sanitized = sanitizeObject(raw) as typeof raw;
      expect(sanitized.meta.path).toBe('C:\\Users\\[USER]\\config.json');
      expect(sanitized.meta.ip).toBe('[IP]');
      expect(sanitized.tags[0]).toBe('/home/[USER]/script.sh');
      expect(sanitized.tags[1]).toBe('normal-tag');
    });
  });

  describe('reportCrash', () => {
    it('dispatches report via fetch with keepalive and project key header', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

      const success = reportCrash({
        message: 'Something crashed at C:\\Users\\Alice\\app.js',
        level: 'error',
      });

      expect(success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(CRASHPULSE_ENDPOINT);
      expect(requestInit.keepalive).toBe(true);
      expect(requestInit.method).toBe('POST');
      expect((requestInit.headers as Record<string, string>)['X-Project-Key']).toBe(DEFAULT_PROJECT_KEY);

      const parsedBody = JSON.parse(requestInit.body as string);
      expect(parsedBody.message).toBe('Something crashed at C:\\Users\\[USER]\\app.js');
      expect(parsedBody.level).toBe('error');
    });

    it('deduplicates identical errors within 60 seconds', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

      const first = reportCrash({ message: 'Repeated error message', level: 'error' });
      expect(first).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second identical error immediately after
      const second = reportCrash({ message: 'Repeated error message', level: 'error' });
      expect(second).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('respects sendCrashReports user setting opt-out', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

      // Disable crash reporting
      useSettingsStore.getState().updateSetting('sendCrashReports', false);

      const success = reportCrash({ message: 'Error while opted out', level: 'error' });
      expect(success).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
