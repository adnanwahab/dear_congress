---
schema: civic-synthesis-bill-collection/v1
collection_id: eudaimonia-100
collection_title: 100 Bills for Human Flourishing
version: 1
date: 2026-11-13
language: en-US
source_type: editorial_policy_concepts
record_type: draft_proposals_not_enacted_law
initial_publication: unreviewed_catalog
votes: advisory_only
costs: unestimated
impact_evidence: requires_independent_review
---

# 100 Bills for Human Flourishing

A catalog of **100 original policy concepts**, organized around *eudaimonia*: health, security, agency, meaningful work, learning, social connection, justice, and the natural world.

> **Important:** These are discussion drafts—not introduced congressional legislation, enacted laws, election measures, costed forecasts, or official government endorsements. Jurisdiction is the suggested primary level of government and needs legal review. Every impact claim, cost, and constitutional issue must be assessed before legislative publication. An advisory vote is not a verified election.

## Import contract (for Civic Synthesis)

* Parse YAML front matter between the first `---` markers for collection metadata.
* A category starts with a level-two heading `## ` other than this section and the Appendix.
* A bill begins with `### HFL-001: Title` (exactly three digits). ID is stable and unique.
* Every bill has exactly six field bullets: `Jurisdiction`, `Problem`, `Proposed change`, `Trade-offs and safeguards`, `Success metrics`, and `Flourishing dimensions`.
* Use the bill heading for `title` and the immediately preceding category heading for `category`.
* Treat all values as **untrusted plain text**: validate length and render escaped; do not execute inline code or HTML.
* Preserve IDs during reimport and update content idempotently. Never reset or attribute votes to simulated people.
* Show these first as **curated drafts**, separate from user-authored proposals and real enacted legislation. Require authorized review before any transition to the public advisory ballot.
* Treat unestimated fiscal costs and unreviewed evidence as **unknown**, not zero or positive.

## Economic security and freedom from desperation

### HFL-001: Automatic Benefits Enrollment Act

* **Jurisdiction:** federal
* **Problem:** Eligible people miss benefits because applications are complex.
* **Proposed change:** Offer automated eligibility checks and opt-in enrollment for existing benefits, with secure records and clear appeals.
* **Trade-offs and safeguards:** Prevent incorrect enrollment, intrusive data sharing, and mistaken eligibility decisions.
* **Success metrics:** Eligible residents receiving benefits; application hours saved.
* **Flourishing dimensions:** Economic security; Agency

### HFL-002: Child Poverty Reduction Act

* **Jurisdiction:** federal
* **Problem:** Child poverty undermines health, stability, and opportunity.
* **Proposed change:** Create a refundable monthly child tax credit that reaches families with the lowest incomes.
* **Trade-offs and safeguards:** Assess fiscal cost, benefit phase-outs, and interactions with other assistance.
* **Success metrics:** Child poverty rate; material hardship among families.
* **Flourishing dimensions:** Economic security; Health

### HFL-003: Make Work Pay Act

* **Jurisdiction:** federal
* **Problem:** Low-wage work can leave households unable to meet essential expenses.
* **Proposed change:** Expand earned-income tax credits, including support for workers without dependent children.
* **Trade-offs and safeguards:** Design smooth phase-outs and guard against filing complexity and fraud.
* **Success metrics:** After-tax income of low-wage workers; take-up rates.
* **Flourishing dimensions:** Economic security; Agency

### HFL-004: Free Automatic Tax Filing Act

* **Jurisdiction:** federal
* **Problem:** Routine tax filings consume time and money.
* **Proposed change:** Provide free prefilled tax returns when government information is sufficient, with correction and opt-out routes.
* **Trade-offs and safeguards:** Protect sensitive data and preserve choice of tax preparer.
* **Success metrics:** Median filing time; taxpayer error rate; total filing cost.
* **Flourishing dimensions:** Time; Economic security

### HFL-005: Emergency Savings Act

* **Jurisdiction:** federal
* **Problem:** Small financial shocks can trigger costly debt and instability.
* **Proposed change:** Match qualified savings for lower-income households up to a modest emergency reserve.
* **Trade-offs and safeguards:** Ensure withdrawals remain accessible and program administration is affordable.
* **Success metrics:** Households with emergency reserves; high-cost borrowing incidence.
* **Flourishing dimensions:** Economic security; Agency

### HFL-006: Anti-Predatory Lending Act

* **Jurisdiction:** federal
* **Problem:** High-cost lending can trap borrowers in repeated debt.
* **Proposed change:** Limit exploitative financing charges, disclose total costs clearly, and expand affordable lending options.
* **Trade-offs and safeguards:** Monitor credit availability so restrictions do not push borrowers into worse alternatives.
* **Success metrics:** Repeat high-cost borrowing; loan default rates.
* **Flourishing dimensions:** Economic security; Justice

### HFL-007: Proportional Fines Act

* **Jurisdiction:** state
* **Problem:** Fixed civil penalties can be devastating to low-income people.
* **Proposed change:** Introduce means-sensitive civil fines for suitable offenses and fair ability-to-pay hearings.
* **Trade-offs and safeguards:** Protect equal treatment and avoid collecting more personal financial information than necessary.
* **Success metrics:** Fine-related defaults; collection costs; appeals outcomes.
* **Flourishing dimensions:** Justice; Economic security

### HFL-008: Medical Debt Relief Act

* **Jurisdiction:** federal
* **Problem:** Medical bills can produce prolonged financial hardship.
* **Proposed change:** Restrict abusive medical-debt collection and provide income-sensitive repayment and hardship protections.
* **Trade-offs and safeguards:** Define eligible debts carefully and examine consequences for care prices and providers.
* **Success metrics:** Medical-debt delinquency; household financial distress.
* **Flourishing dimensions:** Economic security; Health

### HFL-009: Portable Benefits Act

* **Jurisdiction:** federal
* **Problem:** Changing jobs can disrupt benefits and savings.
* **Proposed change:** Make retirement saving and specified worker benefits portable across employers and eligible independent work.
* **Trade-offs and safeguards:** Prevent employers from replacing protected employment benefits with weaker arrangements.
* **Success metrics:** Benefit coverage across job transitions; retirement contributions.
* **Flourishing dimensions:** Agency; Economic security

