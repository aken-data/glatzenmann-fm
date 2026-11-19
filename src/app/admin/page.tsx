import { cookies } from "next/headers";
import { AdminConsole } from "@/components/AdminConsole";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { loadStationState } from "@/lib/station";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const authed = await verifySessionToken(token, "admin");
  const initialState = authed ? await loadStationState() : null;

  return <AdminConsole initialState={initialState} />;
}
