import { Axiom } from "@axiomhq/js";

const token = process.env.AXIOM_TOKEN ?? process.env.NEXT_PUBLIC_AXIOM_TOKEN;

if (!token) {
  throw new Error("AXIOM_TOKEN (or NEXT_PUBLIC_AXIOM_TOKEN) is required");
}

const axiomClient = new Axiom({
  token,
});

export default axiomClient;
