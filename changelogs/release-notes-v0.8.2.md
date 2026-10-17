# ShellFerry v0.8.2 Release Notes

ShellFerry v0.8.2 makes the Default View Mode setting work and lets you set a custom auto-lock timeout.

---

## What's New

### 1. Default View Mode Now Applies
- **Fixed**: The Default View Mode setting (Terminal / Split / SFTP) was saved but never used, so every SSH connection opened in terminal-only view.
- **Behavior**: A newly opened session now starts in the chosen View Mode. Reconnects of an existing session keep the current View Mode.
- The settings label is now "Default View Mode".

### 2. Custom Auto-Lock Timeout
- **Custom Option**: The Auto-Lock on Idle dropdown has a new "Custom…" entry with a minutes input (1-1440, i.e. up to 24 hours). Values outside that range are clamped.
- The 5 / 15 / 30 / 60 minute presets and "Disabled" are unchanged.

### 3. Dev Tooling
- Dev server port moved from 1420 to 5420 to avoid Windows reserved port ranges (Hyper-V/WinNAT).
