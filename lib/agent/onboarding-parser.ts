import { readFile } from "node:fs/promises";
import { MODEL_SONNET, anthropic, withAnthropicFallback } from "@/lib/anthropic/client";
import { companyProfileSchema } from "@/lib/onboarding/profile";
import {
  EMPTY_PARSER_OUTPUT,
  parserOutputSchema,
  partialPolicySchema,
  type ParserGap,
  type ParserOutput,
  type ParserUnsupported,
} from "@/lib/onboarding/types";
import { policySchema } from "@/lib/policy/schema";

const ALLOWED_CATEGORIES = new Set([
  "travel",
  "food",
  "procurement",
  "cloud",
  "services",
  "utilities",
  "fuel",
  "*",
]);

const ALLOWED_METHODS = new Set(["pct_spend", "eur_per_kg_co2e", "flat_eur"]);

type NormalizedInput = {
  text: string;
  kind: "text" | "pdf";
  pdfBytes?: Buffer;
};

const readTextFile = async (path: string): Promise<string> => {
  const buf = await readFile(path);
  return buf.toString("utf8");
};

/**
 * Naive DOCX → text. A DOCX is a zip that contains word/document.xml. For the
 * hackathon we do the cheapest possible thing: regex-extract the <w:t> text
 * nodes after unzipping. We lazy-require adm-zip via dynamic import so that if
 * it isn't installed we fall back to "text" handling and let Sonnet deal.
 */
const readDocx = async (path: string): Promise<string> => {
  // adm-zip is an optional runtime dependency: if installed we extract
  // word/document.xml cleanly; if not, we fall back to the raw-text path.
  // The dynamic specifier is hidden behind a variable so the TS compiler
  // doesn't require the types to be present at build time.
  try {
    const moduleName = "adm-zip";
    const admZipMod = (await import(/* webpackIgnore: true */ moduleName).catch(() => null)) as
      | { default: new (p: string) => { readAsText: (n: string) => string } }
      | null;
    if (admZipMod) {
      const zip = new admZipMod.default(path);
      const xml = zip.readAsText("word/document.xml");
      if (xml) {
        const textNodes = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
        return textNodes.map((n) => n.replace(/<[^>]+>/g, "")).join(" ");
      }
    }
  } catch {
    // fall through
  }
  // Best-effort: read file as utf8 and let the LLM pick through the noise.
  return readTextFile(path);
};

const normalizeInput = async (path: string, mime: string): Promise<NormalizedInput> => {
  const lower = mime.toLowerCase();
  if (lower === "application/pdf") {
    return { text: "", kind: "pdf", pdfBytes: await readFile(path) };
  }
  if (lower.includes("officedocument.wordprocessingml")) {
    return { text: await readDocx(path), kind: "text" };
  }
  if (lower === "application/json") {
    const raw = await readTextFile(path);
    try {
      return { text: JSON.stringify(JSON.parse(raw), null, 2), kind: "text" };
    } catch {
      return { text: raw, kind: "text" };
    }
  }
  // yaml / md / plain text
  return { text: await readTextFile(path), kind: "text" };
};

const scoreGaps = (partial: unknown, profile: unknown): ParserGap[] => {
  const out: ParserGap[] = [];
  const p = (partial ?? {}) as Record<string, unknown>;
  const hasRules = Array.isArray(p.reserveRules) && (p.reserveRules as unknown[]).length > 0;
  if (!hasRules) out.push({ field: "reserveRules", reason: "not found in document" });
  if (p.approvalThresholdEur === undefined) out.push({ field: "approvalThresholdEur", reason: "not found" });
  if (p.maxReservePerMonthEur === undefined) out.push({ field: "maxReservePerMonthEur", reason: "not found" });
  const cp = (p.creditPreference ?? {}) as Record<string, unknown>;
  if (cp.region === undefined) out.push({ field: "creditPreference.region", reason: "not specified" });
  if (cp.minRemovalPct === undefined) out.push({ field: "creditPreference.minRemovalPct", reason: "not specified" });
  const prof = (profile ?? {}) as Record<string, unknown>;
  for (const f of ["sector", "geography", "physicalFootprint", "ambition"] as const) {
    if (prof[f] === undefined || prof[f] === "") out.push({ field: `profile.${f}`, reason: "not stated in document" });
  }
  return out;
};