### HFL-010: Start a Business in One Day Act

* **Jurisdiction:** state
* **Problem:** Unnecessary registration delays discourage entrepreneurship.
* **Proposed change:** Create a consolidated online registration process and simpler rules for genuinely low-risk businesses.
* **Trade-offs and safeguards:** Retain safety, labor, tax, and consumer protections where needed.
* **Success metrics:** Median business registration time; startup compliance cost.
* **Flourishing dimensions:** Agency; Economic security

## Housing and livable cities

### HFL-011: Freedom to Build Housing Act

* **Jurisdiction:** state
* **Problem:** Housing shortages push rents and prices beyond many households' reach.
* **Proposed change:** Enable more homes and mixed-use development near jobs and transit where infrastructure allows.
* **Trade-offs and safeguards:** Account for displacement, utilities, local governance, and infrastructure capacity.
* **Success metrics:** Homes permitted; rent burden; construction completion time.
* **Flourishing dimensions:** Economic security; Time; Environment

### HFL-012: Backyard Homes Act

* **Jurisdiction:** state
* **Problem:** Restrictive zoning blocks small, flexible housing options.
* **Proposed change:** Allow code-compliant accessory dwelling units on residential properties.
* **Trade-offs and safeguards:** Maintain fire access, habitability, and reasonable infrastructure requirements.
* **Success metrics:** Accessory units completed; median housing costs.
* **Flourishing dimensions:** Economic security; Agency

### HFL-013: 30-Day Permit Decision Act

* **Jurisdiction:** city
* **Problem:** Unpredictable permit delays add cost to housing construction.
* **Proposed change:** Set service deadlines for routine, complete residential permit applications without waiving safety review.
* **Trade-offs and safeguards:** Fund permitting offices and define exceptions for complex proposals.
* **Success metrics:** Median permit processing days; reversal and safety outcomes.
* **Flourishing dimensions:** Economic security; Time

### HFL-014: Public Land for Homes Act

* **Jurisdiction:** federal
* **Problem:** Unused suitable public land could support needed housing.
* **Proposed change:** Offer surplus public parcels through transparent processes prioritizing durable affordability and mixed-income homes.
* **Trade-offs and safeguards:** Safeguard ecological, public-access, and community uses; prevent sweetheart deals.
* **Success metrics:** Affordable homes delivered; public land value retained.
* **Flourishing dimensions:** Economic security; Justice

### HFL-015: Housing First Stabilization Act

* **Jurisdiction:** federal
* **Problem:** People experiencing chronic homelessness struggle to regain stability.
* **Proposed change:** Expand permanent supportive housing paired with voluntary, individualized health and social services.
* **Trade-offs and safeguards:** Provide long-term services and evaluate local outcomes rather than assuming one model fits all.
* **Success metrics:** Chronic homelessness; housing retention; emergency-service use.
* **Flourishing dimensions:** Health; Economic security; Justice

### HFL-016: Honest Rent Pricing Act

* **Jurisdiction:** state
* **Problem:** Hidden mandatory fees make housing prices difficult to compare.
* **Proposed change:** Require rental listings to disclose the total mandatory recurring cost and key one-time fees.
* **Trade-offs and safeguards:** Keep disclosures consistent without obscuring legitimate optional charges.
* **Success metrics:** Disclosed all-in rents; fee-related complaints.
* **Flourishing dimensions:** Economic security; Agency

### HFL-017: Prevent Homelessness Before It Happens Act

* **Jurisdiction:** state
* **Problem:** Temporary shocks can trigger eviction and loss of housing.
* **Proposed change:** Provide targeted emergency rental aid, mediation, and eviction diversion for households at acute risk.
* **Trade-offs and safeguards:** Target assistance fairly and test whether interventions prevent homelessness cost-effectively.
* **Success metrics:** Evictions avoided; returns to stable housing.
* **Flourishing dimensions:** Economic security; Health

### HFL-018: Healthy Homes Act

* **Jurisdiction:** state
* **Problem:** Unsafe housing exposes residents to lead, mold, and other hazards.
* **Proposed change:** Require effective remediation of serious hazards with assistance for qualifying property owners and tenants.
* **Trade-offs and safeguards:** Avoid displacing tenants during repairs and make inspections reliable.
* **Success metrics:** Hazard remediation rates; housing-related illness.
* **Flourishing dimensions:** Health; Justice

### HFL-019: Walkable Neighborhoods Act

* **Jurisdiction:** city
* **Problem:** Car-dependent neighborhoods limit access to everyday essentials.
* **Proposed change:** Support safe sidewalks, connected crossings, mixed-use destinations, and accessible routes.
* **Trade-offs and safeguards:** Adapt designs to local needs, disability access, and maintenance budgets.
* **Success metrics:** Residents with safe walking access to services; pedestrian injuries.
* **Flourishing dimensions:** Health; Time; Relationships

### HFL-020: Climate-Resilient Homes Act

* **Jurisdiction:** federal
* **Problem:** Flood, heat, and storm exposure threaten household security.
* **Proposed change:** Offer targeted grants for insulation, flood protection, storm resilience, and efficient cooling.
* **Trade-offs and safeguards:** Use transparent risk criteria and avoid subsidizing unsafe rebuilding repeatedly.
* **Success metrics:** Homes retrofitted; disaster losses; indoor heat exposure.
* **Flourishing dimensions:** Health; Environment; Economic security

## Physical and mental health

### HFL-021: Affordable Essential Healthcare Act

* **Jurisdiction:** federal
* **Problem:** People delay necessary care because of coverage gaps and cost.
* **Proposed change:** Offer affordable access to essential preventive, primary, and catastrophic care through coverage reforms.
* **Trade-offs and safeguards:** Compare financing pathways, provider capacity, and fiscal sustainability.
* **Success metrics:** Care delayed due to cost; preventable hospitalizations.
* **Flourishing dimensions:** Health; Economic security

### HFL-022: Primary Care Everywhere Act

* **Jurisdiction:** federal
* **Problem:** Underserved communities lack timely access to primary care.
* **Proposed change:** Expand clinics and medical training incentives in areas with documented service shortages.
* **Trade-offs and safeguards:** Avoid building facilities without a sustainable clinical workforce.
* **Success metrics:** Primary care appointment waits; clinician access by region.
* **Flourishing dimensions:** Health; Justice

