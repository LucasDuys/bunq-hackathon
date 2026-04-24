import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileUp, MessageCircle, Shuffle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { OnboardingTrackPicker } from "@/components/OnboardingClient";
import { getActiveRunForOrg, getLatestRunForOrg } from "@/lib/agent/onboarding";
import { DEFAULT_ORG_ID, getActivePolicyRaw, getOrg } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function OnboardingLanding() {
  const org = getOrg();
  const active = getActiveRunForOrg(DEFAULT_ORG_ID);
  if (active) redirect(`/onboarding/${active.id}`);
  const latest = getLatestRunForOrg(DEFAULT_ORG_ID);
  const activePolicy = getActivePolicyRaw();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Onboarding</div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Carbo.</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
          Let&apos;s set up your monthly carbon close. You can describe your business in a short interview and we&apos;ll write the policy, or you can upload a policy you already have and we&apos;ll map it onto Carbo. Either way, you stay in control — we only activate it when you approve.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Track 1</span>
            </div>
            <div>
              <div className="text-sm font-semibold">Generate a policy</div>
              <p className="text-xs text-zinc-500 mt-1">
                6–12 short questions. We calibrate reserve rules, credit preferences, and caps based on your answers.
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <FileUp className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Track 2</span>
            </div>
            <div>
              <div className="text-sm font-semibold">Upload an existing policy</div>
              <p className="text-xs text-zinc-500 mt-1">
                PDF / DOCX / Markdown / YAML / JSON. We parse, flag gaps, and ask only what&apos;s missing.
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Shuffle className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Track 3</span>
            </div>
            <div>
              <div className="text-sm font-semibold">Mix — start from your doc</div>
              <p className="text-xs text-zinc-500 mt-1">
                Upload what you have, then refine the details interactively. Best for partial drafts and old ESG policies.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Pick a track</CardTitle>
          {activePolicy && (
            <Badge tone="positive">A policy is already active for {org?.name ?? "this org"} — this will replace it.</Badge>
          )}
        </CardHeader>
        <CardBody>
          <OnboardingTrackPicker defaultCompanyName={org?.name ?? ""} />
        </CardBody>
      </Card>

      {latest && latest.status === "completed" && (
        <Card>
          <CardHeader><CardTitle>Previous onboarding run</CardTitle></CardHeader>
          <CardBody className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
              <span>{new Date(latest.completedAt ? latest.completedAt * 1000 : latest.updatedAt * 1000).toLocaleString()}</span>
              <Badge tone="default">{latest.track}</Badge>
              <Badge tone="positive">completed</Badge>
            </div>
            <Link href={`/onboarding/${latest.id}`} className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
