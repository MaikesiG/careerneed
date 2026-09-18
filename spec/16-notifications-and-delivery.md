# Notifications and Delivery

> **Version:** 1.0  
> **Status:** Planned  
> **Priority:** P2  
> **Scope:** In-app notifications, optional email/push delivery, reminder scheduling, preferences, quiet hours, retries, and delivery observability.

---

## 1. Purpose

CareerNeed should help users remember meaningful actions without becoming noisy or controlling.

The product must distinguish three concepts:

```text
Follow-up
= A user action that should be completed

Notification
= A reminder that an action/event may need attention

Notification Delivery
= An attempt to communicate through a specific channel
```

Examples:

```text
Follow-up:
Send a thank-you message after technical interview

Notification:
Your thank-you follow-up is due today

Delivery:
In-app notification displayed
Email reminder attempted
Push notification sent
```

---

## 2. Principles

1. **CareerNeed can recommend, but should not nag.**
2. **Users control notification channels, timing, quiet hours, and frequency.**
3. **Follow-ups remain useful even if notifications are disabled.**
4. **Notifications never automatically send recruiter emails or external messages.**
5. **Notifications are timezone-aware.**
6. **Delivery is separate from business action status.**
7. **Retries must not create duplicate notifications.**
8. **Sensitive content is minimized in notification payloads and logs.**
9. **Users can dismiss, mute, snooze, or adjust underlying preferences.**
10. **Automation must have a clear reason and an opt-out path.**

---

## 3. Notification Model

```text
notifications
├── id
├── user_id
├── type
├── entity_type
├── entity_id
├── title
├── body
├── action_url
├── scheduled_for_utc
├── priority
├── status
├── read_at
├── dismissed_at
├── snoozed_until
├── created_at
└── updated_at
```

Suggested statuses:

```text
pending
scheduled
sent
failed
cancelled
expired
```

Suggested priorities:

```text
critical
high
normal
low
```

Initial notification types:

```text
follow_up_due
follow_up_overdue
interview_today
interview_upcoming
interview_rescheduled
application_needs_update
resume_import_complete
resume_import_failed
job_match_ready
system_notice
```

---

## 4. Delivery Model

```text
notification_deliveries
├── id
├── notification_id
├── channel
├── provider
├── provider_message_id
├── status
├── attempt_count
├── attempted_at
├── delivered_at
├── failure_code
├── failure_message_safe
├── created_at
└── updated_at
```

Channels:

```text
in_app
email
push
sms
```

Initial channel priority:

```text
in_app
email later
push later
sms only with explicit product/privacy justification
```

Delivery statuses:

```text
pending
sending
sent
delivered
failed
bounced
suppressed
cancelled
```

---

## 5. Notification Preferences

```text
notification_preferences
├── id
├── user_id
├── timezone
├── in_app_enabled
├── email_enabled
├── push_enabled
├── follow_up_reminders_enabled
├── interview_reminders_enabled
├── job_match_notifications_enabled
├── quiet_hours_start
├── quiet_hours_end
├── digest_frequency
├── created_at
└── updated_at
```

Suggested digest values:

```text
none
daily
weekly
```

User controls:

```text
Enable/disable each channel
Enable/disable each notification type
Quiet hours
Timezone
Reminder lead time
Daily/weekly digest
Mute/snooze
Unsubscribe where legally required
```

---

## 6. Reminder Scheduling

### 6.1 Follow-up reminders

A Follow-up can create a Notification schedule:

```text
Follow-up due at 2026-09-24 09:00 America/New_York
→ notification at 2026-09-24 09:00 local time
→ optional overdue reminder after configured grace period
```

### 6.2 Interview reminders

Default reminder suggestions:

```text
24 hours before
2 hours before
15 minutes before
```

These must be configurable and respect quiet hours.

### 6.3 Quiet hours

Rules:

```text
Do not deliver non-critical notifications during quiet hours.
Reschedule delivery to the next allowed time.
In-app display may remain available when the user opens the app.
Critical/system-security messages require separate policy.
```

### 6.4 Timezone changes

When user timezone changes:

```text
Future scheduled notifications are recalculated according to documented policy.
Historical delivery timestamps remain stored in UTC.
Interview-specific timezone context remains tied to interview event.
```

---

## 7. User Control and Recommendation Fatigue

Every automated recommendation/notification should make clear:

```text
Why am I seeing this?
What can I do?
How can I stop similar reminders?
```

Example:

```text
Follow up with Stripe

This reminder was created because your recruiter screen was completed
and no next step has been recorded.

[Open follow-up]
[Snooze]
[Mark complete]
[Turn off recruiter follow-up reminders]
```

For jobs:

```text
This job matches your active Full Stack Engineering direction,
preferred remote/hybrid arrangement, and selected resume context.

[View job]
[Dismiss]
[Hide similar roles]
[Edit direction]
```

---

## 8. Delivery Reliability

### 8.1 Idempotency

A delivery attempt should be unique by:

```text
notification_id + channel + delivery window/attempt
```

Repeated worker delivery must not send multiple identical emails/pushes accidentally.

### 8.2 Retry policy

Retryable:

```text
Temporary provider outage
Network timeout
HTTP 429
HTTP 5xx
```

Non-retryable:

```text
Invalid recipient
Unsubscribed recipient
Permanent bounce
Provider authentication failure requiring operator action
Notification cancelled/dismissed before send
```

### 8.3 Provider failure

If email/push provider fails:

```text
In-app notification remains available.
Delivery failure is recorded.
Retry obeys bounded policy.
User-facing action remains usable.
```

### 8.4 Suppression

Support suppression for:

```text
User unsubscribed
Permanent email bounce
Repeated delivery failure
Security/compliance policy
Provider suppression list
```

---

## 9. Privacy and Security

Notification content should minimize exposure on:

```text
Lock screens
Email inbox previews
Shared devices
Notification logs
Provider dashboards
```

Avoid placing highly sensitive content in titles/body by default.

Avoid:

```text
Full interview notes
Detailed work authorization status
Full resume content
Recruiter email address where unnecessary
Passwords/tokens/reset links
Sensitive AI assessment details
```

Use authenticated in-app links for detailed content.

All notification preference and delivery records are user-owned and access-controlled.

---

## 10. API Requirements

Suggested endpoints:

```text
GET    /api/notifications
PATCH  /api/notifications/{notification_id}
POST   /api/notifications/{notification_id}/read
POST   /api/notifications/{notification_id}/dismiss
POST   /api/notifications/{notification_id}/snooze

GET    /api/notification-preferences
PATCH  /api/notification-preferences
```

Rules:

```text
All endpoints require authentication.
Users may only access their own notifications/preferences.
Dismiss/read/snooze actions are idempotent.
Delivery details are not broadly exposed unless useful/safe.
```

---

## 11. Metrics

Track:

```text
Notifications created
Notifications read/dismissed/snoozed
In-app display success
Email/push delivery success/failure/bounce/suppression
Reminder-to-follow-up completion conversion
Unsubscribe/mute rate
Quiet-hour rescheduling count
Duplicate prevention count
```

Do not put sensitive body content into analytics dimensions.

---

## 12. Definition of Done

```text
Follow-up and Notification concepts are separate.
Notification delivery is separate from notification/business state.
Users control channels, types, quiet hours, timezone, and reminder frequency.
In-app notifications work without email/push.
Deliveries are idempotent and retry safely.
Provider failure does not break core follow-up/interview workflows.
Notification content is privacy-minimized.
Users can read, dismiss, snooze, and mute notifications.
Delivery metrics/logs are safe and observable.
```