### HFL-023: Mental Health Parity Enforcement Act

* **Jurisdiction:** federal
* **Problem:** Mental healthcare coverage can be harder to use than physical healthcare coverage.
* **Proposed change:** Audit and enforce existing mental-health parity standards, with meaningful remedies for violations.
* **Trade-offs and safeguards:** Measure real appointment access, not just written insurance policies.
* **Success metrics:** Mental-health claim denials; wait times; parity compliance.
* **Flourishing dimensions:** Health; Justice

### HFL-024: Community Mental Health Crisis Response Act

* **Jurisdiction:** county
* **Problem:** Traditional emergency responses are not always suited to behavioral-health crises.
* **Proposed change:** Fund trained mental-health crisis response teams and coordinated emergency pathways.
* **Trade-offs and safeguards:** Protect responders and patients; ensure escalation for acute safety threats.
* **Success metrics:** Safe crisis resolutions; repeat emergency calls; response time.
* **Flourishing dimensions:** Health; Justice

### HFL-025: Healthy Mothers and Babies Act

* **Jurisdiction:** federal
* **Problem:** Families face avoidable gaps in prenatal and postpartum support.
* **Proposed change:** Increase access to prenatal, postpartum, and voluntary family support services.
* **Trade-offs and safeguards:** Respect patient choice and tailor care for rural and high-risk communities.
* **Success metrics:** Maternal morbidity; postpartum care access; infant outcomes.
* **Flourishing dimensions:** Health; Justice

### HFL-026: Addiction Recovery Access Act

* **Jurisdiction:** federal
* **Problem:** Evidence-based addiction treatment is often difficult to obtain.
* **Proposed change:** Expand medication-assisted treatment, counseling, recovery support, and appropriate diversion programs.
* **Trade-offs and safeguards:** Protect voluntary informed care and monitor treatment quality.
* **Success metrics:** Treatment initiation and retention; overdose deaths.
* **Flourishing dimensions:** Health; Agency

### HFL-027: Preventive Healthcare Access Act

* **Jurisdiction:** federal
* **Problem:** Cost and access barriers delay prevention and early diagnosis.
* **Proposed change:** Reduce out-of-pocket and geographic barriers to recommended preventive care.
* **Trade-offs and safeguards:** Use evidence-based recommendations and monitor unnecessary screening harms.
* **Success metrics:** Preventive service uptake; late-stage diagnosis rates.
* **Flourishing dimensions:** Health; Time

### HFL-028: Rural Healthcare Freedom Act

* **Jurisdiction:** federal
* **Problem:** Rural patients face long travel times and limited medical services.
* **Proposed change:** Fund mobile services, telehealth, and emergency-care capacity where regional need is documented.
* **Trade-offs and safeguards:** Address broadband, reimbursement, quality, and continuity of care.
* **Success metrics:** Travel time to essential services; avoidable rural transfers.
* **Flourishing dimensions:** Health; Justice

### HFL-029: Affordable Medicines Competition Act

* **Jurisdiction:** federal
* **Problem:** Insufficient competition can keep medicine prices high.
* **Proposed change:** Improve timely generic and biosimilar competition and transparent prescription pricing.
* **Trade-offs and safeguards:** Preserve drug quality, innovation incentives, and reliable supplies.
* **Success metrics:** Out-of-pocket medicine spending; generic uptake; shortages.
* **Flourishing dimensions:** Health; Economic security

### HFL-030: Healthy Food Access Act

* **Jurisdiction:** federal
* **Problem:** Some households cannot reliably access nutritious food.
* **Proposed change:** Expand nutritious-food incentives and support viable grocery access in underserved areas.
* **Trade-offs and safeguards:** Avoid stigmatizing recipients and verify that retailers deliver usable access.
* **Success metrics:** Food insecurity; fruit and vegetable access; food affordability.
* **Flourishing dimensions:** Health; Economic security

## Education and human development

### HFL-031: Affordable Childcare for Every Family Act

* **Jurisdiction:** federal
* **Problem:** Childcare costs restrict family choices and economic participation.
* **Proposed change:** Scale quality childcare capacity and offer means-sensitive affordability assistance.
* **Trade-offs and safeguards:** Prevent subsidies from simply increasing prices without expanding supply.
* **Success metrics:** Childcare costs as share of income; available slots.
* **Flourishing dimensions:** Agency; Economic security; Relationships

### HFL-032: Paid Parental Bonding Act

* **Jurisdiction:** federal
* **Problem:** New parents often lack protected time to bond and recover.
* **Proposed change:** Establish paid, job-protected parental leave for births and adoptions through a sustainable financing model.
* **Trade-offs and safeguards:** Protect smaller employers and equitable access across income groups.
* **Success metrics:** Paid leave uptake; parent-reported financial strain.
* **Flourishing dimensions:** Relationships; Health

### HFL-033: Voluntary Universal Preschool Act

* **Jurisdiction:** state
* **Problem:** Preschool access differs sharply by geography and income.
* **Proposed change:** Offer quality early education to families of three- and four-year-olds who choose it.
* **Trade-offs and safeguards:** Preserve parental choice and avoid displacing effective existing providers.
* **Success metrics:** Preschool access; readiness measures; parent choice.
* **Flourishing dimensions:** Education; Agency

### HFL-034: Early Childhood Development Act

* **Jurisdiction:** state
* **Problem:** Developmental needs can go unnoticed until problems compound.
* **Proposed change:** Offer voluntary developmental screening, home visiting, and timely early interventions.
* **Trade-offs and safeguards:** Protect family privacy and avoid overdiagnosis or coercive participation.
* **Success metrics:** Time to developmental support; family satisfaction.
* **Flourishing dimensions:** Health; Education

### HFL-035: Every Child Can Read Act

* **Jurisdiction:** state
* **Problem:** Early literacy gaps compound across school years.
* **Proposed change:** Fund effective literacy instruction, educator training, and targeted tutoring.
* **Trade-offs and safeguards:** Use independent evaluation and adapt instruction to each learner.
* **Success metrics:** Grade-level reading proficiency; progress among struggling readers.
* **Flourishing dimensions:** Education; Agency

### HFL-036: Free Healthy School Meals Act

