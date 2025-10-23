import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers()
	});
	
	if (!session) {
		return NextResponse.redirect(new URL("/auth/signin", request.url));
	}
	
	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api/auth (auth API routes)
		 * - auth (public auth pages like signin/signup and callback)
		 * - onboarding (onboarding page)
		 * - pricing (pricing page - accessible without subscription)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, favicon.png (favicon files)
		 * - public assets (svg, png, etc.)
		 */
		"/((?!api/auth|auth|onboarding|pricing|_next/static|_next/image|favicon.ico|favicon.png|.*\\.svg$|.*\\.png$).*)",
	],
};
