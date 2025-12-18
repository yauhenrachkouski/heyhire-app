import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const error = searchParams.get('error')
  
  // Redirect directly to sign-in with error message
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const baseUrl = forwardedHost
    ? `${forwardedProto || 'https'}://${forwardedHost}`
    : request.nextUrl.origin
  const signInUrl = new URL('/auth/signin', baseUrl)
  
  if (error) {
    // Format error message: replace underscores with spaces
    const formattedError = error.replace(/_/g, ' ')
    signInUrl.searchParams.set('error', formattedError)
  }
  
  return NextResponse.redirect(signInUrl)
}

