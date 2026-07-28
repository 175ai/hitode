# Distribution Guide

This guide describes what to include when redistributing this project with kuromoji.js assets.

## Scope

This project distributes the following third-party materials:

- `vendor/kuromoji/kuromoji.js`
- `vendor/kuromoji/dic/*.dat.gz`
- `vendor/third-party-notices/Apache-2.0-kuromoji.txt`
- `vendor/third-party-notices/NOTICE-kuromoji.txt`

## Release Checklist

1. Verify the app runs via HTTP (not `file://`) and tokenization works.
2. Verify dictionary files are present under `vendor/kuromoji/dic/`.
3. Ensure third-party notice files are included in the release package:
   - `vendor/third-party-notices/Apache-2.0-kuromoji.txt`
   - `vendor/third-party-notices/NOTICE-kuromoji.txt`
4. Keep `docs/license-notes.md` up to date with the bundled version.
5. If `kuromoji.js` is updated, copy matching `kuromoji.js`, dictionary files, and notice files from the same version.

## Optional Verification Commands

```bash
# Confirm runtime assets exist
ls -la vendor/kuromoji/kuromoji.js
ls -la vendor/kuromoji/dic/*.dat.gz
ls -la vendor/third-party-notices/Apache-2.0-kuromoji.txt
ls -la vendor/third-party-notices/NOTICE-kuromoji.txt
```

## License Reminder

kuromoji.js is distributed under Apache License 2.0. Keep license and notice files with redistributed binaries/source as required by the license terms.
