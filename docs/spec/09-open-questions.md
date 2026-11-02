## 10. MVP definition of done, metrics and open questions

The MVP is done when three pilot companies can run a real week of work in it, with most employee updates arriving through WhatsApp or the phone.

### 10.1 Definition of done

- [ ] All acceptance criteria in Section 6 pass on the deployed system.
- [ ] A company with 30 employees can be set up from a CSV in under 30 minutes.
- [ ] An employee can receive, update and complete a task using only WhatsApp.
- [ ] Cross-company access tests pass on every endpoint.
- [ ] A database backup has been restored successfully once.
- [ ] The product is deployed with error tracking and a status check.
- [ ] At least one pilot company has used it for a full working week.

### 10.2 Metrics to record from day one

These come from the Lean Canvas key metrics. Log an event for each so they can be counted later.

| Metric | Event or query |
| --- | --- |
| Businesses registered | `company_created` |
| Active businesses | Companies with at least one task created or updated in the last 7 days |
| Monthly active users | Distinct users with any action in the last 30 days |
| Tasks and employees managed | Count of tasks and active employees per company |
| Channel mix | Share of status updates made via app and via WhatsApp |
| Customer retention | Companies still active 30 and 60 days after sign-up |
| Paid subscriptions and MRR | Added in the billing milestone after the MVP |

### 10.3 Open questions for the product owner

1. Who owns the Meta business account, and has the Work Merge WhatsApp number been verified? Template approval takes time, so start early.
2. Is the target 5 to 50 or 10 to 50 employees? The Lean Canvas and the competitive document differ.
3. Should a task have one assignee or several? This document assumes one for the MVP.
4. Is English enough for the MVP, or is Luganda needed at launch?
5. Is there a brand name style, logo and colour palette to replace the placeholder tokens in 7.2?
6. Will billing stay manual during the pilot? The plan assumes UGX 50,000 per company per month after the free trial, invoiced manually.
7. Where should data be hosted, and do any pilot customers have data-location requirements?
8. Can one person belong to more than one company? The schema allows it, but the MVP screens assume one.
