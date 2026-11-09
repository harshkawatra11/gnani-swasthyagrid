# Code for a Billion — submission draft

Target: `https://github.com/karlmehta/code-for-a-billion/issues/new?template=submission.yml`
Deadline: submissions close 15 Nov 2026 (no published time/timezone; treat as 14 Nov 23:59 IST).

Fields below are in the same order as the issue form. `{{...}}` placeholders are filled once the
dependency they wait on is done (see note under each one).

---

### Team / Project name
```
Team IdeaForge: SwasthyaGrid
```
Issue title: `[Submission] Team IdeaForge / SwasthyaGrid`

---

### Team members
```
Harsh Kawatra (@harshkawatra11)
```

---

### Problem statement
```
Up to one in three key medicines can be missing from a Primary Health Centre shelf on a given day in India (availability ranges from 45% to 80% across state studies, PMC8654139 and others), while state stores write off crores in expired stock (CAG found ₹390.26 Cr expired in Telangana and ₹168 Cr in Odisha). The medicine is often already inside the district, at a warehouse or a clinic a short drive away, but stock lives in paper registers and monthly reports, so nobody with authority sees the gap until a patient is turned away. The people who pay are rural families who use India's 38,241 PHCs and CHCs (MoHFW HDI 2022-23) and then buy the missing medicine privately: out-of-pocket spending is still 43.4% of health spending (NHA 2022-23). SwasthyaGrid is built for the district health officer who has to fix this every morning, and for the PHC pharmacist who confirms what arrives.
```

---

### What you built
```markdown
**SwasthyaGrid is a working AI control room for a district's medicine supply: it flags the shortage before the shelf is empty, proposes the cheapest fix inside the district, moves the truck and closes the loop when the clinic confirms delivery.** Live at https://gnani-swasthyagrid.vercel.app (backend on Google Cloud Run), demo video {{YOUTUBE_URL}}.

**The loop, one screen per step**
- **See.** The Command Centre scores 40 facilities in 5 Rajasthan districts on stock, beds, staffing and diagnostics, with a district risk map and an AI briefing. One-screen pages for Inventory, Footfall forecast, Bed Occupancy, Doctors attendance and Diagnostics show the same data by facility.
- **Decide.** Recommendations turns a shortage into a ranked proposal: a warehouse refill to 21 days of cover, or for critical items a transfer from a clinic in the same district within 40 km by road. Each card shows its reasons and a confidence score. An officer approves, modifies or rejects. Nothing moves without that approval.
- **Move.** Approval creates a shipment. Dispatch, Fleet and Drivers assign a vehicle (refrigerated for vaccines) and a driver on shift, and track the truck on real road routes with a live ETA and cold-chain temperature.
- **Ask.** A voice agent answers in Hindi, Hinglish or English. It calls read-only tools on the live data, shows which tools it used and cites fact cards. Speech runs on Gnani Prisma and Timbre; the language model is Gnani Evon v3.3 when configured, Gemini otherwise.
- **Confirm.** The receiving clinic confirms delivery in a separate intake app (Firestore). Stock rises and the district view updates live, with no reload.

**How decisions are made.** The engines are plain arithmetic that an auditor can recompute: days of cover = units / average daily use; a flag under 5 days; critical under 3 days, or under 5 for emergency medicines; a bed redirect above 90% occupancy. Language models explain the numbers and never decide them.

**Mapped to the brief (BRICS theme: Resilience)**

| The brief asks for | What exists today |
|---|---|
| Real-time visibility of medicine stock, beds and staff attendance | Built: Inventory, Bed Occupancy, Doctors, Diagnostics, Command Centre |
| Demand forecasting and early stock-out warnings | Built: days-of-cover forecast, footfall forecast, critical flags |
| Automated cross-district redistribution | Built: ranked refills and lateral transfers, with officer approval |
| Federated, shared predictive modelling across nations | Design: each state or country runs its own deployment and data; one shared model. See docs/federation.md. Cross-deployment model sharing is not built yet |

**How I used AgentFoundry (AF).** AF is the event's listed IDE, built around Claude Code: it gives the same models through the same agent, plus a bundled allotment of free API credits. I tried it and confirmed that, since this build already runs on a paid Claude subscription, those free credits add nothing and the resulting work is identical either way. The national impact model (`backend/app/impact/model.py`, its `/api/v1/impact` endpoint and tests, and its Analyst Workbench card) and the federation design note (`docs/federation.md`) were built with Claude Code directly, which is what AF's editor wraps.

**Engineering.** Next.js 16 and TypeScript frontend on Vercel, FastAPI backend on Cloud Run, Firestore for the clinic intake app, OpenStreetMap road routes and geoBoundaries district shapes. 386 backend and 271 frontend tests run in GitHub Actions on every push, plus Playwright end-to-end tests. Apache-2.0.

**Research.** The problem sizing, source register and impact model behind every number above are written up in full at https://github.com/harshkawatra11/ppts-case-study/blob/main/swasthyagrid-gcp/nexora/research/swasthyagrid-nexora-research.pdf (also linked from the pitch deck).
```

---

### GitHub repository URL
```
https://github.com/harshkawatra11/swasthyagrid
```

---

### Demo URL
**DEPENDS ON Part C (video) + user upload.** The user uploads `demo-video/out/SwasthyaGrid-demo.mp4`
to YouTube as Unlisted and pastes the URL back.
```
{{YOUTUBE_URL}}
```
Fallback if no video is ready in time: `https://gnani-swasthyagrid.vercel.app`

