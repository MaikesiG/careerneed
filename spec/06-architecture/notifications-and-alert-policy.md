# Architecture: Notifications, In-App Alerts, and Quiet Hours Policy

> **Status:** Planned (Phase 2 & Phase 4 Delivery Architecture)  
> **Owner:** CareerNeed Platform & Notification Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Three-tier notification domain model, in-app-first alert policy, quiet hours, duplicate suppression, digest thresholds, and dismissal learning loops.

---

## 1. Three-Tier Notification Architecture

To prevent architectural confusion, CareerNeed strictly separates business actions from reminder events and channel delivery:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THREE-TIER NOTIFICATION ARCHITECTURE                  │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Follow-up        │ The underlying business obligation or task            │
│    (Business Action)│ (e.g. "Send thank-you email to Stripe interviewer").  │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Notification     │ The reminder object representing candidate attention  │
│    (Reminder Event) │ (e.g. "Thank-you note for Stripe is due today").      │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Delivery         │ The physical attempt to deliver across a channel      │
│    (Channel Attempt)│ (e.g. In-App Banner displayed, Email sent via Resend).│
└─────────────────────┴───────────────────────────────────────────────────────┘
```

**Key Invariant**: If all notification deliveries fail or notifications are completely disabled by the user, the underlying `FollowUp` task remains fully visible and actionable on the Today dashboard.

---

## 2. In-App-First Delivery Policy

CareerNeed adopts a strict **In-App-First** delivery stance:
1. **Initial Channel**: All alerts (overdue follow-ups, interviews today, high-priority job matches) are delivered primarily as in-app notification badges and banners within the web application shell.
2. **Controlled Email Digests**: Optional, opt-in daily or weekly summaries delivered during business hours.
3. **External Messaging Deferral**: Multi-channel external notifications (Telegram, WhatsApp, mobile push, SMS) are **strictly deferred** until in-app alert quality, signal-to-noise ratios, and dismissal feedback loops are thoroughly established.

---

## 3. Tiered Delivery & Digest Thresholds

Alerts are prioritized into tiers to eliminate notification fatigue:

| Priority Tier | Match Score / Event Trigger | Delivery Mechanism | Quiet Hours Rescheduling |
|---|---|---|:---:|
| **Immediate High Priority** | • Match Score $\ge 85$<br>• Interview scheduled within 2 hours<br>• Critical security notice | Immediate in-app alert banner & notification badge. | Dispatched immediately if critical; held if quiet hours active. |
| **Batch Digest** | • Match Score 70–84<br>• Follow-ups maturing tomorrow<br>• Weekly routine reminders | Aggregated into candidate's selected daily/weekly summary. | Delivered only during approved delivery windows. |
| **Silent Stream** | • Match Score 55–69<br>• Routine completion notices | Placed quietly in the Jobs workspace or activity log. | Never triggers notifications or sound alerts. |

---

## 4. User Controls and Quiet Hours

Candidates maintain complete control over their notification envelope:
- **Quiet Hours**: Users configure an active blackout window (default: `22:00` to `08:00` in user's local timezone). Non-critical alerts are queued and held until quiet hours conclude.
- **Channel Opt-Out**: Users can disable email digests entirely while retaining in-app badges.
- **Duplicate Suppression**: Job updates or repeated ATS crawls never emit duplicate notifications for the same `(user_id, job_id, event_type)`.
- **Dismissal Learning Loop**: Dismissing three consecutive alerts for the same category (e.g. "Wrong role") prompts an automatic suggestion to refine the underlying Career Direction preferences.
