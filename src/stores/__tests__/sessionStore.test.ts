import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    onSshData: vi.fn().mockResolvedValue(() => {}),
    onSshClosed: vi.fn().mockResolvedValue(() => {}),
    sshConnect: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50))),
  },
}));

describe('Auto-Reconnect Backoff Calculation', () => {
  it('calculates exponential backoff delay correctly with cap', () => {
    const getDelayMs = (attempt: number) => Math.min(16000, 1000 * Math.pow(2, attempt - 1));

    expect(getDelayMs(1)).toBe(1000);   // 1s
    expect(getDelayMs(2)).toBe(2000);   // 2s
    expect(getDelayMs(3)).toBe(4000);   // 4s
    expect(getDelayMs(4)).toBe(8000);   // 8s
    expect(getDelayMs(5)).toBe(16000);  // 16s
    expect(getDelayMs(6)).toBe(16000);  // capped at 16s
  });

  it('enforces maximum 5 attempts limit', () => {
    const maxAttempts = 5;
    const shouldRetry = (attempt: number) => attempt <= maxAttempts;

    expect(shouldRetry(1)).toBe(true);
    expect(shouldRetry(5)).toBe(true);
    expect(shouldRetry(6)).toBe(false);
  });
});

describe('Concurrent Connect Deduplication (Issue #33)', () => {
  beforeEach(() => {
    useSessionStore.setState({
      activeSessions: [],
      currentSessionId: null,
      isConnecting: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('deduplicates rapid concurrent connectSession calls to same host target', async () => {
    const target = {
      name: 'Server 1',
      host: '10.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password' as const,
      password: 'test',
    };

    // Rapid double-click simulated
    const [id1, id2] = await Promise.all([
      useSessionStore.getState().connectSession(target),
      useSessionStore.getState().connectSession(target),
    ]);

    expect(id1).toBe(id2);
    expect(useSessionStore.getState().activeSessions.length).toBe(1);
  });
});

describe('Low Memory Pressure Mitigations', () => {
  beforeEach(async () => {
    useSessionStore.setState({
      activeSessions: [
        { id: 'session-active', name: 'Active', host: 'host-1', username: 'user', port: 22, authType: 'password' },
        { id: 'session-inactive-1', name: 'Inactive 1', host: 'host-2', username: 'user', port: 22, authType: 'password' },
        { id: 'session-inactive-2', name: 'Inactive 2', host: 'host-3', username: 'user', port: 22, authType: 'password' },
      ],
      currentSessionId: 'session-active',
      isConnecting: false,
      error: null,
    });
    const { sessionOutputHistory } = await import('../sessionStore');
    sessionOutputHistory.clear();
  });

  it('trims sessionOutputHistory across inactive sessions while retaining active session buffer', async () => {
    const { sessionOutputHistory, trimInactiveSessionHistories } = await import('../sessionStore');

    // Fill buffers: 500 chunks each
    const activeChunks = Array.from({ length: 500 }, (_, i) => `active-${i}`);
    const inactiveChunks1 = Array.from({ length: 500 }, (_, i) => `inactive1-${i}`);
    const inactiveChunks2 = Array.from({ length: 150 }, (_, i) => `inactive2-${i}`);

    sessionOutputHistory.set('session-active', activeChunks);
    sessionOutputHistory.set('session-inactive-1', inactiveChunks1);
    sessionOutputHistory.set('session-inactive-2', inactiveChunks2);

    trimInactiveSessionHistories(200);

    // Active session should remain untouched (500 chunks)
    expect(sessionOutputHistory.get('session-active')?.length).toBe(500);

    // Inactive session with >200 chunks trimmed to latest 200 chunks
    const trimmed1 = sessionOutputHistory.get('session-inactive-1');
    expect(trimmed1?.length).toBe(200);
    expect(trimmed1?.[0]).toBe('inactive1-300');
    expect(trimmed1?.[199]).toBe('inactive1-499');

    // Inactive session with <200 chunks retains its 150 chunks
    expect(sessionOutputHistory.get('session-inactive-2')?.length).toBe(150);
  });

  it('executes registered cleanups and logs warning on handleSystemLowMemory', async () => {
    const { handleSystemLowMemory, registerLowMemoryCleanup, sessionOutputHistory } = await import('../sessionStore');

    sessionOutputHistory.set('session-inactive-1', Array.from({ length: 600 }, (_, i) => `chunk-${i}`));

    const cleanupMock = vi.fn();
    const unregister = registerLowMemoryCleanup(cleanupMock);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    handleSystemLowMemory();

    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(sessionOutputHistory.get('session-inactive-1')?.length).toBe(200);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[ShellFerry] System low memory pressure detected, caches trimmed'
    );

    consoleWarnSpy.mockRestore();
    unregister();
  });
});
