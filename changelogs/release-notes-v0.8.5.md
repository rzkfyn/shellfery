# ShellFerry v0.8.5 Release Notes

ShellFerry v0.8.5 fixes ed25519 and ECDSA public key authentication on Windows.

---

## What's New

### 1. Windows SSH Authentication Fixes
- **Fixed**: On Windows, public key authentication with ed25519 (and ECDSA) keys always failed with `[Session(-19)] Callback returned error`, even when the same key worked with the OpenSSH client (#49).
- **Cause**: Windows builds of libssh2 used the WinCNG crypto backend, which has no ed25519/ECDSA support. They now use the bundled OpenSSL backend, like macOS and Linux.
- **Clearer errors**: When a modern OpenSSH-format key fails to authenticate, the actual error is now shown instead of the error from the last fallback attempt.
