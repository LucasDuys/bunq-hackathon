import { redirect } from "next/navigation";
import { OnboardingIntroFlow } from "@/components/OnboardingFlow";
import { getActiveRunForOrg } from "@/lib/agent/onboarding";
import { DEFAULT_ORG_ID, getActivePolicyRaw, getOrg } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function OnboardingLanding() {
  const active = getActiveRunForOrg(DEFAULT_ORG_ID);
  if (active) redirect(`/onboarding/${active.id}`);

  const org = getOrg();
  const activePolicy = getActivePolicyRaw();

  return (
    <OnboardingIntroFlow
      defaultCompanyName={org?.name ?? ""}
      hasActivePolicy={Boolean(activePolicy)}
      orgName={org?.name ?? "this org"}
    />
  );
}
