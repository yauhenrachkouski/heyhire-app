import { auth } from "@/lib/auth"; // path to your auth file
import { withAxiom } from "@/lib/axiom/server";
import { toNextJsHandler } from "better-auth/next-js";

const { POST: authPost, GET: authGet } = toNextJsHandler(auth);

export const GET = withAxiom(authGet);
export const POST = withAxiom(authPost);
