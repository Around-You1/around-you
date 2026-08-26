# Around You — Google Play "Data Safety" form cheat sheet

Fill this in under **Play Console → App content → Data safety**. Answers below reflect Around You's current behaviour. **Verify each one against your actual app/SDKs before submitting** — Google cross-checks these declarations against your app binary, and wrong answers get the app rejected or removed. Items marked ⚠️ are conditional and depend on choices you need to confirm.

---

## Section 1 — Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (all traffic is over HTTPS/TLS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — provide your deletion URL/route (in-app account deletion and/or email to privacy@aroundyou.co.za) |

Notes:
- "**Collected**" = data leaves the device to your servers. "**Shared**" = data is transferred to a **third party** (a separate company acting as its own controller). Cloud/hosting/email/moderation vendors acting **on your behalf** (operators/processors) do **not** count as "shared."
- When a user taps **Directions** and you hand off to a maps app, that's a user-initiated action — it is generally **not** "sharing" for this form, but do confirm.

---

## Section 2 — Data types (tick "Collected", set purposes)

Legend for **Purposes**: AF = App functionality · AM = Account management · AN = Analytics · DC = Developer communications · FP = Fraud prevention, security & compliance · P = Personalisation

### Location
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Approximate location | **Yes** | No | Optional (permission) | AF |
| Precise location ⚠️ | **Yes if you use GPS/precise**; otherwise No | No | Optional (permission) | AF |

> ⚠️ If the app only ever uses coarse/area location, declare **Approximate only** and do **not** tick Precise.

### Personal info
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Name | **Yes** | No | Required | AF, AM |
| Email address | **Yes** | No | Required | AF, AM, DC |
| Phone number | **Yes** | No | Optional (Required for Partners) | AF, AM |
| Address | **Yes** | No | Required for Partners/listings | AF |
| User IDs | **Yes** | No | Required | AF, AM, FP |
| Other info ⚠️ | Only if you collect more | — | — | — |

### Financial info
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Other financial info (Partner banking/billing details for invoicing) | **Yes** | No | Required for Partners | AF |
| User payment info / Purchase history ⚠️ | **No** (no in-app purchases; partner billing is via invoice/EFT) — tick only if that changes | — | — | — |

### Photos and videos
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Photos | **Yes** (Partners/listings upload images) | No | Optional | AF |

### App activity
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| App interactions | **Yes** | No | — | AF, AN |
| In-app search history | **Yes** (search terms) | No | — | AF, AN |
| Other user-generated content (ratings, reviews, listing content) | **Yes** | No | — | AF |
| Installed apps / Other actions | **No** | — | — | — |

### App info and performance
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Crash logs ⚠️ | **Yes if you use a crash/diagnostics SDK**; else No | No | — | AF, AN |
| Diagnostics ⚠️ | Same as above | No | — | AF, AN |

### Device or other IDs
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Device or other IDs (incl. IP address) | **Yes** | No | — | AF, FP, AN |

### Data types to mark **NOT collected** (unless something changes)
Messages · Contacts · Calendar · Audio files · Music files · Health & fitness · Web browsing history · SMS/Call logs · Sexual orientation, race, religious/political beliefs.

> Note: support emails you receive are handled outside the app (email), so you can leave **Messages = No** for in-app collection. Confirm this matches your setup.

---

## Section 3 — Per–data-type follow-ups
For every type you ticked "Collected", Play will ask:
- **Is this data processed ephemerally?** → **No** for anything you store (account, listings, location history, activity). Tick "processed ephemerally" only for data used in memory and never stored.
- **Is this data required or can users choose?** → use the "Optional?" column above.
- **Why is this data collected?** → tick the purposes listed above.

---

## Before you submit — checklist
- [ ] Confirm **Approximate vs Precise** location matches the permission your build actually requests.
- [ ] Confirm whether a **crash/analytics SDK** is bundled (Crashlytics, Firebase, etc.); if yes, tick Crash logs/Diagnostics and revisit "Shared".
- [ ] Confirm no bundled **advertising/attribution SDK** shares data (if one does, several rows flip to "Shared").
- [ ] Make sure the **Privacy Policy URL** is live and consistent with these answers.
- [ ] Provide a working **data-deletion** method and URL.
