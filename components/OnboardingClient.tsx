"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, MessageCircle, Shuffle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { Policy } from "@/lib/policy/schema";

export const OnboardingTrackPicker = ({ defaultCompanyName }: { defaultCompanyName: string }) => {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [track, setTrack] = useState<"generate" | "upload" | "mix" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!track) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ track, companyName: companyName || undefined }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to start onboarding");
      }
      const j = (await resp.json()) as { id: string };
      router.push(`/onboarding/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const Pill = ({
    value,
    icon,
    title,
    subtitle,
  }: {
    value: "generate" | "upload" | "mix";
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }) => {
    const selected = track === value;
    return (
      <button
        type="button"
        onClick={() => setTrack(value)}
        className={`flex-1 text-left rounded-xl border p-4 transition-colors ${selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
      >
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          {selected && <CheckCircle2 className="h-4 w-4 ml-auto" />}
        </div>
        <div className="text-xs text-zinc-500 mt-1.5">{subtitle}</div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="company-name" className="text-xs uppercase tracking-wide text-zinc-500">
          Company name
        </label>
        <input
          id="company-name"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme BV"
          className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-10 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Pill
          value="generate"
          icon={<MessageCircle className="h-4 w-4" />}
          title="Generate from interview"
          subtitle="Answer 6–12 short questions. We&apos;ll write the policy."
        />
        <Pill
          value="upload"
          icon={<FileUp className="h-4 w-4" />}
          title="Upload existing policy"
          subtitle="PDF / DOCX / Markdown / YAML / JSON."
        />
        <Pill
          value="mix"
          icon={<Shuffle className="h-4 w-4" />}
          title="Upload + refine"
          subtitle="Start from your doc, then fill gaps."
        />
      </div>

      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          You can change your mind later — nothing is activated until you approve the draft.
        </div>
        <Button onClick={start} disabled={!track || busy} className="gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Start onboarding
        </Button>
      </div>
    </div>
  );
};

export const OnboardingAnswerForm = ({
  runId,
  qaId,
  kind,
  options,
  required,
}: {
  runId: string;
  qaId: number;
  kind: "multiple_choice" | "free_text" | "numeric" | "confirm";
  options?: string[];
  required: boolean;
}) => {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (answer: string, loadingKey = "submit") => {
    setBusy(loadingKey);
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "answer", qaId, answer }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to submit answer");
      }
      setText("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const skip = async () => {
    setBusy("skip");
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "skip", qaId }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to skip");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {kind === "multiple_choice" && options && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button
              key={o}
              variant="secondary"
              size="md"
              disabled={busy !== null}
              onClick={() => submit(o, o)}
              className="gap-2"
            >
              {busy === o && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {o}
            </Button>
          ))}
        </div>
      )}

      {kind === "confirm" && (
        <div className="flex gap-2">
          <Button disabled={busy !== null} onClick={() => submit("Yes", "yes")} className="gap-2">
            {busy === "yes" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Yes
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => submit("No", "no")} className="gap-2">
            {busy === "no" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            No
          </Button>
        </div>
      )}

      {kind === "numeric" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(text.trim());
          }}
          className="flex items-center gap-2"
        >
          <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-10 px-3 text-sm focus-within:ring-2 focus-within:ring-emerald-500">
            <span className="text-zinc-500 mr-2">€</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="bg-transparent outline-none tabular-nums text-right w-32"
              placeholder="0"
            />
          </div>
          <Button type="submit" disabled={busy !== null || !text.trim()} className="gap-2">
            {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </form>
      )}

      {kind === "free_text" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(text.trim());
          }}
          className="flex flex-col gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="Type your answer…"
          />
          <div className="flex items-center justify-end gap-2">
            {!required && (
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={skip}>
                Skip
              </Button>
            )}
            <Button type="submit" disabled={busy !== null || !text.trim()} className="gap-2">
              {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        </form>
      )}

      {!required && kind !== "free_text" && (
        <div>
          <Button variant="ghost" size="sm" disabled={busy !== null} onClick={skip}>
            Skip this one
          </Button>
        </div>
      )}

      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
    </div>
  );
};

export const OnboardingUploadDrop = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setFilename(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const resp = await fetch(`/api/onboarding/${runId}/upload`, { method: "POST", body: form });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Upload failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setFilename(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.md,.markdown,.yaml,.yml,.json,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
      <div className="text-sm">
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing {filename}…
          </span>
        ) : filename ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Uploaded {filename}
          </span>
        ) : (
          <>Drag a file here, or <button type="button" onClick={() => inputRef.current?.click()} className="text-emerald-700 dark:text-emerald-400 hover:underline">pick one</button>.</>
        )}
      </div>
      <div className="text-xs text-zinc-500 mt-1">PDF · DOCX · Markdown · YAML · JSON · TXT</div>
      {error && <div className="text-sm text-rose-600 dark:text-rose-400 mt-2">{error}</div>}
    </div>
  );
};

export const OnboardingApprove = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/approve`, { method: "POST" });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Approval failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={approve} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Approve &amp; activate
      </Button>
      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
    </div>
  );
};

export const OnboardingResetLink = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!confirm("Cancel this onboarding run? You can start a new one after.")) return;
    setBusy(true);
    try {
      await fetch(`/api/onboarding/${runId}/cancel`, { method: "POST" });
      router.push("/onboarding");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className="text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      Start over
    </button>
  );
};

export const OnboardingDraftPreview = ({
  runId,
  draft,
  markdown,
}: {
  runId: string;
  draft: Policy;
  markdown: string;
}) => {
  const [view, setView] = useState<"table" | "doc">("table");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setView("table")}
          className={`text-sm pb-2 -mb-px border-b-2 ${view === "table" ? "border-emerald-500 text-zinc-900 dark:text-zinc-50" : "border-transparent text-zinc-500"}`}
        >
          Reserve rules
        </button>
        <button
          type="button"
          onClick={() => setView("doc")}
          className={`text-sm pb-2 -mb-px border-b-2 ${view === "doc" ? "border-emerald-500 text-zinc-900 dark:text-zinc-50" : "border-transparent text-zinc-500"}`}
        >
          Policy document
        </button>
        <div className="ml-auto">
          <DownloadPolicyButton runId={runId} markdown={markdown} />
        </div>
      </div>

      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {draft.reserveRules.map((r, i) => (
                <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 font-medium">{r.category}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{r.method}</td>
                  <td className="py-2 pr-4 text-right">
                    {r.method === "pct_spend"
                      ? `${(r.value * 100).toFixed(2)}%`
                      : r.method === "eur_per_kg_co2e"
                        ? `€${r.value.toFixed(3)}/kg`
                        : `€${r.value.toFixed(2)} flat`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "doc" && (
        <pre className="whitespace-pre-wrap text-sm leading-6 font-mono bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-4 max-h-[420px] overflow-auto">
          {markdown}
        </pre>
      )}
    </div>
  );
};

const DownloadPolicyButton = ({ runId, markdown }: { runId: string; markdown: string }) => {
  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carbo-policy-${runId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="ghost" size="sm" onClick={download}>
      Download .md
    </Button>
  );
};

export const OnboardingContinueLink = ({ runId }: { runId: string }) => (
  <Link href={`/onboarding/${runId}`} className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
    Continue onboarding
  </Link>
);
