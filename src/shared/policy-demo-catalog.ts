/** Frozen candidate software mappings; human legal applicability acceptance remains open. */
export const POLICY_DEMO_SOURCE = Object.freeze({repository: 'adnanwahab/happybearlandia', commit: 'bf08f457188e38a277d744c236dfba9fc0b02731', handoffSha256: '1baf5434cd1f4d28107890e74ce0a06d3da6124617f3ca406e8935a90ef1bf2c', status: 'candidate-human-acceptance-pending'} as const);
const definitions = [
  {
    "id": "housing",
    "mappingId": "h_lots",
    "input": {
      "schemaVersion": "policy-impact-preview.v1",
      "source": {
        "system": "civic-synthesis-demo",
        "proposalId": "synthetic-housing-policy",
        "versionId": "housing-demo-v2",
        "contentHash": "bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e",
        "type": "bill",
        "title": "Synthetic housing policy: additional parcel entitlements",
        "url": "https://example.org/synthetic-housing-policy/v2",
        "visibility": "public"
      },
      "legal": {
        "baseVersionId": "housing-demo-v1",
        "clauses": [
          {
            "clauseId": "housing-section-2",
            "sourcePolicyId": "h_lots",
            "operation": "add",
            "beforeText": "",
            "afterText": "Section 2. Permit additional homes on eligible residential parcels through the reviewed housing and zoning mechanism."
          }
        ]
      },
      "baseline": {
        "kind": "prior-proposal-version",
        "versionId": "housing-demo-v1",
        "label": "Synthetic prior proposal without additional parcel entitlements"
      },
      "simulation": {
        "seed": 42,
        "runs": 100,
        "months": 24
      }
    },
    "inputHash": "55b896682d3cb79164a500becd4df706a19b9569b2fda4f8d084be22593d3122",
    "legalHash": "bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e",
    "modelVersion": "city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0",
    "mappingVersion": "policy-preview-mappings.1.0.0",
    "checkpointMonths": [
      0,
      12,
      24
    ],
    "limitation": "Permitted capacity differs from completed housing. No guaranteed construction or rent benefit.",
    "unsupportedMetrics": [
      "legal validity",
      "evictions",
      "real-world causal effects",
      "real corridor ridership",
      "experienced commute time",
      "calibrated avoided flood loss"
    ]
  },
  {
    "id": "drainage",
    "mappingId": "f_drainage",
    "input": {
      "schemaVersion": "policy-impact-preview.v1",
      "source": {
        "system": "civic-synthesis-demo",
        "proposalId": "synthetic-drainage-policy",
        "versionId": "drainage-demo-v2",
        "contentHash": "745768b9ba8fa6d892db30c958344c54f927d83471f1ca4656336c6278f1f8da",
        "type": "bill",
        "title": "Synthetic drainage policy demonstration",
        "url": "https://example.org/synthetic-drainage-policy/v2",
        "visibility": "public"
      },
      "legal": {
        "baseVersionId": "drainage-demo-v1",
        "clauses": [
          {
            "clauseId": "drainage-section-2",
            "sourcePolicyId": "f_drainage",
            "operation": "add",
            "beforeText": "",
            "afterText": "Section 2. Authorize a drainage resilience project in the synthetic demonstration jurisdiction through the reviewed drainage mechanism."
          }
        ]
      },
      "baseline": {
        "kind": "prior-proposal-version",
        "versionId": "drainage-demo-v1",
        "label": "Synthetic prior proposal without drainage authorization"
      },
      "simulation": {
        "seed": 42,
        "runs": 100,
        "months": 24
      }
    },
    "inputHash": "f7cc152d39588806975ca56e5c67ff7070c658e6935bbb983232fa5b72b6fb5d",
    "legalHash": "745768b9ba8fa6d892db30c958344c54f927d83471f1ca4656336c6278f1f8da",
    "modelVersion": "city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0",
    "mappingVersion": "policy-preview-mappings.1.0.0",
    "checkpointMonths": [
      0,
      12,
      24
    ],
    "limitation": "Synthetic resilience index, not calibrated avoided loss or hydraulic protection. Benefits require recorded flood shocks.",
    "unsupportedMetrics": [
      "legal validity",
      "evictions",
      "real-world causal effects",
      "real corridor ridership",
      "experienced commute time",
      "calibrated avoided flood loss"
    ]
  },
  {
    "id": "transit",
    "mappingId": "t_brt",
    "input": {
      "schemaVersion": "policy-impact-preview.v1",
      "source": {
        "system": "civic-synthesis-demo",
        "proposalId": "synthetic-transit-policy",
        "versionId": "transit-demo-v2",
        "contentHash": "f04dc7ec9e5ea2be5f2f8391baf5026f16b552b089997021d97f8734379cec31",
        "type": "bill",
        "title": "Synthetic transit policy demonstration",
        "url": "https://example.org/synthetic-transit-policy/v2",
        "visibility": "public"
      },
      "legal": {
        "baseVersionId": "transit-demo-v1",
        "clauses": [
          {
            "clauseId": "transit-section-2",
            "sourcePolicyId": "t_brt",
            "operation": "add",
            "beforeText": "",
            "afterText": "Section 2. Authorize a transit capacity project in the synthetic demonstration jurisdiction through the reviewed transit mechanism."
          }
        ]
      },
      "baseline": {
        "kind": "prior-proposal-version",
        "versionId": "transit-demo-v1",
        "label": "Synthetic prior proposal without transit authorization"
      },
      "simulation": {
        "seed": 42,
        "runs": 100,
        "months": 24
      }
    },
    "inputHash": "cd4cd92adf7fb2dcfcc75cf2e7e041ca47f5a119e74a0bfe9d819246e30c1ede",
    "legalHash": "f04dc7ec9e5ea2be5f2f8391baf5026f16b552b089997021d97f8734379cec31",
    "modelVersion": "city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0",
    "mappingVersion": "policy-preview-mappings.1.0.0",
    "checkpointMonths": [
      0,
      12,
      24
    ],
    "limitation": "Coarse synthetic link capacity/travel, not real corridor ridership, commute time or a guaranteed improvement.",
    "unsupportedMetrics": [
      "legal validity",
      "evictions",
      "real-world causal effects",
      "real corridor ridership",
      "experienced commute time",
      "calibrated avoided flood loss"
    ]
  },
  {
    "id": "unsupported",
    "mappingId": "constitutional_process",
    "input": {
      "schemaVersion": "policy-impact-preview.v1",
      "source": {
        "system": "civic-synthesis-demo",
        "proposalId": "synthetic-constitutional-draft",
        "versionId": "constitutional-demo-v2",
        "contentHash": "471afdc534ca4a01964578eed17e4c4239f9a7a1a226f145b63b3fea3cd111ef",
        "type": "constitutional-amendment",
        "title": "Unsupported synthetic constitutional draft",
        "url": "https://example.org/synthetic-constitutional-draft/v2",
        "visibility": "public"
      },
      "legal": {
        "baseVersionId": "constitutional-demo-v1",
        "clauses": [
          {
            "clauseId": "constitution-section-1",
            "sourcePolicyId": "constitutional_process",
            "operation": "add",
            "beforeText": "",
            "afterText": "Section 1. Establish a new constitutional deliberation process in this illustrative draft."
          }
        ]
      },
      "baseline": {
        "kind": "prior-proposal-version",
        "versionId": "constitutional-demo-v1",
        "label": "Synthetic prior constitutional draft"
      },
      "simulation": {
        "seed": 42,
        "runs": 100,
        "months": 24
      }
    },
    "inputHash": "b538b62715d4b98eab2555577dac6c7d194b2c94f2920a8e483ccc24d810de19",
    "legalHash": "471afdc534ca4a01964578eed17e4c4239f9a7a1a226f145b63b3fea3cd111ef",
    "modelVersion": "city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0",
    "mappingVersion": "policy-preview-mappings.1.0.0",
    "checkpointMonths": [
      0,
      12,
      24
    ],
    "limitation": "Not Modeled. Exact constitutional legal diff retained; legal validity and constitutional effects Not Available.",
    "unsupportedMetrics": [
      "legal validity",
      "evictions",
      "real-world causal effects",
      "real corridor ridership",
      "experienced commute time",
      "calibrated avoided flood loss"
    ]
  }
] as const;
function freeze<T>(value: T): T { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
export const POLICY_DEMOS = freeze(definitions);
export type PolicyDemo = (typeof POLICY_DEMOS)[number];
export type PolicyDemoId = PolicyDemo['id'];
export function policyDemo(id: string): PolicyDemo | undefined { return POLICY_DEMOS.find(demo => demo.id === id); }
export function demoVersions(demo: PolicyDemo) {
  const {input} = demo;
  return {baseline: {versionId: input.baseline.versionId, title: input.source.title, type: input.source.type, clauses: [] as {clauseId:string; text:string}[]},
    proposal: {versionId: input.source.versionId, title: input.source.title, type: input.source.type,
      clauses: input.legal.clauses.map(clause => ({clauseId:clause.clauseId, text:clause.afterText}))}};
}
