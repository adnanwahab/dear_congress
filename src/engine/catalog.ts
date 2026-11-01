import type { NeedDef, Proposal } from "./types";

export const CHANGE_LEVELS = [
  "Administrative adjustment",
  "Agency rule change",
  "Budget change",
  "Statutory amendment",
  "New program",
  "New agency",
  "Constitutional amendment",
];

export const NEEDS: NeedDef[] = [
  {
    id: "childcare",
    label: "Affordable childcare",
    value: "Family stability",
    goal: "Childcare should cost less than 10% of a typical family's income",
    metric: "Median childcare cost as % of household income",
    level: "Federal / State",
    keywords: ["childcare", "child care", "daycare", "day care", "preschool", "pre-k", "babysit", "after-school", "after school", "toddler"],
  },
  {
    id: "housing",
    label: "Housing affordability",
    value: "Family stability",
    goal: "Rent should take less than 30% of a typical renter's income",
    metric: "Median rent burden",
    level: "City / Federal",
    keywords: ["rent", "housing", "landlord", "apartment", "evict", "mortgage", "home prices", "afford a house", "lease", "homeless"],
  },
  {
    id: "transit",
    label: "Reliable transit",
    value: "Opportunity & mobility",
    goal: "A frequent bus within a 10-minute walk for most residents",
    metric: "% of residents within 10 min of 15-minute-frequency service",
    level: "City / Federal",
    keywords: ["bus", "transit", "train", "commute", "traffic", "metro", "light rail", "car payment", "freeway"],
  },
  {
    id: "healthcare",
    label: "Affordable healthcare",
    value: "Health & security",
    goal: "No one skips care because of cost",
    metric: "% of adults delaying care due to cost",
    level: "State / Federal",
    keywords: ["doctor", "hospital", "deductible", "medical", "prescription", "clinic", "healthcare", "health care", "er visit", "copay", "primary care"],
  },
  {
    id: "mental_health",
    label: "Mental-health access",
    value: "Health & security",
    goal: "A first therapy appointment within 2 weeks",
    metric: "Median wait for a first appointment",
    level: "State / Federal",
    keywords: ["therapist", "therapy", "mental health", "anxiety", "depression", "counselor", "psychiatrist", "burnout"],
  },
  {
    id: "small_business",
    label: "Small-business burden",
    value: "Opportunity",
    goal: "Tax and payroll compliance under 10 hours a month for small employers",
    metric: "Compliance hours per small employer",
    level: "Federal",
    keywords: ["small business", "payroll", "restaurant", "my shop", "hire", "hiring", "paperwork", "self-employed", "quarterly taxes", "contractor"],
  },
  {
    id: "flooding",
    label: "Flood protection",
    value: "Safety",
    goal: "Fewer homes flooded in a major storm",
    metric: "Structures flooded per major storm",
    level: "County",
    keywords: ["flood", "drainage", "bayou", "hurricane", "harvey", "high water", "storm"],
  },
  {
    id: "insurance",
    label: "Property insurance costs",
    value: "Security",
    goal: "Home insurance premiums grow no faster than inflation",
    metric: "Median premium growth vs. CPI",
    level: "State",
    keywords: ["homeowners insurance", "home insurance", "premium", "insurer", "policy was cancelled", "policy got cancelled", "windstorm"],
  },
  {
    id: "streets",
    label: "Street maintenance",
    value: "Safety",
    goal: "Reported street hazards fixed within 30 days",
    metric: "Median days to resolve 311 street reports",
    level: "City",
    keywords: ["pothole", "streetlight", "street light", "sidewalk", "crosswalk", "road repair", "311"],
  },
  {
    id: "fiscal",
    label: "Lower taxes & fiscal restraint",
    value: "Fiscal responsibility",
    goal: "Tax burden doesn't rise, and new spending is paid for",
    metric: "Tax burden as % of median income; deficit trend",
    level: "Federal / State",
    keywords: ["taxes", "tax bill", "property tax", "deficit", "debt", "government spending", "wasteful", "balanced budget", "fixed income"],
  },
  {
    id: "food_access",
    label: "Food access",
    value: "Health & security",
    goal: "No household goes a day without groceries at home",
    metric: "% of households reporting an empty fridge or skipped meals in the past week",
    level: "City / County",
    keywords: ["fridge", "groceries", "grocery", "food bank", "pantry", "ran out of food", "out of food", "skipped meals", "skip meals", "hungry", "empty shelves", "food desert", "food access", "food insecurity", "nutritious", "nutrition", "healthy food", "afford food", "fresh food"],
  },
];