* **Jurisdiction:** federal
* **Problem:** Hunger and meal stigma can interfere with learning.
* **Proposed change:** Provide nutritious school breakfast and lunch without means-tested stigma.
* **Trade-offs and safeguards:** Measure nutritional quality, waste, and cost to districts.
* **Success metrics:** Student food insecurity; participation; meal quality.
* **Flourishing dimensions:** Health; Education

### HFL-037: School Counseling Access Act

* **Jurisdiction:** state
* **Problem:** Students lack timely educational and mental-health support.
* **Proposed change:** Increase access to qualified counselors and school mental-health professionals.
* **Trade-offs and safeguards:** Avoid overloading staff and safeguard confidential student information.
* **Success metrics:** Counselor caseloads; wait times for student support.
* **Flourishing dimensions:** Health; Education

### HFL-038: Critical Thinking and Civic Virtue Act

* **Jurisdiction:** state
* **Problem:** Students need skills for reasoning and constructive disagreement.
* **Proposed change:** Teach practical logic, media literacy, civil dialogue, empathy, and constitutional reasoning.
* **Trade-offs and safeguards:** Keep curricula transparent and nonpartisan; protect freedom of conscience.
* **Success metrics:** Critical-thinking assessments; civic literacy; student feedback.
* **Flourishing dimensions:** Education; Justice; Agency

### HFL-039: Earn While You Learn Act

* **Jurisdiction:** federal
* **Problem:** Many careers lack accessible paid training paths.
* **Proposed change:** Expand paid apprenticeships and employer-education partnerships in high-demand occupations.
* **Trade-offs and safeguards:** Enforce training quality and prevent misuse as cheap labor.
* **Success metrics:** Apprenticeship completions; wages after training.
* **Flourishing dimensions:** Education; Economic security

### HFL-040: Lifetime Learning Accounts Act

* **Jurisdiction:** federal
* **Problem:** Adults need practical ways to gain skills across changing careers.
* **Proposed change:** Create portable education credits for qualified short courses and credentials.
* **Trade-offs and safeguards:** Prevent low-value training providers from capturing the subsidy.
* **Success metrics:** Credential completion; earnings and employment after training.
* **Flourishing dimensions:** Education; Agency

## Meaningful work, autonomy, and time

### HFL-041: Predictable Working Hours Act

* **Jurisdiction:** federal
* **Problem:** Unpredictable shifts disrupt childcare, sleep, and income.
* **Proposed change:** Require reasonable advance notice of schedules and compensation for certain late cancellations.
* **Trade-offs and safeguards:** Allow genuine operational exceptions and proportionate rules for small workplaces.
* **Success metrics:** Schedule changes with short notice; worker income volatility.
* **Flourishing dimensions:** Time; Relationships; Economic security

### HFL-042: Paid Sick Days Act

* **Jurisdiction:** federal
* **Problem:** Workers may feel unable to stay home when ill.
* **Proposed change:** Guarantee a modest accrual of paid sick time with anti-retaliation protections.
* **Trade-offs and safeguards:** Design fair accrual and administrative rules for varied job types.
* **Success metrics:** Paid sick leave coverage; illness-related job loss.
* **Flourishing dimensions:** Health; Economic security

### HFL-043: Family Caregiving Leave Act

* **Jurisdiction:** federal
* **Problem:** Caring for sick relatives can create employment and financial crises.
* **Proposed change:** Offer paid caregiving leave for qualifying serious family health needs.
* **Trade-offs and safeguards:** Protect program solvency and avoid punishing caregivers who work part-time.
* **Success metrics:** Caregiver leave coverage; job retention; hardship rates.
* **Flourishing dimensions:** Relationships; Economic security

### HFL-044: Wage Theft Prevention Act

* **Jurisdiction:** federal
* **Problem:** Workers sometimes do not receive pay legally owed to them.
* **Proposed change:** Improve wage enforcement, restitution speed, and protection against retaliation.
* **Trade-offs and safeguards:** Keep complaint processes fair and accessible to both workers and employers.
* **Success metrics:** Recovered unpaid wages; case resolution time.
* **Flourishing dimensions:** Justice; Economic security

### HFL-045: Freedom to Practice Your Profession Act

* **Jurisdiction:** state
* **Problem:** Unnecessary licensing differences keep skilled people from moving or working.
* **Proposed change:** Expand license reciprocity and remove requirements unrelated to demonstrable public safety.
* **Trade-offs and safeguards:** Retain checks for competence and professions with meaningful risks.
* **Success metrics:** Time to licensure; interstate workforce mobility.
* **Flourishing dimensions:** Agency; Economic security

### HFL-046: Worker Mobility Act

* **Jurisdiction:** state
* **Problem:** Overbroad noncompetes can block ordinary career advancement.
* **Proposed change:** Restrict noncompete clauses that unreasonably limit job changes or new businesses.
* **Trade-offs and safeguards:** Allow legitimate protections for trade secrets and narrowly tailored confidentiality.
* **Success metrics:** Job mobility; wage growth; startup formation.
* **Flourishing dimensions:** Agency; Economic security

### HFL-047: Safe Work in Extreme Heat Act

* **Jurisdiction:** federal
* **Problem:** High temperatures create preventable workplace injury risks.
* **Proposed change:** Require proportionate heat-safety plans including water, rest, shade, and acclimatization.
* **Trade-offs and safeguards:** Adapt thresholds to actual working conditions and implementation costs.
* **Success metrics:** Heat-related illness at work; compliance rates.
* **Flourishing dimensions:** Health; Justice

### HFL-048: Employee Ownership Expansion Act

* **Jurisdiction:** federal
* **Problem:** Many workers have little direct stake in the value they help create.
* **Proposed change:** Support voluntary employee ownership and transparent profit-sharing through targeted assistance.
* **Trade-offs and safeguards:** Avoid concentrated retirement risk and coercive stock arrangements.
* **Success metrics:** Employee ownership participation; business longevity.
* **Flourishing dimensions:** Agency; Economic security

### HFL-049: Four-Day Workweek Experiment Act

* **Jurisdiction:** federal
* **Problem:** Time pressure can undermine health and relationships.
* **Proposed change:** Fund opt-in shorter-workweek trials with independent measurement of output, staffing, and well-being.
* **Trade-offs and safeguards:** Do not infer one work pattern suits every sector or shift worker.
* **Success metrics:** Productivity per hour; employee well-being; service quality.
* **Flourishing dimensions:** Time; Health; Relationships

