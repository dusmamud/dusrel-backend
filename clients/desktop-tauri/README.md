# desktop-tauri — scope doc only, no code yet

Future Desktop app ka planning doc yahan nahi, `docs/` me hai:
- Overview: `docs/15-client-overview.md`
- Desktop spec: `docs/18-desktop.md`
- Security/sync: `docs/19-client-security-sync.md`

Stack (docs ke liye): Tauri v2 (Rust backend + OS WebView + web
frontend reuse), Windows pehle, phir macOS, phir Linux. Electron
sirf fallback hai, alag ADR ke saath.

Code is repo me nahi aayega. Jab Desktop app banegi to uska alag
desktop repo banega, aur ye folder sirf us repo ka link/scope
rakhega. Abhi is folder me koi code, Tauri config ya signing
certificate nahi hai.