const p = (x: Proposal) => x;

export const PROPOSALS: Proposal[] = [
  // Childcare
  p({ id: "cc_credit", needId: "childcare", title: "Expand the Child and Dependent Care Tax Credit", mechanism: "IRS tax credit", authority: "Congress → IRS", jurisdiction: "United States", costB: 18.2, changeLevel: 3, reversibility: 0.6, evidence: 0.7, effectiveness: 0.65, keywords: ["tax credit", "credit", "refundable", "tax break"], metrics: ["median_childcare_cost", "maternal_labor_participation"], legalChange: "Statutory amendment (26 U.S.C. § 21)" }),
  p({ id: "cc_subsidy", needId: "childcare", title: "Direct childcare subsidies for families under 200% of median income, paid to existing providers", mechanism: "CCDBG block grants to states", authority: "HHS → state agencies", jurisdiction: "United States", costB: 24, changeLevel: 2, reversibility: 0.7, evidence: 0.75, effectiveness: 0.8, keywords: ["subsid", "reimburse", "pay providers", "below 200", "under 200"], metrics: ["median_childcare_cost", "childcare_provider_capacity"], legalChange: "Appropriations increase" }),
  p({ id: "cc_licensing", needId: "childcare", title: "Streamline licensing for small home-based daycares", mechanism: "State licensing rule change", authority: "Texas HHSC", jurisdiction: "Texas", costB: 0.05, changeLevel: 1, reversibility: 0.9, evidence: 0.55, effectiveness: 0.45, keywords: ["licens", "regulat", "home daycare", "red tape", "easier to start", "waitlist"], metrics: ["licensed_home_providers", "childcare_waitlist_length"], legalChange: "Agency rule change" }),
  p({ id: "cc_public", needId: "childcare", title: "Build public childcare centers", mechanism: "New federal program", authority: "Congress → HHS", jurisdiction: "United States", costB: 60, changeLevel: 4, reversibility: 0.3, evidence: 0.5, effectiveness: 0.85, keywords: ["public childcare", "universal", "government-run", "free childcare", "public daycare"], metrics: ["median_childcare_cost", "childcare_slots_per_1000_children"], legalChange: "New authorizing statute" }),

  // Housing
  p({ id: "h_transit", needId: "housing", title: "Grants for cities that permit multifamily housing near transit", mechanism: "HUD / DOT competitive grants", authority: "HUD, DOT", jurisdiction: "United States", costB: 1.8, changeLevel: 2, reversibility: 0.75, evidence: 0.6, effectiveness: 0.55, keywords: ["near transit", "multifamily", "build more", "density", "supply"], metrics: ["housing_units_permitted", "median_rent_burden"], legalChange: "Appropriations + grant criteria" }),
  p({ id: "h_lots", needId: "housing", title: "Reduce minimum lot sizes and parking mandates", mechanism: "City ordinance", authority: "Houston City Council", jurisdiction: "Houston", costB: 0, changeLevel: 1, reversibility: 0.8, evidence: 0.7, effectiveness: 0.45, keywords: ["lot size", "parking minimum", "parking mandate", "adu", "townhome", "allow more homes", "zoning"], metrics: ["housing_units_permitted", "median_new_home_price"], legalChange: "Municipal ordinance amendment" }),
  p({ id: "h_vouchers", needId: "housing", title: "Expand housing vouchers in high-cost areas", mechanism: "Housing Choice Vouchers", authority: "HUD → local housing authorities", jurisdiction: "United States", costB: 12, changeLevel: 2, reversibility: 0.7, evidence: 0.8, effectiveness: 0.7, keywords: ["voucher", "section 8", "rental assistance", "help with rent"], metrics: ["median_rent_burden", "eviction_filings"], legalChange: "Appropriations increase" }),
  p({ id: "h_residency", needId: "housing", title: "Limit new housing vouchers to residents of 10+ years", mechanism: "State eligibility rule", authority: "Texas Legislature", jurisdiction: "Texas", costB: 0.5, changeLevel: 3, reversibility: 0.5, evidence: 0.2, effectiveness: 0.2, keywords: ["long-time residents", "newcomers", "residency requirement", "people moving here"], metrics: ["voucher_recipients_by_tenure"], legalChange: "Statutory amendment", rightsIssue: "Durational residency requirements for public benefits burden the constitutional right to travel and raise equal-protection problems (see Shapiro v. Thompson, 1969)." }),

  // Transit
  p({ id: "t_bus", needId: "transit", title: "Competitive federal grants for high-frequency urban bus service", mechanism: "DOT / FTA transit grants", authority: "DOT / FTA", jurisdiction: "United States", costB: 4.1, changeLevel: 2, reversibility: 0.8, evidence: 0.7, effectiveness: 0.65, keywords: ["bus", "frequen", "every 10 minutes", "more buses", "routes"], metrics: ["residents_near_frequent_service", "transit_ridership"], legalChange: "Grant program criteria" }),
  p({ id: "t_brt", needId: "transit", title: "Bus rapid transit on the three busiest corridors", mechanism: "Transit authority capital plan", authority: "METRO (Houston)", jurisdiction: "Houston", costB: 0.6, changeLevel: 2, reversibility: 0.5, evidence: 0.65, effectiveness: 0.55, keywords: ["bus rapid", "brt", "dedicated lane", "bus lane", "light rail", "train"], metrics: ["corridor_travel_time", "transit_ridership"], legalChange: "Board-approved capital plan" }),

  // Healthcare
  p({ id: "hc_chc", needId: "healthcare", title: "Expand community health center funding", mechanism: "HRSA health center grants", authority: "HRSA", jurisdiction: "United States", costB: 6, changeLevel: 2, reversibility: 0.8, evidence: 0.8, effectiveness: 0.6, keywords: ["clinic", "community health", "preventive", "primary care", "walk-in"], metrics: ["adults_delaying_care", "er_visits_for_primary_care"], legalChange: "Appropriations increase" }),
  p({ id: "hc_public", needId: "healthcare", title: "Create a public health-insurance option", mechanism: "New federal program", authority: "Congress → CMS", jurisdiction: "United States", costB: 80, changeLevel: 4, reversibility: 0.3, evidence: 0.55, effectiveness: 0.8, keywords: ["public option", "medicare for all", "single payer", "government insurance"], metrics: ["uninsured_rate", "adults_delaying_care"], legalChange: "New authorizing statute" }),

  // Mental health
  p({ id: "mh_workforce", needId: "mental_health", title: "Mental-health workforce grants and loan repayment", mechanism: "HRSA / SAMHSA grants", authority: "HRSA, SAMHSA", jurisdiction: "United States", costB: 2.5, changeLevel: 2, reversibility: 0.8, evidence: 0.7, effectiveness: 0.6, keywords: ["therapist", "more counselors", "workforce", "loan repayment", "shortage", "waitlist"], metrics: ["median_wait_first_appointment", "providers_per_100k"], legalChange: "Appropriations increase" }),
  p({ id: "mh_988", needId: "mental_health", title: "Fund the 988 crisis line and mobile crisis teams", mechanism: "SAMHSA grants to states", authority: "SAMHSA", jurisdiction: "United States", costB: 1, changeLevel: 2, reversibility: 0.8, evidence: 0.65, effectiveness: 0.5, keywords: ["988", "crisis", "hotline", "mobile crisis"], metrics: ["crisis_response_time"], legalChange: "Appropriations increase" }),

  // Small business
  p({ id: "sb_filing", needId: "small_business", title: "Simplify small-business tax filing into one quarterly form", mechanism: "IRS administrative change", authority: "IRS", jurisdiction: "United States", costB: 0.2, changeLevel: 1, reversibility: 0.9, evidence: 0.6, effectiveness: 0.55, keywords: ["simplif", "paperwork", "filing", "forms", "one form"], metrics: ["compliance_hours_small_employer"], legalChange: "Agency rule / form change" }),
  p({ id: "sb_payroll", needId: "small_business", title: "Payroll tax credit for employers with fewer than 25 workers", mechanism: "IRS payroll tax credit", authority: "Congress → IRS", jurisdiction: "United States", costB: 9, changeLevel: 3, reversibility: 0.6, evidence: 0.55, effectiveness: 0.6, keywords: ["payroll tax", "hiring credit", "cost of hiring", "employer credit"], metrics: ["small_employer_hiring", "small_business_survival_rate"], legalChange: "Statutory amendment" }),

  // Flooding
  p({ id: "f_drainage", needId: "flooding", title: "Accelerate bayou drainage and detention projects", mechanism: "County flood bond program", authority: "Harris County Flood Control District", jurisdiction: "Harris County", costB: 2, changeLevel: 2, reversibility: 0.4, evidence: 0.75, effectiveness: 0.7, keywords: ["drainage", "detention", "bayou", "widen", "flood control"], metrics: ["structures_flooded_per_storm"], legalChange: "Commissioners Court budget action" }),
  p({ id: "f_buyouts", needId: "flooding", title: "Voluntary buyouts for repeatedly flooded homes", mechanism: "FEMA hazard mitigation grants", authority: "FEMA → county", jurisdiction: "United States", costB: 1.5, changeLevel: 2, reversibility: 0.5, evidence: 0.7, effectiveness: 0.55, keywords: ["buyout", "buy out", "move people", "repeatedly flooded"], metrics: ["repetitive_loss_properties"], legalChange: "Grant application (existing program)" }),

  // Insurance
  p({ id: "i_roofs", needId: "insurance", title: "Grants for storm-fortified roofs that lower premiums", mechanism: "State insurance department grant", authority: "Texas Department of Insurance", jurisdiction: "Texas", costB: 0.4, changeLevel: 2, reversibility: 0.8, evidence: 0.65, effectiveness: 0.5, keywords: ["roof", "fortified", "mitigation", "harden"], metrics: ["median_premium_growth_vs_cpi", "fortified_homes"], legalChange: "Appropriations increase" }),
  p({ id: "i_reinsurance", needId: "insurance", title: "State catastrophe reinsurance pool", mechanism: "New state program", authority: "Texas Legislature", jurisdiction: "Texas", costB: 3, changeLevel: 4, reversibility: 0.4, evidence: 0.5, effectiveness: 0.65, keywords: ["reinsurance", "state pool", "backstop", "public insurance"], metrics: ["median_premium_growth_vs_cpi", "insurer_market_exits"], legalChange: "New state statute" }),

  // Streets
  p({ id: "s_311", needId: "streets", title: "30-day service standard for 311 street repairs", mechanism: "Public Works service standard", authority: "Houston Public Works", jurisdiction: "Houston", costB: 0.05, changeLevel: 0, reversibility: 1, evidence: 0.6, effectiveness: 0.7, keywords: ["311", "fix", "faster", "pothole", "streetlight", "repair"], metrics: ["median_days_to_resolve_311"], legalChange: "None (administrative)" }),

  // Food access
  p({ id: "g_delivery", needId: "food_access", title: "Grocery delivery for households that are running out of food", mechanism: "City / county food-access program (delivery partnered with food banks and grocers)", authority: "Houston Health Department / Harris County Public Health", jurisdiction: "Houston", costB: 0.3, changeLevel: 2, reversibility: 0.8, evidence: 0.5, effectiveness: 0.6, keywords: ["delivery", "deliver", "grocery delivery", "pantry", "food bank", "meals"], metrics: ["households_reporting_empty_fridge", "days_without_groceries"], legalChange: "Appropriations increase" }),

  // Fiscal
  p({ id: "fx_taxcut", needId: "fiscal", title: "Across-the-board 2-point income tax cut", mechanism: "Tax rate change", authority: "Congress", jurisdiction: "United States", costB: 40, changeLevel: 3, reversibility: 0.5, evidence: 0.5, effectiveness: 0.6, benefitsFiscal: true, keywords: ["tax cut", "cut taxes", "lower taxes", "lower rates"], metrics: ["tax_burden_median_household", "deficit"], legalChange: "Statutory amendment" }),
  p({ id: "fx_review", needId: "fiscal", title: "Annual spending review with automatic sunset of underperforming programs", mechanism: "Budget process rule", authority: "OMB / Congress", jurisdiction: "United States", costB: 0.1, changeLevel: 2, reversibility: 0.9, evidence: 0.6, effectiveness: 0.5, benefitsFiscal: true, keywords: ["waste", "audit", "sunset", "review", "accountab"], metrics: ["programs_meeting_targets", "deficit"], legalChange: "Budget process rule" }),
];

