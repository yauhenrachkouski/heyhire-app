import { logger } from "@/lib/axiom/server";
import { transformMiddlewareRequest } from "@axiomhq/nextjs";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

// Auth endpoints blocked on demo domain (real auth methods)
const PRODUCTION_ONLY_AUTH = [
	"/api/auth/sign-in/google",
	"/api/auth/callback/google",
	"/api/auth/sign-in/magic-link",
	"/api/auth/magic-link",
];

// Auth endpoints blocked on production domain (demo-only methods)
const DEMO_ONLY_AUTH = [
	"/api/auth/sign-in/anonymous",
];

export async function proxy(request: NextRequest, event: NextFetchEvent) {
	logger.info(...transformMiddlewareRequest(request));

	event.waitUntil(logger.flush());

	const hostname = request.headers.get("host") || "";
	const pathname = request.nextUrl.pathname;
	const isDemoHost = hostname.startsWith("demo.heyhire.ai") || hostname.startsWith("demo.localhost");

	// Demo domain: block real auth methods
	if (isDemoHost && PRODUCTION_ONLY_AUTH.some(p => pathname.startsWith(p))) {
		return NextResponse.json(
			{ error: "This authentication method is not available in demo mode" },
			{ status: 403 }
		);
	}

	// Production domain: block anonymous auth
	if (!isDemoHost && DEMO_ONLY_AUTH.some(p => pathname.startsWith(p))) {
		return NextResponse.json(
			{ error: "Anonymous authentication is only available in demo mode" },
			{ status: 403 }
		);
	}

	// Production domain: block /demo page
	if (!isDemoHost && pathname === "/demo") {
		return NextResponse.redirect(new URL("/auth/signin", request.url));
	}

	const res = NextResponse.next();

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
		 * Match all request paths except for static assets.
		 * Includes api/auth for hostname-based auth isolation.
		 */
		"/((?!api/axiom|_next/static|_next/image|favicon.ico|favicon.png|.*\\.svg$|.*\\.png$).*)",
	],
};
