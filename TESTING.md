# Verification — 2026-10-25

- `node --test tests/*.test.js`: **18 passed, 0 failed**.
- ZIP: Python `zipfile.testzip()` verified all CRCs; 13 extension files; root manifest parses as Manifest V3.
- Edge page preview: weak password detection (15/100), suppression of misleading model estimates for predictable input, Unicode code-point length and unavailable estimates, generated-target matching, configuration locking while running, immediate stop, oversized-space rejection, and clearing during a running demo all verified.
- A 4-digit generated target matched at attempt 3,040 in 1.182 seconds in visual mode. Results vary by target, browser scheduling and hardware.
- Popup page navigation to the lab was verified using its web-preview fallback. Browser console had no warnings or errors during the checks.
- No horizontal overflow at the tested desktop viewport. Screenshot: `artifacts/preview.jpg` (excluded from source control).

The browser checks used a loopback HTTP preview of the packaged page and actual module Worker. The extension was **not installed into the user's Edge profile**. Extension API navigation and manifest acceptance should receive a final check after loading the unpacked folder. These tests do not access website login endpoints or real account credentials.
