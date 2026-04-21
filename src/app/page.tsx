import { cookies } from "next/headers";
import { StudioClient } from "@/components/studio-client";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const initialAuthenticated = verifyAuthToken(token).valid;

  return <StudioClient initialAuthenticated={initialAuthenticated} />;
}
