import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware is a no-op, it just passes the request through.
// Its primary purpose is to use the `config.matcher` to specify which routes
// should trigger Next.js middleware processing. By explicitly listing protected
// routes, we ensure that public routes like API endpoints and static assets
// are NOT processed by any middleware, preventing issues like auth redirects.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// By defining the routes that DO need middleware, we implicitly make all other
// routes public and bypass middleware execution for them.
// This is crucial for public API endpoints like Stripe webhooks.
export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
  ],
}
