import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string })?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}
