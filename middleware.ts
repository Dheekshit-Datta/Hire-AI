import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Allow demo route without authentication
  if (request.nextUrl.pathname.startsWith("/demo")) {
    return NextResponse.next()
  }

  // Allow auth routes
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return NextResponse.next()
  }

  // Check if Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // In demo mode, allow access to dashboard and redirect root to dashboard
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
          },
        },
      },
    )

    // Refresh session if expired
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Redirect authenticated users away from auth pages (except callback)
    if (
      user &&
      request.nextUrl.pathname.startsWith("/auth/") &&
      !request.nextUrl.pathname.includes("/callback") &&
      !request.nextUrl.pathname.includes("/auth-code-error")
    ) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // Redirect root to dashboard if authenticated
    if (request.nextUrl.pathname === "/" && user) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch (error) {
    console.warn("Middleware error, allowing access:", error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
