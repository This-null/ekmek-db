import { IncomingMessage, ServerResponse } from 'http';

const MAX_BODY = 25 * 1024 * 1024;

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

export async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function setSessionCookie(res: ServerResponse, token: string, maxAgeMs: number): void {
  const attrs = [
    `ekmek_sid=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', 'ekmek_sid=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
}
