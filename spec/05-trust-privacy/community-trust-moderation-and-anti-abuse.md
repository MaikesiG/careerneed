# Community Trust, Moderation, and Anti-Abuse Standards

> **Status:** Planned (Phase 5–6 Governance Standard)  
> **Owner:** CareerNeed Trust & Safety  
> **Last Updated:** 2026-09-19  
> **Scope:** Threat models, pre-moderation workflows, anti-farming controls, delayed reward settlement, PetCoin transaction ledgers, and internal trust scores.

---

## 1. Threat Model for Career Intelligence Communities

An open career platform faces adversarial threats:
- **AI-Generated Spam & Synthetic Posts**: Mass generation of generic interview questions to farm rewards.
- **Copyrighted / Leaked NDA Materials**: Unredacted proprietary source code or proprietary take-home assignments.
- **Multi-Account Sybil Farming**: One bad actor creating multiple accounts to upvote or tip their own posts.
- **Circular Tipping Rings**: Coordinated groups exchanging virtual coins to manipulate reputation.
- **Defamation & Unverified Corporate Accusations**: Groundless harassment or unsubstantiated HR allegations.
- **False Compensation Claims**: Inaccurate, inflated salary numbers designed to distort market benchmarks.

---

## 2. Baseline Trust & Anti-Abuse Controls

CareerNeed enforces multi-layered defenses to maintain a high-signal intelligence collective:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MULTI-LAYER TRUST & SAFETY CONTROLS                   │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Identity & Age   │ Verified email required. Account must be active for   │
│    Gating           │ >=14 days with verified private product activity.     │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Pre-Moderation   │ All rewarded contributions undergo human or trusted   │
│    for Rewards      │ heuristic review before public release.               │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Similarity Checks│ Submissions are checked for near-duplicates across    │
│                     │ existing question banks to prevent copy-paste farming.│
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 4. Delayed Reward   │ Earned PetCoins enter a 48-hour pending escrow period │
│    Settlement       │ before crediting, allowing abuse detection.           │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 5. Fixed Tip Limits │ Contributor tips use standardized fixed amounts       │
│                     │ (e.g. 5 coins); no arbitrary bulk money transfers.    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 6. Auditable Ledger │ Double-entry transaction ledger for all point flows;  │
│                     │ enables one-click administrative reversal of fraud.   │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Strict Boundary on Internal Trust Scores

The platform maintains an internal **Trust Score** (`user_trust_scores`) strictly for risk scoring, spam filtering, and rate-limiting:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRUST SCORE NON-NEGOTIABLE INVARIANT                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    The internal Trust Score is EXCLUSIVELY an anti-abuse moderation metric. │
│                                                                             │
│    It may NEVER be exposed to employers, used to assess candidate ability,  │
│    used as a proxy for technical skill, or used to entitle candidates to    │
│    better job recommendation rankings.                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Moderation, Reporting, and Fraud Reversal Workflow

```text
Public Contribution ──► Flagged by User / Anomaly Engine ──► Moderation Queue
                                                                   │
                                                                   ▼
Reputation Revoked ◄── Fraud Confirmed (Reversed) ◄── Administrative Review
```

1. **User Flagging**: Community members can report inaccurate questions, outdated information, or inappropriate content.
2. **Automated Anomaly Triggers**: Sudden spikes in upvotes from accounts created from the same IP range trigger immediate freeze.
3. **Ledger-Backed Reversal**: If a contribution is found to be fraudulent or plagiarized, administrators execute a transaction reversal that rolls back all awarded PetCoins and badge progress from the offender's ledger.
