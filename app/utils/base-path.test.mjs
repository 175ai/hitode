import test from 'node:test';
import assert from 'node:assert/strict';

const originalWindow = globalThis.window;

function setLocation(pathname) {
  globalThis.window = {
    location: {
      href: `https://example.test${pathname}`,
      pathname
    }
  };
}

test('returns a trailing-slash base path for repo-root URLs', async () => {
  setLocation('/hitode');
  const { getAppBasePath } = await import('./base-path.js');
  assert.equal(getAppBasePath(), '/hitode/');
});

test('returns a directory base path for file-based URLs', async () => {
  setLocation('/hitode/index.html');
  const { getAppBasePath } = await import('./base-path.js');
  assert.equal(getAppBasePath(), '/hitode/');
});

try {
  delete globalThis.window;
} finally {
  globalThis.window = originalWindow;
}
