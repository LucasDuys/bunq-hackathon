import { getActiveRunForOrg, getLatestRunForOrg } from "@/lib/agent/onboarding";
import { DEFAULT_ORG_ID, getActivePolicyRaw } from "@/lib/queries";
import { SidebarNav } from "./SidebarNav";

export const Sidebar = () => {
  const activeRun = getActiveRunForOrg(DEFAULT_ORG_ID);
  const latestRun = getLatestRunForOrg(DEFAULT_ORG_ID);
  const hasPolicy = !!getActivePolicyRaw(DEFAULT_ORG_ID);
  const showOnboardingLink = !!activeRun || !hasPolicy || !latestRun;
  const onboardingLink = showOnboardingLink
    ? {
        href: activeRun ? `/onboarding/${activeRun.id}` : "/onboarding",
        label: activeRun ? "Continue onboarding" : "Start onboarding",
      }
    : null;

  return <SidebarNav onboardingLink={onboardingLink} />;
};