const scoreUnsupported = (partial: unknown): ParserUnsupported[] => {
  const out: ParserUnsupported[] = [];
  const p = (partial ?? {}) as Record<string, unknown>;
  const rules = Array.isArray(p.reserveRules) ? (p.reserveRules as Array<Record<string, unknown>>) : [];
  for (const r of rules) {
    if (typeof r.method === "string" && !ALLOWED_METHODS.has(r.method)) {
      out.push({
        found: `reserve rule method "${r.method}"`,
        severity: "error",
        note: "Carbo supports pct_spend, eur_per_kg_co2e, flat_eur only. Pick a mapping when asked.",
      });
    }
    if (typeof r.category === "string" && !ALLOWED_CATEGORIES.has(r.category)) {
      out.push({
        found: `category "${r.category}"`,
        severity: "warn",
        note: "We'll map it to the closest supported category.",
      });
    }
  }
  return out;
};

const sanitizePartial = (raw: unknown): unknown => {
  const p = partialPolicySchema.safeParse(raw);
  if (!p.success) return {};
  const v = p.data;
  if (v.reserveRules) {
    v.reserveRules = v.reserveRules.filter(
      (r) => typeof r.category === "string" && typeof r.method === "string" && typeof r.value === "number",
    );
  }
  return v;
};

const deterministicParser = (input: NormalizedInput): ParserOutput => {
  // Structural attempt: if the text looks like JSON with our shape, pull it.
  const text = input.text || "";
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const raw = JSON.parse(trimmed);
      const maybePolicy = policySchema.safeParse(raw);
      if (maybePolicy.success) {
        return {
          partial: sanitizePartial(raw) as ParserOutput["partial"],
          profile: {},
          gaps: scoreGaps(raw, {}),
          unsupported: scoreUnsupported(raw),
        };
      }
      // Loose partial — still useful
      return {
        partial: sanitizePartial(raw) as ParserOutput["partial"],
        profile: {},
        gaps: scoreGaps(raw, {}),
        unsupported: scoreUnsupported(raw),
      };
    }
  } catch {
    // fallthrough — not JSON
  }

  // Regex sweep — extract a few well-known numbers from plain text
  const partial: Record<string, unknown> = {};
  const profile: Record<string, unknown> = {};

  const approval = text.match(/approval[^€\d]*€?\s*(\d{2,6})/i);
  if (approval) partial.approvalThresholdEur = Number(approval[1]);

  const monthly = text.match(/(?:monthly|month|cap)[^€\d]*€?\s*(\d{3,7})/i);
  if (monthly) partial.maxReservePerMonthEur = Number(monthly[1]);

  const removal = text.match(/(\d{1,3})\s*%\s*(?:removal|removals)/i);
  if (removal) partial.creditPreference = { minRemovalPct: Math.min(100, Number(removal[1])) / 100 };

  if (/EU\s*(?:registry|only|first)/i.test(text)) {
    partial.creditPreference = { ...(partial.creditPreference as object | undefined), region: "EU" };
  }

  // Reserve rules from simple "category: X% of spend" patterns
  const ruleMatches = [...text.matchAll(/\b(travel|food|procurement|cloud|services|utilities|fuel)\b[^0-9]*(\d{1,2}(?:\.\d+)?)\s*%/gi)];
  if (ruleMatches.length > 0) {
    partial.reserveRules = ruleMatches.map((m) => ({
      category: m[1].toLowerCase(),
      method: "pct_spend",
      value: Number(m[2]) / 100,
    }));
  }

  // Very light profile inference
  if (/software|saas/i.test(text)) profile.sector = "software_saas";
  if (/hotel|restaurant|hospitality/i.test(text)) profile.sector = "hospitality";
  if (/EU only/i.test(text)) profile.geography = "eu_only";
  if (/remote/i.test(text)) profile.physicalFootprint = "fully_remote";

  const profileSafe = companyProfileSchema.partial().safeParse(profile);
  return {
    partial: sanitizePartial(partial) as ParserOutput["partial"],
    profile: profileSafe.success ? profileSafe.data : {},
    gaps: scoreGaps(partial, profile),
    unsupported: scoreUnsupported(partial),
  };
};

