import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const DEV_USER_ID = "dev-preview-user";

export async function requireUserId(): Promise<string> {
  if (
    process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return DEV_USER_ID;
  }
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string })?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}
