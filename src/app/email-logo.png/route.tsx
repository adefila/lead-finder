import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

const TEXT = 'Lead Finder';

// Email clients strip web fonts, so the script wordmark ships as an image.
async function loadScriptFont(): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&text=${encodeURIComponent(TEXT)}`).then(r => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error('Could not load Dancing Script');
  return fetch(url).then(r => r.arrayBuffer());
}

export async function GET() {
  const font = await loadScriptFont();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: '#0f0f0f', paddingLeft: 4 }}>
        <span style={{ fontFamily: 'Dancing Script', fontSize: 58, color: '#ffffff', lineHeight: 1 }}>{TEXT}</span>
      </div>
    ),
    {
      width: 360,
      height: 80,
      fonts: [{ name: 'Dancing Script', data: font, weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': 'public, max-age=604800, immutable' },
    },
  );
}