const liveParser = async (input: NormalizedInput): Promise<ParserOutput> => {
  const client = anthropic();
  const instruction = `You are parsing a company's existing carbon / climate / ESG policy document and mapping it onto Carbo's policy schema.
Do not invent. Only fill a field if the document clearly states it.

Strict schema:
- reserveRules: array of { category: string, method: "pct_spend"|"eur_per_kg_co2e"|"flat_eur", value: number ≥ 0 }.
  Allowed categories: travel, food, procurement, cloud, services, utilities, fuel, or "*".
- approvalThresholdEur: number ≥ 0
- creditPreference.region: "EU" or "ANY"
- creditPreference.types: subset of ["removal_technical","removal_nature","reduction"]
- creditPreference.minRemovalPct: number 0..1
- maxReservePerMonthEur: number ≥ 0

Also extract a CompanyProfile where possible with fields:
sector (software_saas, professional_services, retail_ecommerce, manufacturing, hospitality, logistics_transport, construction_real_estate, other),
headcount (1_10, 11_50, 51_250, 250_plus),
geography (eu_only, eu_uk_eea, global),
revenueBand (lt_1m, 1_10m, 10_50m, 50m_plus),
physicalFootprint (fully_remote, one_office, multiple_offices, office_plus_warehouse),
ownedVehicles (none, 1_3_cars, fleet_4_plus, fleet_plus_trucks),
ambition (starter, balanced, aggressive),
csrdObligation (not_in_scope, voluntary, wave_1, wave_2, wave_3).

For every schema field you could not fill, add an entry to gaps. For any concept in the document that does not map to our schema (e.g. a reserve method we don't support, categories we don't use), add to unsupported.

Return JSON only:
{ "partial": { ...partial policy... }, "profile": { ...partial profile... }, "gaps": [ { "field": string, "reason": string, "suggested"?: any } ], "unsupported": [ { "found": string, "severity": "warn"|"error", "note": string } ] }`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: instruction }];
  if (input.kind === "pdf" && input.pdfBytes) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.pdfBytes.toString("base64"),
      },
    });
  } else {
    content.push({ type: "text", text: `Document follows:\n\n${input.text.slice(0, 20_000)}` });
  }

  const msg = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3500,
    messages: [
      {
        role: "user",
        content: content as unknown as Array<{ type: "text"; text: string }>,
      },
    ],
  });
  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  const m = text.match(/\{[\s\S]*\}\s*$/m) ?? text.match(/\{[\s\S]*\}/);
  if (!m) return deterministicParser(input);
  try {
    const raw = JSON.parse(m[0]);
    const validated = parserOutputSchema.safeParse(raw);
    if (validated.success) {
      // Still re-check allowed methods and categories — LLM might slip.
      return {
        partial: sanitizePartial(validated.data.partial) as ParserOutput["partial"],
        profile: validated.data.profile,
        gaps: [...validated.data.gaps, ...scoreGaps(validated.data.partial, validated.data.profile)],
        unsupported: [...validated.data.unsupported, ...scoreUnsupported(validated.data.partial)],
      };
    }
    return deterministicParser(input);
  } catch {
    return deterministicParser(input);
  }
};

export const parseUploadedPolicy = async (params: {
  filePath: string;
  mime: string;
}): Promise<ParserOutput> => {
  try {
    const normalized = await normalizeInput(params.filePath, params.mime);
    if (!normalized.text && normalized.kind !== "pdf") {
      return { ...EMPTY_PARSER_OUTPUT, gaps: [{ field: "document", reason: "empty or unreadable" }] };
    }
    return await withAnthropicFallback(
      () => liveParser(normalized),
      () => deterministicParser(normalized),
      "onboarding.parseUploadedPolicy",
    );
  } catch (e) {
    return {
      ...EMPTY_PARSER_OUTPUT,
      gaps: [{ field: "document", reason: (e as Error).message }],
    };
  }
};

export const isParserBarren = (out: ParserOutput): boolean => {
  const pol = out.partial ?? {};
  const hasRules = Array.isArray(pol.reserveRules) && pol.reserveRules.length > 0;
  const hasAnyNumber = pol.approvalThresholdEur !== undefined || pol.maxReservePerMonthEur !== undefined;
  const hasProfile = Object.keys(out.profile ?? {}).length > 0;
  return !hasRules && !hasAnyNumber && !hasProfile;
};
