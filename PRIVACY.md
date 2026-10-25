# ShellFerry Privacy Policy & Diagnostic Notice

ShellFerry is designed with a **privacy-first, zero-knowledge architecture**. We believe terminal tools and SSH clients should never collect personal information, host credentials, or user communication data.

---

## 1. Principles

1. **No Accounts Required**: ShellFerry runs locally on your machine without requiring account registration, cloud sign-ins, or telemetry trackers.
2. **Local Credential Storage**: All SSH keys, passwords, and connection configurations are stored exclusively on your device, protected by AES-256-GCM encryption with PBKDF2 key derivation and platform biometric security (Windows Hello, Touch ID, Linux Secret Service).
3. **Zero-Knowledge Sanitization**: All error reports and diagnostic telemetry undergo local client-side redaction before any packet touches the network.

---

## 2. Diagnostic Telemetry & Crash Reporting

ShellFerry includes an optional diagnostic reporting mechanism powered by CrashPulse (`crashpulse.darktama.dev`). This helps the development team discover regressions, uncaught exceptions, and UI rendering issues across different operating systems.

### What is Collected (When Enabled)
- **Error Messages & Stack Traces**: Component hierarchy and JavaScript/Rust stack traces where an exception occurred.
- **Application Version**: e.g., `0.8.2`.
- **Operating System & Architecture**: Platform family (e.g., Windows, macOS, Linux) and user agent string.
- **Timestamp**: Time of incident.

### What is NEVER Collected
- **SSH Private Keys & Certificates**: Completely stripped via client-side regex filters.
- **Passwords & Passphrases**: Redacted to `[REDACTED]`.
- **IP Addresses**: IPv4 and IPv6 addresses are scrubbed and replaced with `[IP]`.
- **Terminal Commands & Session Data**: Terminal buffer contents, keystrokes, and shell history are never captured.
- **Local Usernames & File Paths**: Windows paths (`C:\Users\<username>`), macOS paths (`/Users/<username>`), and Linux paths (`/home/<username>`) are automatically sanitized to `C:\Users\[USER]`, `/Users/[USER]`, and `/home/[USER]`.
- **Authentication Tokens**: Bearer tokens, Basic authorization strings, and API secret keys are scrubbed.

---

## 3. Client-Side Sanitization Implementation

Before diagnostic payloads leave your machine, the `sanitizeCrashData` pipeline automatically inspects and cleans every payload string:

```
[Raw Error/Input]
       │
       ▼
[Strip SSH Private Key Blocks]      (-----BEGIN ... KEY-----)
       │
       ▼
[Strip Windows / Unix User Paths]   (C:\Users\*, /home/*, /Users/* -> [USER])
       │
       ▼
[Scrub Passwords, Tokens & Secrets] (pwd, secret, api_key -> [REDACTED])
       │
       ▼
[Scrub IP Addresses]                (IPv4 & IPv6 patterns -> [IP])
       │
       ▼
[Sanitized Diagnostic Payload] ──► Dispatched to CrashPulse
```

You can inspect the exact sanitization implementation in [`src/services/crashReporter.ts`](./src/services/crashReporter.ts).

---

## 4. In-App Bug & Feedback Reporting

When you submit feedback or bug reports via the in-app **Feedback Modal**:
- You can categorize your submission (`Bug Report`, `UI Glitch`, `Feature Idea`).
- You can toggle whether to attach anonymous diagnostics (OS, Version, Theme).
- You can click **"Preview Sanitized Data"** to review the exact JSON payload before sending.
- Providing contact details (Email, Telegram, GitHub) is entirely optional.

---

## 5. Opting In & Opting Out

You maintain complete control over diagnostic telemetry at all times:

1. **First-Launch Consent**: On first launch, ShellFerry presents a transparent **Privacy & Diagnostic Telemetry** modal allowing you to choose between:
   - *Allow Diagnostic Reports (Recommended)*
   - *Disable Diagnostics*
2. **Settings Toggle**: You can enable or disable diagnostic reporting at any time:
   - Open **Settings** (Click the Gear icon or press `Cmd+,` / `Ctrl+,`).
   - Navigate to **Security & Vault**.
   - Toggle **"Send anonymous crash reports"**.
3. **Offline Mode**: If diagnostic reporting is disabled, no crash reporting requests are made to CrashPulse.

---

## 6. Open Source Transparency

ShellFerry is open source. You can audit all network requests, telemetry endpoints, and cryptographic operations directly in our codebase at [github.com/rzkfyn/openterm](https://github.com/rzkfyn/openterm).

If you have security or privacy inquiries, please open an issue on GitHub or reach out to the maintainers.
