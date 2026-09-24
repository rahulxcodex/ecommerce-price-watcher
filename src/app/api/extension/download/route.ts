import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createZip, ZipFileEntry } from '@/lib/zip';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const extDir = path.join(process.cwd(), 'extension');
    const filesToInclude = [
      { name: 'manifest.json', filePath: path.join(extDir, 'manifest.json') },
      { name: 'popup.html', filePath: path.join(extDir, 'popup.html') },
      { name: 'popup.js', filePath: path.join(extDir, 'popup.js') },
      { name: 'icons/icon-16.png', filePath: path.join(extDir, 'icons', 'icon-16.png') },
      { name: 'icons/icon-48.png', filePath: path.join(extDir, 'icons', 'icon-48.png') },
      { name: 'icons/icon-128.png', filePath: path.join(extDir, 'icons', 'icon-128.png') },
    ];

    const entries: ZipFileEntry[] = [];
    for (const f of filesToInclude) {
      if (fs.existsSync(f.filePath)) {
        entries.push({
          name: f.name,
          data: fs.readFileSync(f.filePath),
        });
      }
    }

    const zipBuffer = createZip(entries);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="PriceWatcher-Companion-Extension.zip"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
