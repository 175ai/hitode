export function getAppBasePath() {
  const { pathname } = window.location;
  if (pathname.endsWith('/')) {
    return pathname;
  }

  return pathname.replace(/[^/]*$/, '');
}