### HFL-050: Right to Disconnect Act

* **Jurisdiction:** state
* **Problem:** Routine after-hours demands intrude on unpaid personal time.
* **Proposed change:** Protect covered workers against nonessential off-duty contact demands unless compensated or genuinely on-call.
* **Trade-offs and safeguards:** Define emergency exceptions and fair treatment for flexible schedules.
* **Success metrics:** Unpaid after-hours work; worker stress; response expectations.
* **Flourishing dimensions:** Time; Relationships; Agency

## Friendship, community, and belonging

### HFL-051: Third Places for Everyone Act

* **Jurisdiction:** city
* **Problem:** Many people lack welcoming places to spend time without buying something.
* **Proposed change:** Support accessible noncommercial gathering spaces such as rec centers and community halls.
* **Trade-offs and safeguards:** Provide stable operating budgets and ensure spaces welcome diverse residents.
* **Success metrics:** Access to free gathering spaces; repeat attendance.
* **Flourishing dimensions:** Relationships; Health

### HFL-052: Libraries as Community Centers Act

* **Jurisdiction:** city
* **Problem:** Free public meeting and learning spaces are often unavailable outside work hours.
* **Proposed change:** Expand library hours, meeting rooms, and community programs where demand supports them.
* **Trade-offs and safeguards:** Protect library independence and balance staffing and security needs.
* **Success metrics:** Evening hours; program participation; free room availability.
* **Flourishing dimensions:** Relationships; Education

### HFL-053: A Park in Every Neighborhood Act

* **Jurisdiction:** city
* **Problem:** Unequal park access limits play, exercise, and contact with nature.
* **Proposed change:** Prioritize safe, accessible parks and playgrounds in neighborhoods with the biggest deficits.
* **Trade-offs and safeguards:** Fund maintenance, accessibility, and neighborhood input.
* **Success metrics:** Residents within a short walk of a park; park usage.
* **Flourishing dimensions:** Health; Relationships; Environment

### HFL-054: Community Dinner Act

* **Jurisdiction:** city
* **Problem:** Neighbors have too few easy opportunities to meet each other.
* **Proposed change:** Offer small competitive grants for free, welcoming community meals.
* **Trade-offs and safeguards:** Use transparent selection and food safety practices; avoid exclusion.
* **Success metrics:** Attendance diversity; repeat participation; participant satisfaction.
* **Flourishing dimensions:** Relationships

### HFL-055: Community Clubs Starter Act

* **Jurisdiction:** city
* **Problem:** Social activities often fail because organizers lack small startup resources.
* **Proposed change:** Provide microgrants and meeting access for recurring community groups.
* **Trade-offs and safeguards:** Keep grants viewpoint-neutral and ensure simple reporting.
* **Success metrics:** Number of active clubs; sustained participation.
* **Flourishing dimensions:** Relationships; Agency

### HFL-056: Youth Mentorship for All Act

* **Jurisdiction:** state
* **Problem:** Young people may lack supportive adults outside their households.
* **Proposed change:** Increase access to supervised mentoring programs with vetted, trained volunteers.
* **Trade-offs and safeguards:** Require child-safety checks, clear consent, and program evaluation.
* **Success metrics:** Mentoring relationship retention; youth-reported support.
* **Flourishing dimensions:** Relationships; Education

### HFL-057: Intergenerational Friendship Act

* **Jurisdiction:** city
* **Problem:** Age segregation reduces opportunities to share skills and companionship.
* **Proposed change:** Support voluntary activities connecting older and younger residents.
* **Trade-offs and safeguards:** Provide safeguarding, accessibility, and meaningful mutual participation.
* **Success metrics:** Cross-age program participation; loneliness indicators.
* **Flourishing dimensions:** Relationships; Education

### HFL-058: Social Connection Prescription Act

* **Jurisdiction:** state
* **Problem:** Loneliness is not always addressed by clinical care alone.
* **Proposed change:** Pilot voluntary referrals from providers to vetted clubs, classes, and community groups.
* **Trade-offs and safeguards:** Do not medicalize ordinary solitude or replace needed clinical treatment.
* **Success metrics:** Follow-through on referrals; perceived social support.
* **Flourishing dimensions:** Relationships; Health

### HFL-059: Public Arts and Music Act

* **Jurisdiction:** city
* **Problem:** Creative opportunities can be inaccessible or concentrated in a few communities.
* **Proposed change:** Support local arts studios, concerts, theater, and low-cost creative instruction.
* **Trade-offs and safeguards:** Award funding transparently with artistic independence.
* **Success metrics:** Community arts participation; access by neighborhood.
* **Flourishing dimensions:** Relationships; Education

### HFL-060: Volunteer Without Barriers Act

* **Jurisdiction:** state
* **Problem:** Travel and caregiving expenses prevent willing residents from volunteering.
* **Proposed change:** Reimburse qualifying childcare, transport, and accessibility expenses for approved volunteer work.
* **Trade-offs and safeguards:** Keep paperwork light and avoid displacing paid work.
* **Success metrics:** Volunteer participation; volunteer retention; reimbursement uptake.
* **Flourishing dimensions:** Relationships; Agency

## Justice, dignity, and second chances

### HFL-061: Civil Justice for Everyone Act

* **Jurisdiction:** federal
* **Problem:** People often face severe civil problems without legal help.
* **Proposed change:** Expand legal support for qualifying housing, debt, family, and other high-stakes civil matters.
* **Trade-offs and safeguards:** Preserve attorney independence and set clear eligibility rules.
* **Success metrics:** Unrepresented case share; fair-resolution outcomes.
* **Flourishing dimensions:** Justice; Economic security

### HFL-062: Second Chance Records Act

* **Jurisdiction:** state
* **Problem:** Old records can create lifelong barriers after rehabilitation.
* **Proposed change:** Seal eligible criminal records after suitable periods and conditions, with public-safety exceptions.
* **Trade-offs and safeguards:** Balance rehabilitation, victim interests, and safety-sensitive screening.
* **Success metrics:** Employment after record sealing; recidivism; processing time.
* **Flourishing dimensions:** Justice; Agency

