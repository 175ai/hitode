# Third-Party Notices

This directory contains third-party attribution and license files bundled for redistribution.

## Included Files

- `Apache-2.0-kuromoji.txt`
	- Source: `node_modules/kuromoji/LICENSE-2.0.txt`
	- Purpose: License text for kuromoji.js
- `NOTICE-kuromoji.txt`
	- Source: `node_modules/kuromoji/NOTICE.md`
	- Purpose: Attribution and dependency notice for kuromoji.js dictionary resources

## Maintenance

When updating kuromoji.js version:

1. Re-copy license and notice files from `node_modules/kuromoji/`.
2. Verify `vendor/kuromoji/kuromoji.js` and `vendor/kuromoji/dic/*.dat.gz` are in sync.
3. Update `docs/license-notes.md` if dependency metadata changes.
