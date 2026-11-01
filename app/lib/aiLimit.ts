import { createLimiter } from "./limit";

// Each AI read costs money. Serverless instances count separately, so the account spend limit is the hard cap.
const perVisitor = createLimiter(6, 10 * 60_000);
const perInstance = createLimiter(60, 60 * 60_000);

export function allowAiRead(request: Request): boolean {
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return perVisitor(visitor) && perInstance("all");
}