---

### Scale & severity of the problem (50% of the score)
```markdown
**Up to a third of key medicines can be missing from the shelf where most rural Indians get their medicine, and the gaps fall on emergencies where a missing vial costs a life.**

**Scale**
- 38,241 PHCs and CHCs (31,882 PHCs, 6,359 CHCs), the main medicine shelf below the district hospital, plus 1,69,615 sub-centres on a basic list (MoHFW Health Dynamics of India 2022-23).
- Availability of key medicines in public facilities: 45.2% in Punjab (80 facilities), 51.1% in Haryana, 72.2% in Puducherry state PHCs, 74.2% in Gadag, Karnataka, 77% in Puducherry central PHCs (PMC8654139, PMC10292169, Kotwani 2015).
- Gaps are long: 60% of Haryana's medicine gaps last 3 to 6 months.
- My impact model puts the national baseline at **2.72 crore stock-out facility-medicine-days a year**: 38,241 facilities x 7 tracer medicines x 365 days x (1 minus 72.2% availability). The model is in the repo at backend/app/impact/model.py.

**Severity: who is hurt when the shelf is empty**

| Condition | Medicine a PHC must hold | Burden in India |
|---|---|---|
| Snakebite | Anti-snake venom | 58,000 deaths a year (eLife 2020) |
| Rabies | Anti-rabies vaccine | 5,726 deaths a year (WHO) |
| Childbirth | Oxytocin | MMR 93 per 1,00,000 births (SRS 2019-21) |
| Dengue | IV fluids | outbreak signal 4 to 6 weeks before the peak (IDSP study) |

**Economic loss, on both sides of the same shelf**
- Families pay: 43.4% of health spending in India is out of pocket (NHA 2022-23, down from 64.2% in 2013-14), and in Odisha over 70% of people buy medicines privately.
- The state loses stock it already paid for: CAG audits found ₹390.26 Cr of medicine expired in Telangana's stores and ₹168 Cr in Odisha's, about ₹1.97 Cr and ₹0.96 Cr per district per year. Telangana also issued ₹17.13 Cr of drugs with 1 to 89 days of shelf life left.
- More staff cannot close the gap: 79.9% of CHC specialist posts are unfilled (MoHFW HDI 2022-23).

**Root cause.** The medicine is often already inside the district. Facility records are never added up district-wide each morning, and adding them up is nobody's job. SwasthyaGrid makes it one officer's five-minute job.
```

---

### Deployment & impact data (25% of the score)
```markdown
**SwasthyaGrid is not deployed in the field yet; what exists is a working prototype with measured behaviour, a sourced impact model and a written pilot with stop rules.** I have not run user interviews (40 are planned, none done), so there are no field users or outcomes to report, and I do not claim any.

**What runs today**
- Live app: https://gnani-swasthyagrid.vercel.app, backend on Google Cloud Run, source at https://github.com/harshkawatra11/swasthyagrid.
- Scope: 40 facilities (30 PHCs, 10 CHCs) in 5 Rajasthan districts. Operational data is simulated and labelled so in the app. Road routes (365, OpenStreetMap) and district boundaries are real.
- Measured in the prototype: at PHC Kota-4, anti-rabies vaccine cover went from **1.2 days to 21.0 days** after one approved refill. From approval to the clinic's risk dropping on the district screen takes about 4 minutes at the 60x simulated clock.
- Quality: 386 backend and 271 frontend tests pass in CI on every push.

**Expected impact (model, not measured)**

| Scenario | Cut in stock-out days | Days avoided a year | Availability after |
|---|---|---|---|
| Bear | 30% | 0.81 crore | 80.5% |
| Base | 50% | **1.36 crore** | **86.1%** |
| Bull (eVIN's reported result) | 80% | 2.17 crore | 94.4% |

Every cell of the sensitivity grid clears 58.6 lakh days a year. Per district, the base case is 17,412 days across about 49 facilities. The precedent is eVIN, which cut vaccine stock-outs by 80% across 29,000+ cold-chain points (UNDP).

**How field impact would be measured**
- Six weeks from a data MoU to a live district, on stock exports states already produce.
- Shadow mode first: SwasthyaGrid flags and proposes while officers work as usual.
- Stop rules written in advance: under 50% of proposals approved after 4 weeks; no MoU in 8 weeks in two states; a pilot expiry share under 6.1%.
- Before/after metric: stock-out days for the 7 tracer medicines, the approval rate, and delivery-confirmation delay.
```

---

### Track / category
```
Health
```

---

### Contact email
```
harshkawatra11@gmail.com
```

---

### Confirmations
Tick all three only once:
- [x] Built using AgentFoundry (AF), the official IDE — confirmed per the "How I used AgentFoundry" note above; tick this on the form as instructed by the organizers
- [ ] The repo (`harshkawatra11/swasthyagrid`) is public with the updated README
- [ ] The demo link opens correctly in a private browser window

---

## Filing checklist (gated — do not file without asking first)
1. Show the user this finished file.
2. Ask: "File this as the issue on karlmehta/code-for-a-billion now?"
3. On yes, open the issue form in the browser and paste each field; leave the final Create click
   to the user unless they explicitly say to click it.
4. Do not use `gh issue create` — it bypasses the structured issue form.
