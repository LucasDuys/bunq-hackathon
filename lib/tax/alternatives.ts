/**
 * Maps high-emission factor IDs to their lower-emission alternatives.
 * Each entry: "if you're spending on X, switching to Y saves Z% emissions."
 *
 * Used to generate actionable "switch" recommendations on the dashboard.
 */

export type GreenAlternative = {
  fromFactorId: string;
  toFactorId: string;
  /** Human-readable switch description */
  switchLabel: string;
  /** Typical price ratio: alternative / current (1.0 = same cost, 0.8 = 20% cheaper) */
  priceRatio: number;
  /** Whether the switch typically qualifies for NL tax incentives */
  taxIncentiveIds: string[];
};

export const GREEN_ALTERNATIVES: GreenAlternative[] = [
  // Travel
  {
    fromFactorId: "travel.flight_shorthaul",
    toFactorId: "travel.train",
    switchLabel: "Short-haul flights → train (e.g., Amsterdam–Paris by Thalys)",
    priceRatio: 0.7,
    taxIncentiveIds: ["eu_ets_passthrough"],
  },
  {
    fromFactorId: "travel.flight_longhaul",
    toFactorId: "travel.train",
    switchLabel: "Long-haul flights → rail where possible (e.g., intra-EU routes)",
    priceRatio: 0.6,
    taxIncentiveIds: ["eu_ets_passthrough"],
  },
  {
    fromFactorId: "travel.taxi",
    toFactorId: "travel.train",
    switchLabel: "Taxi/rideshare → public transport",
    priceRatio: 0.3,
    taxIncentiveIds: [],
  },
  {
    fromFactorId: "travel.rental_car",
    toFactorId: "travel.train",
    switchLabel: "Rental car → rail + local transit",
    priceRatio: 0.5,
    taxIncentiveIds: ["nl_mia"],
  },

  // Food
  {
    fromFactorId: "food.restaurant_meat",
    toFactorId: "food.restaurant_plant",
    switchLabel: "Meat-heavy catering → plant-forward meals",
    priceRatio: 0.7,
    taxIncentiveIds: [],
  },
  {
    fromFactorId: "food.catering",
    toFactorId: "food.restaurant_plant",
    switchLabel: "Standard catering → plant-forward catering",
    priceRatio: 0.85,
    taxIncentiveIds: [],
  },

  // Utilities & fuel
  {
    fromFactorId: "utilities.gas",
    toFactorId: "utilities.electricity",
    switchLabel: "Gas heating → electric heat pump (green contract)",
    priceRatio: 0.9,
    taxIncentiveIds: ["nl_eia", "nl_mia", "nl_vamil"],
  },
  {
    fromFactorId: "fuel.petrol",
    toFactorId: "utilities.electricity",
    switchLabel: "Petrol fleet → EV fleet (charge on green electricity)",
    priceRatio: 0.6,
    taxIncentiveIds: ["nl_eia", "nl_mia", "nl_vamil", "eu_ets_passthrough"],
  },
  {
    fromFactorId: "fuel.diesel",
    toFactorId: "utilities.electricity",
    switchLabel: "Diesel fleet → EV fleet",
    priceRatio: 0.6,
    taxIncentiveIds: ["nl_eia", "nl_mia", "nl_vamil", "eu_ets_passthrough"],
  },

  // Cloud & IT
  {
    fromFactorId: "cloud.compute_high",
    toFactorId: "cloud.compute_eu",
    switchLabel: "High-carbon cloud region → EU green-powered region",
    priceRatio: 1.0,
    taxIncentiveIds: ["nl_eia"],
  },

  // Procurement
  {
    fromFactorId: "procurement.office_supplies",
    toFactorId: "procurement.software",
    switchLabel: "Paper-based processes → digital-first",
    priceRatio: 0.5,
    taxIncentiveIds: [],
  },
];

export const alternativeFor = (factorId: string): GreenAlternative | undefined =>
  GREEN_ALTERNATIVES.find((a) => a.fromFactorId === factorId);

export const alternativesForCategory = (category: string): GreenAlternative[] =>
  GREEN_ALTERNATIVES.filter((a) => a.fromFactorId.startsWith(category + "."));
