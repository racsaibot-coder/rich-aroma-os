# Lessons Learned

## 2026-02-02: Local Backup Failure
- **Issue:** Orders were saving to Supabase but not locally, causing data invisibility when checking local JSON.
- **Fix:** Added synchronous `fs.writeFileSync` in the `/api/orders` endpoint as a "Hybrid Sync".
- **Rule:** Never trust remote DB alone for local POS. Always double-write to local JSON.

## 2026-02-02: Copy-Paste Hazard
- **Issue:** Paste error created duplicate `init()` function in `pos.html`, breaking JS syntax.
- **Fix:** Manually removed duplicate block.
- **Rule:** When editing large files, verify the insertion point context carefully or use `sed`/regex for surgical edits.
