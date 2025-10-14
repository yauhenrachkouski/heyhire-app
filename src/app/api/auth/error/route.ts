import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const error = searchParams.get('error')
  
  // Redirect directly to sign-in with error message
  const signInUrl = new URL('/auth/signin', request.url)
  
  if (error) {
    // Format error message: replace underscores with spaces
    const formattedError = error.replace(/_/g, ' ')
    signInUrl.searchParams.set('error', formattedError)
  }
  
  return NextResponse.redirect(signInUrl)
}

