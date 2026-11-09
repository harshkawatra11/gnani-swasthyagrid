# National Startup Awards 6.0 — submission draft

Category: Student Innovator / Aspiring Entrepreneur, sub-category **Emerging Entrepreneurs (18+)**.
DPIIT recognition is not required for this category.

Deadline is reported inconsistently (20 or 30 Nov 2026). Submit by **18 Nov 2026** to be safe.
Confirm the exact date on the portal or via 1800 115 565 / startup.support@investindia.org.in.

---

## N1. Category, theme and team

- **Saptadhara dropdown:** choose **Technology and Innovation**. (This is the "Saptadhara scheme"
  from the screenshot — "Shakti ki Sapta Dhara".) Fallback only if that option is absent from the
  dropdown: **Gati Shakti: Seamless and High-Speed Connectivity**.
- **Development stage:** pick "Working model" if the dropdown offers it, otherwise "Prototype".
  Never pick "MVP" — there are no real field users yet.
- **Team member details:** Harsh Kawatra only, Delhi Technological University (DTU). The user fills
  personal fields themselves (DOB, parents' names, year of study, State/UT, district, contact).
- **State/UT and district:** must be the user's true residence or institution state — this decides
  which State Nodal Agency scores the application.

---

## N2. "Describe your innovative idea aligned to national priorities and India's vision."

Check the live character counter on the actual form first, then paste the matching version.

### Version A — about 1,050 characters (use if limit is 1,000–1,999 chars)
```
SwasthyaGrid moves the medicine a district already owns before the state buys more. India has 38,241 Primary and Community Health Centres (MoHFW HDI 2022-23), and state studies find up to one in three key medicines missing from a PHC shelf on a given day, while CAG audits found ₹558 Cr of medicine expired in the stores of just two states. When a shelf is empty, families buy privately: 43.4% of India's health spending is out of pocket (NHA 2022-23).

SwasthyaGrid computes days of cover for every medicine at every facility, flags anything under 5 days, and proposes a refill or a transfer from a nearby clinic using real road distances. A district officer approves every move, and a voice assistant explains the reasons in Hindi, Hinglish or English. The working prototype covers 40 facilities in 5 Rajasthan districts on simulated stock data; in one run, anti-rabies vaccine cover at PHC Kota-4 rose from 1.2 to 21.0 days after one approval. My model estimates 1.36 crore stock-out days avoided a year nationally, in line with Viksit Bharat@2047's goal of dependable public health care.
```

### Version B — about 2,100 characters (use if limit is ≥ 2,000 chars)
Version A's two paragraphs, plus:
```
It is built for India's federal structure: health is a State subject, so each state runs its own deployment and its data stays home, while every district uses the same audited rules. A district needs no new hardware: it reads the nightly stock export the state already produces, and clinic staff confirm deliveries on a phone. The plan is a paid pilot of ₹12 lakh per district a year, 0.25% of a district's central NHM share, going live six weeks after a data MoU, with stop rules written in advance. Every number SwasthyaGrid shows comes from plain arithmetic an auditor can recompute, and the language model only explains it. Live prototype: gnani-swasthyagrid.vercel.app. Source: github.com/harshkawatra11/swasthyagrid.
```

### Version C — under 500 characters
```
SwasthyaGrid is a working AI control room for medicine supply at Primary Health Centres. It flags medicines under 5 days of cover and proposes refills or nearby transfers by road distance; an officer approves each move and a Hindi or English voice assistant explains it. Prototype: 40 facilities, 5 Rajasthan districts, simulated data. My model estimates 1.36 crore stock-out days avoided a year across India.
```

---

## N3. Possible extra fields (from Annexure I; draft each if the form shows it)

**Problem being addressed:**
```
Medicine shortages at Primary Health Centres are usually noticed after a patient has been turned away. Public facilities in India have about 72.2% of essential medicines in stock on a given day (PMC8654139, range 66 to 80%). The cost lands on poor families: out-of-pocket spending is 43.4% of total health expenditure (NHA 2022-23). Gaps in emergency medicines matter most. India records about 58,000 snakebite deaths a year (eLife 2020) and about 5,726 rabies deaths a year (WHO, as cited in the deck).
```

**How it works:**
```
1. Each facility's stock and daily use are loaded. Today this is simulated data; in a pilot it would come from the state's existing stock exports.
2. Days of cover is calculated as units divided by average daily use. Items below 5 days are flagged. Items below 3 days, or emergency medicines below 5 days, are marked critical.
3. The engine proposes a warehouse refill to 21 days, or for critical items a same-district transfer within 40 km by road.
4. An officer approves, modifies or rejects each proposal.
5. A truck is dispatched on a real road route, and clinic staff confirm receipt on a phone.
6. The district view updates live.
```

**What is new:**
```
Most stock tools record what happened. SwasthyaGrid goes from a flag to a costed, road-routed fix that an officer can approve in one click. Every number comes from rules an auditor can recompute, and AI is used only to explain them, in Hindi or English, by voice. Deliveries confirmed at the clinic close the loop back to the district view.
```

**Intended users / beneficiaries:**
```
Direct users are district drug store and programme officers, and PHC and CHC pharmacists who confirm deliveries. The beneficiaries are patients at rural public facilities, especially those needing emergency medicines such as anti-rabies vaccine and anti-snake venom.
```

**Expected impact:**
```
National baseline: 2.72 crore stock-out facility-medicine-days a year (38,241 facilities, 7 tracer medicines, 72.2% availability; own model). Scenarios:
- 30% cut: 0.81 crore days avoided (availability rises to 80.5%)
- 50% cut: 1.36 crore days avoided (86.1%)
- 80% cut: 2.17 crore days avoided (94.4%); this is the cut eVIN reported for vaccines (UNDP)

These are model estimates and will be checked in the pilot.
```

**Scalability:**
```
SwasthyaGrid runs per district and per state on cloud hosting, with no new hardware. Clinic staff need only a phone. Each state can keep its own data in an Indian cloud region, which fits health being a State subject. eVIN shows the pattern works at national scale: it now covers 29,000+ cold-chain points across 733 districts (UNDP).
```

**Business model / sustainability** — only include the ₹12 lakh figure if comfortable defending it
(it is an untested assumption from the research file, not a signed price):
```
State health departments or NHM district units pay an annual licence per district, with hosting and support included. As a working assumption, the price would be about ₹12 lakh a year per district. That figure is untested, and the pilot will measure the real cost. Procurement would go through existing NHM programme budgets, starting with one district, then a state, then neighbouring states.
```

**Inclusivity (if asked):**
```
SwasthyaGrid is built for rural PHC staff. It works by voice in Hindi and Hinglish, needs only a phone at the clinic, and handles stock counts only, never patient identity. It is a solo project so far; I plan to add a pharmacist and a district health officer as advisers during the pilot.
```

**Six-week pilot plan (if asked):**

| Week | Activity |
|---|---|
| 1 | Data-sharing agreement with one district under NHM; a named nodal officer; scope limited to stock counts, no patient data |
| 2 | Map the district's existing stock export into SwasthyaGrid; load facilities, warehouse and road routes |
| 3 | Logins for officers; train PHC staff on phone-based delivery confirmation |
| 4–5 | Shadow mode: SwasthyaGrid flags and proposes, the officer works as usual; log how many flags preceded real stock-outs |
| 6 | Review stock-out days for 7 tracer medicines against the earlier period, flag accuracy, approval rate and delivery-confirmation delay; decide whether to go live |

---

## N4. Upload (PDF, PPT, PPTX, PNG or JPG, 5 MB each)

All five files are built and sit in `submission/` in the repo, ready to attach:

| # | File | Actual size |
|---|---|---|
| 1 | `Harsh_Kawatra_SwasthyaGrid_NSA6_Deck.pdf` | 3.24 MB |
| 2 | `SwasthyaGrid_01_Command_Centre.jpg` | 0.16 MB |
| 3 | `SwasthyaGrid_02_Recommendations.jpg` | 0.39 MB |
| 4 | `SwasthyaGrid_03_Voice.jpg` | 0.18 MB |
| 5 | `SwasthyaGrid_04_Dispatch.jpg` | 0.39 MB |

If the form field accepts only one file, upload the deck PDF only (it should already carry the
product screenshots as an appendix via the deck's S6-equivalent).

---

## N5. Declaration

The user ticks the declaration box and clicks submit themselves. Claude does not submit this form.

---

## Open items only the user can resolve
1. Confirm age / DOB (must be 18+ for Emerging Entrepreneurs).
2. Confirm State/UT and district to enter.
3. Confirm the exact deadline (20 vs 30 Nov) — submit by 18 Nov regardless.
4. Check the actual character limit on the idea-description textarea and pick Version A/B/C.
5. Confirm whether the upload field takes one file or several.
6. Decide whether to include the ₹12 lakh licence figure.
7. Decide whether to add real advisers (up to 4 team members allowed) for the diversity score —
   never add the former teammate.
