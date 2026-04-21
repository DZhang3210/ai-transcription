import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth protection is handled client-side via useConvexAuth redirect
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