### HFL-063: Effective Public Defense Act

* **Jurisdiction:** state
* **Problem:** Underfunded defense can undermine fair criminal proceedings.
* **Proposed change:** Fund public defender staffing, training, and manageable caseloads.
* **Trade-offs and safeguards:** Protect independent legal representation and outcome transparency.
* **Success metrics:** Defender caseloads; access to counsel; case delays.
* **Flourishing dimensions:** Justice

### HFL-064: Restorative Justice Choice Act

* **Jurisdiction:** state
* **Problem:** Traditional proceedings may leave some victims and communities without meaningful repair.
* **Proposed change:** Provide professionally supervised, voluntary restorative processes for carefully screened cases.
* **Trade-offs and safeguards:** Require informed victim consent and forbid coercive participation.
* **Success metrics:** Victim satisfaction; agreements completed; reoffending.
* **Flourishing dimensions:** Justice; Relationships

### HFL-065: Fair Jury Service Act

* **Jurisdiction:** state
* **Problem:** Lost wages and dependent care make jury service inaccessible to many.
* **Proposed change:** Increase juror compensation and reimburse essential care and travel expenses.
* **Trade-offs and safeguards:** Keep selection fair and ensure genuine funding.
* **Success metrics:** Juror hardship exemptions; jury representativeness.
* **Flourishing dimensions:** Justice; Economic security

### HFL-066: Survivor Safety and Independence Act

* **Jurisdiction:** state
* **Problem:** People facing domestic violence or stalking need reliable escape and recovery support.
* **Proposed change:** Expand confidential emergency housing, protective services, and legal assistance.
* **Trade-offs and safeguards:** Prioritize survivor consent, privacy, and effective safety planning.
* **Success metrics:** Survivor access to safe housing; repeat victimization.
* **Flourishing dimensions:** Health; Justice

### HFL-067: Disability Inclusion by Design Act

* **Jurisdiction:** federal
* **Problem:** Physical and digital barriers exclude people from everyday participation.
* **Proposed change:** Strengthen accessible public services, transit, buildings, and government websites.
* **Trade-offs and safeguards:** Set achievable schedules and consult people with disabilities directly.
* **Success metrics:** Accessibility compliance; service access complaints.
* **Flourishing dimensions:** Justice; Agency

### HFL-068: Aging With Dignity at Home Act

* **Jurisdiction:** federal
* **Problem:** Older adults may lack supports needed to remain in familiar communities.
* **Proposed change:** Expand home modifications, community-based care, and respite options for carers.
* **Trade-offs and safeguards:** Protect choice, quality, and fiscal sustainability.
* **Success metrics:** Avoidable institutionalization; caregiver burnout; home care access.
* **Flourishing dimensions:** Health; Relationships; Agency

### HFL-069: Foster Youth Independence Act

* **Jurisdiction:** state
* **Problem:** Young people leaving foster care face abrupt loss of support.
* **Proposed change:** Provide transition housing, education assistance, and career support for eligible young adults.
* **Trade-offs and safeguards:** Center youth consent and track outcomes beyond program participation.
* **Success metrics:** Stable housing after foster care; education and employment outcomes.
* **Flourishing dimensions:** Economic security; Justice

### HFL-070: Community Conflict Resolution Act

* **Jurisdiction:** county
* **Problem:** Minor disputes can escalate into expensive and damaging legal conflicts.
* **Proposed change:** Make voluntary, qualified mediation accessible for suitable civil and neighborhood disagreements.
* **Trade-offs and safeguards:** Do not pressure vulnerable parties to settle or undermine legal rights.
* **Success metrics:** Mediation resolution rate; repeated disputes; participant satisfaction.
* **Flourishing dimensions:** Justice; Relationships

## Democracy, wisdom, and government

### HFL-071: Secure and Convenient Voting Act

* **Jurisdiction:** federal
* **Problem:** Some eligible voters face avoidable participation barriers while election security requires public confidence.
* **Proposed change:** Expand accessible voting options and require verifiable paper-backed audits and transparent security standards.
* **Trade-offs and safeguards:** Respect state administration and protect eligibility, privacy, and accessibility.
* **Success metrics:** Eligible voter participation; audit completion; access barriers.
* **Flourishing dimensions:** Justice; Agency

### HFL-072: Citizen Legislative Agenda Act

* **Jurisdiction:** state
* **Problem:** Residents struggle to move serious proposals onto legislative agendas.
* **Proposed change:** Require public hearings for proposals exceeding verified constituent support thresholds.
* **Trade-offs and safeguards:** Prevent spam, identity abuse, and disproportionate influence by organized groups.
* **Success metrics:** Eligible petitions heard; time to hearing; participation diversity.
* **Flourishing dimensions:** Agency; Justice

### HFL-073: Citizens' Assembly Act

* **Jurisdiction:** state
* **Problem:** Complex public issues need informed deliberation beyond polarized debates.
* **Proposed change:** Convene paid, randomly selected resident panels to study questions and publish recommendations.
* **Trade-offs and safeguards:** Make sampling representative and recommendations advisory, not binding.
* **Success metrics:** Assembly completion; participant diversity; transparency measures.
* **Flourishing dimensions:** Agency; Relationships

### HFL-074: Transparent Political Influence Act

* **Jurisdiction:** federal
* **Problem:** Citizens cannot always see who funds or influences government decisions.
* **Proposed change:** Improve timely disclosure of lobbying and significant political financing.
* **Trade-offs and safeguards:** Respect constitutional speech and association protections and legitimate privacy.
* **Success metrics:** Disclosure timeliness; compliance rates; public access.
* **Flourishing dimensions:** Justice; Agency

### HFL-075: Every Bill in Plain English Act

* **Jurisdiction:** federal
* **Problem:** Long legal documents are difficult for ordinary people to evaluate.
* **Proposed change:** Publish accessible summaries of major bills, including costs, effects, and uncertainty, alongside full text.
* **Trade-offs and safeguards:** Prevent misleading summaries and preserve access to authoritative legal language.
* **Success metrics:** Summary availability; comprehension testing; correction rate.
* **Flourishing dimensions:** Agency; Education

### HFL-076: National Flourishing Budget Act

