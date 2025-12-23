import { logger } from "@/lib/axiom/server";
import { transformMiddlewareRequest } from "@axiomhq/nextjs";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
	logger.info(...transformMiddlewareRequest(request));

	event.waitUntil(logger.flush());

	const res = NextResponse.next();
	const pathname = request.nextUrl.pathname;

	// Preview mode cookie (used to authorize API reads and block mutations in preview).
	// Token itself is a random id; cookie is httpOnly so client JS can't read it.
	if (pathname.startsWith("/p/")) {
		const token = pathname.split("/")[2];
		if (token) {
			const existingToken = request.cookies.get("hh_preview_token")?.value;
			const isFirstVisit = existingToken !== token;

			res.cookies.set("hh_preview_token", token, {
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				path: "/",
			});

			// Flag first visit so layout knows to track view count
			if (isFirstVisit) {
				res.cookies.set("hh_preview_first", "1", {
					httpOnly: true,
					sameSite: "lax",
					secure: process.env.NODE_ENV === "production",
					path: "/",
					maxAge: 10, // Short-lived, just for this request
				});
			}
		}
	} else {
		res.cookies.delete("hh_preview_token");
		res.cookies.delete("hh_preview_first");
	}

	return res;
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
		"/((?!api/auth|_next/static|_next/image|favicon.ico|favicon.png|.*\\.svg$|.*\\.png$).*)",
	],
};
