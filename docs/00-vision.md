# 00 — Vision

## Project
**SwasthyaGrid AI** — an AI District Health Operations Center.

Authors: **Harsh Kawatra, Dayita Arora, Gursimran Kaur & Anuj Gambhir**
Context: GDG BuildWithAI hackathon, prototyping round.

## The Problem
PHCs (Primary Health Centres) and CHCs (Community Health Centres) face recurring operational gaps: medicine stock-outs, unmanaged patient footfall, bed unavailability, and unpredictable doctor attendance. These are tracked manually with no real-time visibility, leading to shortages and under-resourced facilities.

## The Challenge
Build a multilingual AI platform for real-time health centre management covering stock monitoring, patient footfall, bed availability, doctor attendance, and test/diagnostic availability audits. It must generate early stock-out warnings, AI-driven demand forecasts, and smart resource-redistribution recommendations across a district's PHCs/CHCs — and automatically flag underperforming or under-resourced centres to district administrators for intervention.

## Product Philosophy
Legacy systems answer **"what happened?"**. SwasthyaGrid answers:
- **What will happen?** (forecast)
- **Why?** (explainable factors)
- **What should I do?** (prescriptive recommendation)

Think of it as **Google Maps for district healthcare operations** — instead of routing cars, it routes medicines, doctors, beds, testing kits, and other resources across an entire district.

## Core AI Principle — Human-Governed AI
**AI never directly executes decisions.** Every recommendation is shown with a confidence score, the reasoning factors behind it, and a concrete recommended action. A human administrator must **Approve, Reject, or Modify** before anything happens. This keeps decision-making transparent and aligned with how real public health systems operate — and it is the single biggest differentiator versus a typical "AI + dashboard" hackathon entry.

## Users
| User | Role |
|---|---|
| PHC Staff | Update medicine inventory, OPD, beds, doctor attendance |
| CHC Staff | Same, at higher-capacity facilities |
| District Administrator | Monitors 50+ health centres, approves/rejects AI recommendations |
| State Health Officer | District-wide analytics and oversight |

## What Differentiates This Prototype
1. **Predictive, not reactive** — forecast shortages, bed occupancy, patient demand before they occur.
2. **Prescriptive, not descriptive** — recommend concrete resource transfers, staffing adjustments, interventions.
3. **Explainable, not opaque** — every recommendation ships with underlying factors and a confidence score.
4. **Human-governed, not autonomous** — administrators always approve/reject/modify before any action is taken.

## Why Not "Just a Chatbot"
Many AI-in-healthcare prototypes stop at a FastAPI + Gemini tool-calling **chat assistant** over a database. SwasthyaGrid goes further: instead of a Q&A chatbot, it is a **district-scale forecasting + optimization + recommendation control room**, with Gemini used only to *explain* AI-generated forecasts/recommendations in natural language — not to generate the predictions themselves. See [09-gcp-deployment.md](09-gcp-deployment.md) for the production-engineering approach (clean architecture layering, Pydantic Settings config, health/readiness/metrics endpoints, multi-stage Docker build, and CI/CD shape).

## Design Mandate
The UI must not look like generic "AI SaaS slop" (no blue-purple gradients, no generic dashboard template feel). It must read as **agency-grade, editorial, heavily professional** — a beige/warm-neutral background, deliberate typography, and restrained color use for signal (risk states), not decoration. See [08-design-system.md](08-design-system.md).