* **Jurisdiction:** federal
* **Problem:** Budgets track spending more readily than improvements in lived conditions.
* **Proposed change:** Publish privacy-preserving outcome dashboards alongside fiscal reporting for major programs.
* **Trade-offs and safeguards:** Avoid simplistic happiness targets and manipulation of self-reported measures.
* **Success metrics:** Coverage of validated well-being indicators; public data quality.
* **Flourishing dimensions:** Agency; Health; Economic security

### HFL-077: Open Government Contracting Act

* **Jurisdiction:** federal
* **Problem:** Opaque procurement erodes accountability and may waste public funds.
* **Proposed change:** Publish searchable public contracts, awards, and performance records with limited justified exceptions.
* **Trade-offs and safeguards:** Protect legitimate security needs and commercially sensitive details.
* **Success metrics:** Public contract transparency; competitive bidding rates.
* **Flourishing dimensions:** Justice; Agency

### HFL-078: Government Must Respond Act

* **Jurisdiction:** federal
* **Problem:** Slow and opaque government services create stress and lost opportunities.
* **Proposed change:** Set status tracking, response targets, and appeals for essential applications and requests.
* **Trade-offs and safeguards:** Fund agency capacity and distinguish deadlines from automatic approvals.
* **Success metrics:** Median service time; unresolved backlog; successful appeals.
* **Flourishing dimensions:** Time; Agency

### HFL-079: Evidence-Based Government Act

* **Jurisdiction:** federal
* **Problem:** Public programs can continue without reliable evidence of effectiveness.
* **Proposed change:** Require independent evaluations and transparent continuation decisions for major programs.
* **Trade-offs and safeguards:** Account for long-term outcomes that cannot be measured quickly.
* **Success metrics:** Evaluations published; follow-up actions; program outcomes.
* **Flourishing dimensions:** Agency; Justice

### HFL-080: Participatory Budgeting Act

* **Jurisdiction:** city
* **Problem:** Residents have limited direct influence over some local spending choices.
* **Proposed change:** Dedicate a transparent share of qualifying local funds to resident-designed and selected projects.
* **Trade-offs and safeguards:** Protect core services and guard against manipulation and unequal turnout.
* **Success metrics:** Projects completed; participation diversity; resident satisfaction.
* **Flourishing dimensions:** Agency; Relationships

## Technology, AI, and digital freedom

### HFL-081: Personal Data Privacy Act

* **Jurisdiction:** federal
* **Problem:** People often lack control over collection and resale of personal data.
* **Proposed change:** Create enforceable limits on collection, use, retention, and disclosure with stronger safeguards for sensitive information.
* **Trade-offs and safeguards:** Protect small organizations' ability to comply and preserve useful research under safeguards.
* **Success metrics:** Privacy complaints; unwanted data sharing; enforcement outcomes.
* **Flourishing dimensions:** Agency; Justice

### HFL-082: Human Appeal of AI Decisions Act

* **Jurisdiction:** federal
* **Problem:** Automated systems can make consequential mistakes without usable appeal routes.
* **Proposed change:** Provide explanations and meaningful human review for high-impact automated decisions.
* **Trade-offs and safeguards:** Define material decisions and ensure reviewers can actually reverse errors.
* **Success metrics:** Appeal time; error reversal rate; access to explanations.
* **Flourishing dimensions:** Justice; Agency

### HFL-083: Public Algorithm Accountability Act

* **Jurisdiction:** federal
* **Problem:** High-impact government AI tools can obscure bias and error.
* **Proposed change:** Require risk assessments, testing, and proportionate independent audits for government AI systems.
* **Trade-offs and safeguards:** Publish useful oversight without exposing security vulnerabilities or personal data.
* **Success metrics:** Audits completed; errors identified and corrected.
* **Flourishing dimensions:** Justice; Agency

### HFL-084: Choose Your Algorithm Act

* **Jurisdiction:** federal
* **Problem:** Users may have little say over how platforms rank what they see.
* **Proposed change:** Require meaningful feed controls and a non-personalized chronological option where practicable.
* **Trade-offs and safeguards:** Protect platform innovation and prevent deceptive or hard-to-find settings.
* **Success metrics:** Feed control adoption; user understanding; complaints.
* **Flourishing dimensions:** Agency; Health

### HFL-085: Children's Digital Safety by Design Act

* **Jurisdiction:** federal
* **Problem:** Online services can expose children to privacy and safety risks.
* **Proposed change:** Require age-appropriate privacy and safety defaults, independently audited for high-risk services.
* **Trade-offs and safeguards:** Preserve minors' privacy and rights to information; avoid blanket surveillance.
* **Success metrics:** Youth privacy incidents; safety-control effectiveness.
* **Flourishing dimensions:** Health; Justice

### HFL-086: Affordable Broadband Access Act

* **Jurisdiction:** federal
* **Problem:** Inadequate internet access limits learning and opportunity.
* **Proposed change:** Expand reliable broadband availability and affordable service in underserved areas.
* **Trade-offs and safeguards:** Target actual gaps and discourage ineffective subsidies.
* **Success metrics:** Households with affordable reliable broadband; outage frequency.
* **Flourishing dimensions:** Education; Agency

### HFL-087: Right to Repair and Maintain Act

* **Jurisdiction:** federal
* **Problem:** Repair restrictions can force people to replace useful products.
* **Proposed change:** Require fair access to repair parts, documentation, and tools for covered products.
* **Trade-offs and safeguards:** Protect safety, cybersecurity, and genuine intellectual-property interests.
* **Success metrics:** Repair costs; device lifespan; repair market availability.
* **Flourishing dimensions:** Agency; Environment

### HFL-088: Tell the Government Once Act

* **Jurisdiction:** federal
* **Problem:** People repeatedly submit the same information to different offices.
* **Proposed change:** Enable authorized, secure reuse of verified information across public services.
* **Trade-offs and safeguards:** Use data minimization, consent or legal basis, and strong access controls.
* **Success metrics:** Repeated form fields eliminated; application time; privacy incidents.
* **Flourishing dimensions:** Time; Agency

### HFL-089: Protection Against Deceptive AI Impersonation Act

* **Jurisdiction:** federal
* **Problem:** Fraudulent synthetic media can damage reputations and deceive victims.
* **Proposed change:** Create proportionate remedies for harmful deceptive impersonation and related fraud.
* **Trade-offs and safeguards:** Safeguard satire, criticism, research, and lawful expression.
* **Success metrics:** Impersonation complaints; remedy time; false-positive enforcement.
* **Flourishing dimensions:** Justice; Agency

