import { next } from '@vercel/functions';

/**
 * Proteção por senha no Vercel (Basic Auth).
 * Ative definindo no dashboard: PROTOTYPE_PASSWORD (e opcionalmente PROTOTYPE_USER).
 * Se nenhum estiver definido, o site fica aberto (útil em dev/local).
 * Após definir as variáveis, é obrigatório fazer um novo deploy.
 */
export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname || '/';
  if (
    pathname.startsWith('/assets/') ||
    pathname === '/favicon.ico' ||
    /\\.(ico|png|svg|js|css|woff2?)(\\?|$)/i.test(pathname)
  ) {
    return next();
  }

  const password = process.env.PROTOTYPE_PASSWORD;
  const user = process.env.PROTOTYPE_USER || 'prototype';

  if (!password) {
    return next();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const [headerUser, headerPassword] = decoded.split(':');
      if (headerUser === user && headerPassword === password) {
        return next();
      }
    } catch {
      // decode falhou
    }
  }

  return new Response('Protótipo protegido por senha', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Protótipo", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
