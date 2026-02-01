import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The `middleware` function is a no-op because the client-side layouts already handle authentication redirects.
// The primary purpose of this file is to use the `config.matcher` to explicitly prevent
// any middleware (default or otherwise) from running on public paths like API routes and assets.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// See "Matching Paths" in the Next.js docs: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - / (the public homepage, which redirects)
     * - /login (the login page)
     * - /signup (the signup page)
     * - /embed (the embeddable page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|signup|embed|$).*)',
  ],
}
