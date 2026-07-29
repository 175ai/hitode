export function getAppBasePath() {
  if (typeof window === 'undefined' || !window.location) {
    return '/';
  }

  const { pathname = '/' } = window.location;
  const normalizedPath = pathname === '' ? '/' : pathname;

  if (normalizedPath.endsWith('/')) {
    return normalizedPath;
  }

  const lastSegment = normalizedPath.split('/').filter(Boolean).pop() ?? '';
  if (lastSegment && !lastSegment.includes('.')) {
    return `${normalizedPath}/`;
  }

  return normalizedPath.replace(/[^/]*$/, '');
}
