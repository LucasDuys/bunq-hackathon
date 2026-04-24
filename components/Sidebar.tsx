import { getActiveRunForOrg, getLatestRunForOrg } from "@/lib/agent/onboarding";
import { DEFAULT_ORG_ID, getActivePolicyRaw, getLatestCloseRun } from "@/lib/queries";
import { SidebarNav } from "./SidebarNav";

const TERMINAL_CLOSE_STATES = new Set(["COMPLETED", "FAILED"]);

export const Sidebar = () => {
  const activeOnboarding = getActiveRunForOrg(DEFAULT_ORG_ID);
  const latestOnboarding = getLatestRunForOrg(DEFAULT_ORG_ID);
  const hasPolicy = !!getActivePolicyRaw(DEFAULT_ORG_ID);
  const showOnboardingLink = !!activeOnboarding || !hasPolicy || !latestOnboarding;
  const onboardingLink = showOnboardingLink
    ? {
        href: activeOnboarding ? `/onboarding/${activeOnboarding.id}` : "/onboarding",
        label: activeOnboarding ? "Continue onboarding" : "Start onboarding",
      }
    : null;

  const latestClose = getLatestCloseRun(DEFAULT_ORG_ID);
  const activeClose =
    latestClose && !TERMINAL_CLOSE_STATES.has(latestClose.state) ? latestClose : null;
  const closeLink = activeClose
    ? {
        href: `/close/${activeClose.id}`,
        label: activeClose.state === "AWAITING_APPROVAL" || activeClose.state === "PROPOSED"
          ? "Review & approve"
          : "Continue close",
        month: activeClose.month,
      }
    : null;

  return <SidebarNav onboardingLink={onboardingLink} closeLink={closeLink} />;
};
