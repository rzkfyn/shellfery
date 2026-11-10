# ShellFerry v0.8.6 Release Notes

ShellFerry v0.8.6 fixes a false "host key changed" error on Windows after updating to v0.8.5.

---

## What's New

### 1. Host Key Verification Fix
- **Fixed**: After updating to v0.8.5 on Windows, connecting to a previously known host could fail with "Host key verification failed ... Remote host identification has changed!" even though the server had not changed.
- **Cause**: v0.8.5 switched Windows to the OpenSSL crypto backend, which negotiates ed25519/ECDSA host keys first, while `known_hosts` entries recorded by older versions are RSA. The new key was compared against the old RSA entry.
- **Behavior**: Like the OpenSSH client, ShellFerry now prefers the host key types already recorded in `~/.ssh/known_hosts` for that host. A real host key change of the same type is still reported.
