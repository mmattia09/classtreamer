import { clearAdminSession } from "@/lib/auth";
import { redirectToPath } from "@/lib/http";

export async function POST() {
  await clearAdminSession();
  return redirectToPath("/admin");
}
