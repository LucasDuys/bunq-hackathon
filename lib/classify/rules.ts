/**
 * Rule-first merchant classifier: regex → (category, subCategory).
 * Covers common Dutch/EU business merchants. LLM handles the rest.
 * See research/03-merchant-classification.md.
 */
export type Rule = {
  pattern: RegExp;
  category: string;
  subCategory: string | null;
  confidence: number;
};

export const RULES: Rule[] = [
  // Travel
  { pattern: /\b(klm|transavia|easyjet|ryanair|lufthansa|air france|iberia|vueling)\b/i, category: "travel", subCategory: "flight_shorthaul", confidence: 0.95 },
  { pattern: /\b(united airlines|delta|british airways|emirates|qatar)\b/i, category: "travel", subCategory: "flight_longhaul", confidence: 0.95 },
  { pattern: /\b(ns\.nl|ns international|deutsche bahn|db bahn|sncf|trenitalia|thalys|eurostar|ovpay|9292)\b/i, category: "travel", subCategory: "train", confidence: 0.95 },
  { pattern: /\b(booking\.com|hotels\.com|marriott|nh hotels|hilton|ibis|accor|airbnb)\b/i, category: "travel", subCategory: "hotel", confidence: 0.9 },
  { pattern: /\b(uber|bolt|taxi|mytaxi|free now)\b/i, category: "travel", subCategory: "taxi", confidence: 0.9 },
  { pattern: /\b(hertz|avis|sixt|europcar|enterprise rent)\b/i, category: "travel", subCategory: "rental_car", confidence: 0.95 },

  // Food
  { pattern: /\b(albert heijn|jumbo|lidl|aldi|plus supermarkt|carrefour|rewe)\b/i, category: "food", subCategory: "groceries", confidence: 0.9 },
  { pattern: /\b(thuisbezorgd|deliveroo|uber eats|flink|gorillas|getir)\b/i, category: "food", subCategory: "restaurant_mixed", confidence: 0.85 },
  { pattern: /\b(starbucks|coffee|espresso|cafe\b|café|bakker)\b/i, category: "food", subCategory: "restaurant_mixed", confidence: 0.8 },
  { pattern: /\b(loetje|the butcher|beefeater|steakhouse|grill)\b/i, category: "food", subCategory: "restaurant_meat", confidence: 0.85 },
  { pattern: /\b(meatless|vegan|plantbased|hummus|sla\b)\b/i, category: "food", subCategory: "restaurant_plant", confidence: 0.85 },
  { pattern: /\b(catering|lunchroom|company catering)\b/i, category: "food", subCategory: "catering", confidence: 0.8 },

  // Cloud / IT
  { pattern: /\b(aws|amazon web services|amazonaws)\b/i, category: "cloud", subCategory: "compute_eu", confidence: 0.8 },
  { pattern: /\b(gcp|google cloud|google.*cloud)\b/i, category: "cloud", subCategory: "compute_eu", confidence: 0.8 },
  { pattern: /\b(azure|microsoft.*cloud)\b/i, category: "cloud", subCategory: "compute_eu", confidence: 0.8 },
  { pattern: /\b(vercel|netlify|cloudflare|digitalocean|hetzner|ovh)\b/i, category: "cloud", subCategory: "compute_eu", confidence: 0.9 },
  { pattern: /\b(github|gitlab|bitbucket)\b/i, category: "cloud", subCategory: "saas", confidence: 0.95 },
  { pattern: /\b(notion|figma|linear|slack|zoom|atlassian|jira|confluence|asana|miro|intercom|hubspot|salesforce)\b/i, category: "cloud", subCategory: "saas", confidence: 0.95 },
  { pattern: /\b(openai|anthropic|replicate|modal labs)\b/i, category: "cloud", subCategory: "saas", confidence: 0.9 },

  // Procurement
  { pattern: /\bamazon(?!aws)(?!.*web)\b/i, category: "procurement", subCategory: null, confidence: 0.4 }, // ambiguous
  { pattern: /\b(mediamarkt|coolblue|bol\.com|apple store|dell|lenovo|hp inc)\b/i, category: "procurement", subCategory: "electronics", confidence: 0.9 },
  { pattern: /\b(staples|viking direct|bruna|ikea|office depot)\b/i, category: "procurement", subCategory: "office_supplies", confidence: 0.9 },

  // Services
  { pattern: /\b(kvk|notaris|lawyer|advocat|legal)\b/i, category: "services", subCategory: "legal", confidence: 0.9 },
  { pattern: /\b(accountant|boekhouder|deloitte|kpmg|pwc|ey)\b/i, category: "services", subCategory: "professional", confidence: 0.9 },
  { pattern: /\b(google ads|facebook ads|meta ads|linkedin ads|tiktok ads)\b/i, category: "services", subCategory: "marketing", confidence: 0.95 },

  // Fuel & utilities
  { pattern: /\b(shell|bp\b|esso|total|texaco|gulf)\b/i, category: "fuel", subCategory: "petrol", confidence: 0.9 },
  { pattern: /\b(vattenfall|eneco|essent|greenchoice|nuon)\b/i, category: "utilities", subCategory: "electricity", confidence: 0.9 },
];

export type RuleMatch = {
  category: string;
  subCategory: string | null;
  confidence: number;
};

export const tryRules = (merchant: string): RuleMatch | null => {
  for (const r of RULES) {
    if (r.pattern.test(merchant)) return { category: r.category, subCategory: r.subCategory, confidence: r.confidence };
  }
  return null;
};

export const normalizeMerchant = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[*#]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(nl|be|de|fr|eu|inc|bv|gmbh|ltd|sarl)\b\.?$/i, "")
    .trim();
