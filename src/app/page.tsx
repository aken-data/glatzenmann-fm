import { RadioPlayer } from "@/components/RadioPlayer";
import { getNowSnapshot } from "@/lib/station";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await getNowSnapshot();
  return <RadioPlayer initial={initial} />;
}
