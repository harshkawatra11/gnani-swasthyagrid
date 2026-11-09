# Federation

The Code for a Billion brief asks for shared, predictive modelling across BRICS health
systems. This is design work, not a built feature: it lays out what a federated deployment
of SwasthyaGrid would look like, and separates what exists today from what does not.

## The shape of it

Health is constitutionally a state subject in India (Seventh Schedule, List II, Entry 6), and
most countries treat health records the same way: as data that stays inside the jurisdiction
that collects it. A federated SwasthyaGrid follows that constraint rather than fighting it.

Each state, or each participating country, runs its own deployment: its own backend, its own
Cloud Run (or equivalent) project, its own database, in its own region. No facility-level
record, patient data, or raw stock figure ever leaves that deployment. What is shared across
deployments is narrower and optional:

- **The model, not the data.** Every deployment runs the same deterministic engine (days of
  cover, trigger thresholds, transfer radius, confidence scoring). A fix validated in one
  state's code is a fix every other deployment can pull, without any data crossing a border.
- **Aggregate statistics, not records.** A deployment could choose to publish rollups (state-
  level availability percentages, stock-out day counts) to a shared read-only index, the way
  India's own eVIN publishes national stock-out trends today. That index would hold numbers,
  never facility IDs or patient-identifying detail.
- **Shared parameters, locally reviewed.** Reorder thresholds, confidence weights, and the 7
  tracer medicines used in the impact model (see [the README's Impact model
  section](../README.md#impact-model)) are config, not code; a federation could offer a
  shared starting configuration that each deployment is free to override.

## What exists today versus what is design only

| Exists today | Design only |
|---|---|
| One shared, open-source codebase (this repository) | A registry or protocol for discovering other deployments |
| A deterministic model with no hidden state, auditable by anyone who reads the code | A shared aggregate-statistics index across deployments |
| Per-deployment configuration (district scope, reorder thresholds, the scenario switch already in the product) | Automated syncing of model updates across independently-run deployments |
| A single live deployment, covering 5 Rajasthan districts on simulated data | Any cross-deployment data-sharing agreement, legal review, or governance process |

Nothing above claims live cross-deployment behaviour. The product today is one deployment.
Federation is the architecture that deployment is built to fit into, not a running system.

## Why this shape, not a shared database

A single national or multi-country database would be the obvious alternative, and it is the
one SwasthyaGrid deliberately avoids. It would require every jurisdiction to agree on access,
retention, and liability for data it does not control, before a single district could go
live. The federated shape lets a state (or a country) adopt the model on its own data, under
its own law, on day one, and lets the model itself, not the data, be the thing that scales
across borders.