export const SEED_JOURNALS: { author: string; text: string }[] = [
  { author: "Maria · Alief", text: "I'm working two jobs and childcare costs $1,400 a month. I don't want to stop working, but daycare is eating most of my second paycheck." },
  { author: "Dev · Gulfton", text: "Traffic around here is awful. I wish there were a bus that came every 10 minutes instead of every 40." },
  { author: "Tony · Montrose", text: "I own a small restaurant and payroll taxes are already difficult. Please don't solve social programs by making it harder to hire people." },
  { author: "Linda · Meyerland", text: "Our street flooded again in May. Third time since Harvey. The drainage on our block just can't keep up." },
  { author: "Robert · Katy", text: "My homeowners insurance premium went up 40% this year and my policy was cancelled once already." },
  { author: "Jasmine · Midtown", text: "Rent went up $250 at renewal. I'm looking at apartments farther out but then the commute gets worse." },
  { author: "Sam · Heights", text: "Waited three months to see a therapist. My anxiety got worse while I waited." },
  { author: "Ahmed · Sharpstown", text: "There's a streetlight out on our corner for months and a pothole that keeps eating tires. I reported it to 311 twice." },
  { author: "Carol · Kingwood", text: "My property tax bill keeps climbing. I'm retired and on a fixed income. Please don't add more government spending." },
  { author: "Priya · Sugar Land", text: "The ER visit for my son cost $2,300 after insurance. We put off going to the doctor now unless it's an emergency." },
  { author: "Keisha · Third Ward", text: "I'd open a home daycare tomorrow if the licensing paperwork wasn't so brutal. There's a waitlist at every daycare near me." },
  { author: "Luis · East End", text: "I'm self-employed and filing quarterly taxes takes me a full weekend every time. The forms are a maze." },
  { author: "Hannah · Bellaire", text: "We pay $900 a month for childcare for our toddler and the preschool waitlist is a year long." },
  { author: "Marcus · Acres Homes", text: "I'd take the bus to work but the route takes 90 minutes. Driving costs me a car payment I can barely afford." },
  { author: "Grace · Pasadena", text: "My clinic closed and now the nearest primary care that takes my insurance is 40 minutes away." },
  { author: "Frank · Cypress", text: "I worry about the deficit. Every program sounds nice but someone has to pay for it. Too much wasteful government spending." },
  { author: "Nina · Rice Military", text: "Burnout at work is real. Our team has no access to a counselor and the waitlist is weeks." },
  { author: "Diego · Northside", text: "Landlord won't fix the AC and I can't afford to move. Rent is half my income." },
  { author: "Beth · Kashmere Gardens", text: "After the last hurricane our neighborhood had high water for days. We need better drainage, not just promises." },
  { author: "Omar · Alief", text: "I want my kids to have pre-k but I also want to choose where they go, not be forced into a government program." },
];
