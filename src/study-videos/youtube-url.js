export function validStudyYoutubeUrl(raw) {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(host)) return null;
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length !== 1) return null;
      id = parts[0];
    } else if (url.pathname === '/watch') {
      id = url.searchParams.get('v') || '';
    } else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
