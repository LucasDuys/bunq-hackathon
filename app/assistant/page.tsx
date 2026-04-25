import { AssistantWorkspace } from "@/components/AssistantWorkspace";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ metric?: string; scope?: string }>;

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  return (
    <AssistantWorkspace
      initialMetric={sp.metric ?? null}
      initialScope={sp.scope ?? null}
    />
  );
}