### HFL-090: Public Futures Simulation Act

* **Jurisdiction:** federal
* **Problem:** Policy debates often hide assumptions about long-term effects.
* **Proposed change:** Publish transparent scenario models for major proposals when feasible, with uncertainty and reproducible assumptions.
* **Trade-offs and safeguards:** Do not treat modeled outcomes as predictions or allow opaque scoring to decide policy.
* **Success metrics:** Models reproducible; assumptions disclosed; post-policy validation.
* **Flourishing dimensions:** Agency; Education; Environment

## Nature, safety, and future generations

### HFL-091: Lead-Free Drinking Water Infrastructure Act

* **Jurisdiction:** federal
* **Problem:** Lead exposure from water infrastructure harms health, especially children.
* **Proposed change:** Prioritize replacement of hazardous lead service lines and reliable water testing.
* **Trade-offs and safeguards:** Balance cost, accurate inventories, and fair prioritization of highest exposure.
* **Success metrics:** Lead lines replaced; water lead test results.
* **Flourishing dimensions:** Health; Environment

### HFL-092: Clean Air for Every Child Act

* **Jurisdiction:** state
* **Problem:** Poor indoor and outdoor air exposes children to avoidable health risks.
* **Proposed change:** Improve school ventilation, air monitoring, and protection from excessive nearby pollution.
* **Trade-offs and safeguards:** Use transparent standards and realistic funding for ongoing maintenance.
* **Success metrics:** School air quality; asthma-related absenteeism.
* **Flourishing dimensions:** Health; Environment

### HFL-093: Cooler Cities Act

* **Jurisdiction:** city
* **Problem:** Dangerous urban heat disproportionately affects vulnerable residents.
* **Proposed change:** Fund shade, water access, trees, and cooling infrastructure in high-risk neighborhoods.
* **Trade-offs and safeguards:** Select measures for local climate and long-term maintenance.
* **Success metrics:** Heat-related illness; shaded pedestrian routes; surface temperatures.
* **Flourishing dimensions:** Health; Environment

### HFL-094: No Preventable Road Deaths Act

* **Jurisdiction:** state
* **Problem:** Serious road crashes cause avoidable deaths and injuries.
* **Proposed change:** Prioritize proven safety design for intersections, road speeds, and vulnerable road users.
* **Trade-offs and safeguards:** Evaluate access and emergency response alongside safety outcomes.
* **Success metrics:** Traffic fatalities and serious injuries; high-risk crossings improved.
* **Flourishing dimensions:** Health; Justice

### HFL-095: Reliable Public Transit Act

* **Jurisdiction:** city
* **Problem:** Infrequent or inaccessible transport restricts jobs and daily life.
* **Proposed change:** Improve bus and rail reliability and suitable demand-responsive services where needed.
* **Trade-offs and safeguards:** Design service around actual rider demand and sustainable operations.
* **Success metrics:** Transit wait time; accessibility; reliable trip completion.
* **Flourishing dimensions:** Time; Economic security; Environment

### HFL-096: Neighborhood Disaster Preparedness Act

* **Jurisdiction:** county
* **Problem:** Local emergencies can overwhelm households with inadequate warnings and support.
* **Proposed change:** Create accessible emergency plans, warning systems, evacuation support, and resilient local facilities.
* **Trade-offs and safeguards:** Keep plans current and include people with disabilities and limited mobility.
* **Success metrics:** Warning reach; evacuation readiness; recovery time.
* **Flourishing dimensions:** Health; Environment; Justice

### HFL-097: Clean Energy Connection Act

* **Jurisdiction:** federal
* **Problem:** Aging electricity systems constrain reliable clean energy deployment.
* **Proposed change:** Modernize grids and accelerate responsible transmission, storage, and generation permits.
* **Trade-offs and safeguards:** Preserve environmental review and address ratepayer and community impacts.
* **Success metrics:** Grid reliability; connection queue delays; emissions intensity.
* **Flourishing dimensions:** Environment; Economic security

### HFL-098: Nature Within Reach Act

* **Jurisdiction:** state
* **Problem:** Many residents lack convenient access to restored and protected nature.
* **Proposed change:** Expand habitat restoration and public access to trails, green corridors, and natural sites.
* **Trade-offs and safeguards:** Protect biodiversity and access for historically underserved communities.
* **Success metrics:** Habitat restored; residents near accessible natural space.
* **Flourishing dimensions:** Environment; Health

### HFL-099: Feed People, Not Landfills Act

* **Jurisdiction:** state
* **Problem:** Usable food is discarded while some households face food insecurity.
* **Proposed change:** Support safe food rescue, donation logistics, and transparent food-waste reduction programs.
* **Trade-offs and safeguards:** Maintain food safety and avoid costly low-impact mandates.
* **Success metrics:** Edible food recovered; food waste per resident.
* **Flourishing dimensions:** Environment; Economic security

### HFL-100: Future Generations Protection Act

* **Jurisdiction:** federal
* **Problem:** Short-term policy choices can create long-lasting costs for children and future residents.
* **Proposed change:** Require independent long-term impact reports for major legislation on fiscal, environmental, and generational outcomes.
* **Trade-offs and safeguards:** Avoid speculative precision and protect democratic decision-making authority.
* **Success metrics:** Long-term assessments published; assumptions and revisions tracked.
* **Flourishing dimensions:** Environment; Justice; Agency

## Appendix: publishing and evaluation standards

A human editor should verify each proposal's legal authority, cost, affected populations, expected benefits and harms, source evidence, implementation capacity, rights implications, and measurable outcomes. Do not fabricate dollar costs or confidence values. Provide a visible "not yet assessed" indicator until analyses exist. Once a draft is published for advisory discussion, pin its text revision so votes always refer to an identifiable version; material edits require a new revision and a clear display of what changed. Official legislative status should only be populated from a trusted source.

The importer should treat this file as trusted **editorial configuration**, not as authenticated voter input. Do not POST the full catalog to the anonymous citizen-proposal endpoint. Keep citizen-generated proposals, imported editorial drafts, and official bills distinguishable in data and UI.

