# Neela Events CRM — Change Request Document

**Tested:** June 8, 2026  
**Total Items:** 26  
**Structure:** 5 phases grouped by implementation difficulty (Phase 1 = easiest, Phase 5 = most complex)

---

## Phase 1 — Quick Bug Fixes & UI Corrections
> Small, isolated fixes. Each item is a contained change with no major dependency on other modules.

---

### Fix 5 · Stop Auto-Download on Quotation Send
**Problem:** Pressing "Save & Send" in the quotation module auto-downloads the PDF, which should not happen. The WhatsApp button on the quotation page also triggers an unwanted auto-download before the user presses "Save & Send."  
**Expected:** No PDF should download automatically. The download should only happen when the user explicitly clicks a download button.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → click the **Reqs** tab → find a requirement card → click the **"Quotation"** button → fill details → click **"Save & Send"**  
> No PDF will auto-download. Only clicking the explicit **Download PDF** button triggers a download.

---

### Fix 7 · Shorten Quotation Link
**Problem:** The quotation share link is too long and looks unprofessional when sent over WhatsApp or SMS.  
**Expected:** Generate a shorter, readable link (e.g., a slug or short URL) for the quotation.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Reqs** tab → find a requirement card → click **"Quotation"** → complete the steps → on the final step click **"Save & Send"** → the WhatsApp message will contain the short link  
> The link will now look like: `localhost:8080/quotation/ab3xf9k2` (8 characters) instead of a long UUID.

---

### Fix 13 · Complete the Sidebar Navigation
**Problem:** The left sidebar currently only shows a few modules (Dashboard, Leads, Calendar, Bookings). All other built modules are missing from the navigation.  
**Expected:** All built modules should be listed in the sidebar. On mobile, these should be accessible through a hamburger menu to switch between sections cleanly.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/dashboard` → look at the **left sidebar**  
> All 15+ modules are now listed: Dashboard, Leads, Bookings, Quotations, Calendar, Follow-ups, Tasks, Campaigns, Venue Meetings, Customers, Not Interested, Stale Leads, Reports, Transfers, Settings. On mobile, tap the **hamburger icon (☰)** to open the full navigation sheet.

---

### Fix 15 · Improve Login Page & Overall UI Appearance
**Problem:** The company login page and the general interface are not visually attractive enough for a client-facing CRM.  
**Expected:** Redesign the login page and improve the overall interface appearance to look professional and polished.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/login`  
> The page now has a gradient background, two-panel layout (brand panel on left, login form on right), tabs for **Email** and **Phone OTP** login, polished typography and icons.

---

### Fix 17 · View Invoice Should Open Existing Invoice
**Problem:** Pressing "View Invoice" recreates or reopens the invoice editor instead of displaying the already-generated invoice.  
**Expected:** "View Invoice" should open the exact invoice that was previously created or sent — it must not allow re-editing or regeneration.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Reqs** tab → scroll down past the requirement cards to the quotations list → find a quotation that already has an invoice → click the **"View Invoice"** option in its menu  
> It will open `localhost:8080/invoice/{token}` — the read-only public invoice page. The editor will not open again.

---

### Fix 18 · Validate Mobile Number and Email
**Problem:** There is no validation check when a mobile number or email address is entered in the system.  
**Expected:** Validate mobile number format (10-digit Indian number) and email format at the point of entry. Show a clear error if the format is invalid.

> **✅ Solution Applied**  
> **Where to see (phone):** `localhost:8080/login` → click the **Phone OTP** tab → enter a number that is not 10 digits → an inline error message appears  
> **Where to see (email):** `localhost:8080/leads/{leadId}` → Requirements tab → open a requirement form → enter a badly formatted email → an inline error message appears

---

### Fix 20 · Remove Extra Qty/Unit/Pcs Box from Quotation
**Problem:** In the quotation form there is a redundant extra box showing "qty," "unit," and "pcs" alongside the quantity field.  
**Expected:** Remove the extra box. Keep only what is necessary for quantity input.

> **⚠️ Partial — Needs Verification**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Reqs** tab → find a requirement card → click **"Quotation"** → go to the **Add-ons** step  
> The add-on rows currently still show a 3-column grid: Qty, Unit ₹, and Line total. The standalone "pcs" label may still appear next to add-ons in the summary. Full cleanup is still pending.

---

## Phase 2 — Settings, Configuration & Navigation Fixes
> Changes that require updates to the Settings module, data model fields, or navigation routing. Each fix is independent but touches shared configuration areas.

---

### Fix 2 · Default Room Option in Super Admin Settings + Room Mention in Quotation
**Problem:** There is no option in the super admin settings to configure a default room/hall for a company. The quotation also does not mention which room/hall is assigned to the event.  
**Expected:**  
- Add a "Default Room" field in the super admin settings for each company.  
- Display the room/hall name in the quotation against the event details.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/settings` → scroll to the **Company Profile** section → look for the **"Default Room"** field (e.g., "Lotus Hall")  
> Once saved, the room name will appear in the quotation details on `localhost:8080/leads/{leadId}` → **Reqs** tab → quotations list, and also on the public quotation link.

---

### Fix 3 · Session Selection in Requirements
**Problem:** The sessions option configured in Settings is not available as a selectable field inside the Requirements module. Staff currently have no way to select a session for a requirement.  
**Expected:** In the Requirements form, add a session selector. Staff should be able to either pick from the sessions defined in Settings or manually enter a start time and end time based on the situation. Do not rewrite existing code — add this field and replace the placeholder if one exists.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Reqs** tab → click **"New requirement"** or tap an existing requirement card to edit it → look for the **Session** dropdown inside the form  
> It shows sessions configured in Settings. For mandapam venues, the field is mandatory. For others, staff can pick a session or type start/end times manually.

---

### Fix 4 · Integration Options in Settings (Per Company + Universal)
**Problem:** There is no place in Settings where a company can add or configure third-party integrations (e.g., IndiaMART, JustDial, payment gateways, messaging services). There is also no universal/fallback integration slot for services not listed.  
**Expected:**  
- Add an "Integrations" section in the Settings page, visible per company.  
- Allow each company to add any integration they need.  
- Include a universal integration option that accepts any service, even if it is not pre-listed.  
- This should be extensible — new integrations should not require code changes.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/settings` → scroll down to the **Integrations** section  
> Click **"Add Integration"** to add IndiaMART, JustDial, Razorpay, WhatsApp Business API, or any custom service. No code change needed for new integrations — just choose **"Custom"** type.

---

### Fix 14 · Fix Company Switching for Super Admin
**Problem:** When the super admin selects a different company from the company switcher, it does not navigate to that company's context. The page stays unresponsive. Selecting the same company also does nothing.  
**Expected:**  
- Selecting a different company should reload the app and navigate to that company's Dashboard.  
- Selecting the same company again should reload and return to the Dashboard.  
- Selecting "All Companies" should reload and show the cross-company overview.  
- The current page must not remain stuck — every company selection must trigger a reload and navigation.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/dashboard` → look at the **top of the sidebar** for the company switcher dropdown (Super Admin only)  
> Selecting any company now immediately navigates to that company's dashboard at `localhost:8080/company-dashboard/{companyId}`. Selecting **"All Companies"** shows the cross-company overview.

---

### Fix 19 · Quotation Link Shows ₹0 for Services
**Problem:** When the quotation public link is opened, the services section shows ₹0 as the amount for each service (e.g., "Hall — ₹0"), even though the correct total is shown at the bottom.  
**Expected:** Each line item in the quotation link should show the accurate amount as entered when the quotation was created. The total should match the sum of all line items.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/quotation/{token}` (the public link sent to the client — no login required)  
> Each service now shows its correct amount (price × quantity). The total at the bottom matches the sum of all line items. ₹0 no longer appears.

---

## Phase 3 — Quotation & Requirements Workflow Overhaul
> These changes require reworking the quotation lifecycle, the public quotation link, and the requirements-to-quotation flow. Items are interconnected and should be implemented together.

---

### Fix 6 · Quotation Public Link Must Open Without Login
**Problem:** The quotation share link asks the recipient to log in (currently redirecting to Lovable login). This makes it unusable for clients.  
**Expected:**  
- The quotation link must open publicly without any login or password.  
- The page should display the full quotation and offer the following options to the client:  
  - **Approve**  
  - **Request Changes**  
  - **Download PDF**  
- These actions should update the quotation status in the CRM in real time.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/quotation/{token}` — open this in a browser where you are **not logged in** (incognito window)  
> The full quotation loads without any login prompt. The client sees **Approve**, **Request Changes**, and **Download PDF** buttons. Clicking Approve or Request Changes instantly updates the status in the CRM.

---

### Fix 8 · Redirect to Requirements Page After WhatsApp Send
**Problem:** After clicking the WhatsApp send button (post "Save & Send") in the quotation module, the user is left on the quotation page with no clear next step.  
**Expected:** After the WhatsApp message is sent, automatically redirect the user to the Requirements page so they can review what has been completed and what is pending.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Reqs** tab → find a requirement card → click **"Quotation"** → complete all steps → click **"Save & Send"** → click the **WhatsApp** send button  
> After the WhatsApp message is sent, the dialog closes and the page stays on the lead profile showing the **Reqs** tab — no longer stuck on the quotation form.

---

### Fix 11 · Auto-Attach Images from Settings to "Meet at Venue" Message
**Problem:** When sending a "Meet at Venue" message, the images uploaded in Settings are not included. The message text also appears as a large unformatted block.  
**Expected:**  
- All images uploaded in the company's Settings should automatically attach to the "Meet at Venue" message when it is sent.  
- The message body should be reformatted to be organized, well-spaced, and professional in appearance.

> **❌ Not Yet Implemented**  
> **Where it should appear:** `localhost:8080/leads/{leadId}` → Activity tab → click **"Schedule Venue Meeting"** → the WhatsApp message preview should auto-include venue images from Settings  
> This is not built yet. The meeting scheduler dialog exists but images from Settings are not attached and the message body formatting has not been improved.

---

### Fix 12 · Clean Up Quotation Drafts, Versioning, and Dashboard Display
**Problem:** The quotation section is cluttered — multiple drafts exist for the same lead, the dashboard only shows the amount (no name, mobile, or view status), and there is no clear versioning of sent vs. drafted quotations.  
**Expected:**  
- **One active draft only:** Only one draft should exist per requirement. Creating a new draft for the same requirement should replace the previous one.  
- **Draft disappears on send:** Once a quotation is sent, the draft is removed. It moves to the "Sent" list, not the draft list.  
- **Activity archive:** Older/superseded drafts should be stored in the lead's Activity log, not shown in the Quotations list.  
- **Versioning:** Once v1 is sent and a revision is needed, v1 becomes read-only (viewable and downloadable, not sendable). A new v2 is created and goes through the same draft → send cycle.  
- **Dashboard quotation card:** Show lead name, mobile number, quotation amount, and whether the client has viewed the link. Add a tab to show this status clearly.  
- **Invoice triggers cleanup:** Once an invoice is generated, all prior quotation versions are archived and no longer shown as active.

> **✅ Solution Applied (core draft logic)**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Quotations** tab  
> Only one draft is shown per requirement at a time. Once sent, it moves to the Sent list and disappears from Drafts. Once an invoice is generated, prior quotation versions are archived and no longer appear as active in the list.

---

### Fix 25 · Show Invoice Alert Above All Quotation Options
**Problem:** After an invoice is generated, it is not prominently visible. Staff may not notice that a quotation has already been converted to an invoice.  
**Expected:** Once an invoice is generated for a lead, display a prominent alert/banner at the top of the quotations section for that lead. This should appear above all quotation options and clearly indicate that the invoice has been generated and is active.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Quotations** tab (on a lead that already has an invoice generated)  
> A green banner at the very top of the Quotations section reads: *"Invoice {invoice_number} generated — no further edits allowed on this quotation."* It appears above all quotation rows.

---

### Fix 10 · Clarify Final Quotation Flow for Multiple Requirements
**Problem:** It is unclear how the quotation finalisation works when a lead has more than one requirement (e.g., Requirement 1 and Requirement 2 on different dates).  
**Expected (Clarification Needed):** Each requirement should have its own independent quotation lifecycle — separate draft, sent, approved, and invoice stages. The quotation module should clearly distinguish which quotation belongs to which requirement (e.g., "R1 — Hall Booking 14 Dec" and "R2 — Catering 15 Dec"). Confirm the intended behaviour before implementing.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Quotations** tab (on a lead that has 2 or more requirements)  
> Each requirement group is labelled as **R1 — [event name · date]**, **R2 — [event name · date]**, etc. Each has its own draft → sent → agreed → invoice cycle running independently.

---

## Phase 4 — Communication, Dashboard Intelligence & Payment Flow
> These changes add smart communication features, dashboard widgets, and the payment gateway into the quotation approval flow. Multiple modules are affected.

---

### Fix 21 · WhatsApp Templates in Lead Profile with Stage-Based Suggestions
**Problem:** WhatsApp message templates are only managed in Settings. There is no way to send a template directly from a lead's profile, and there is no intelligent suggestion of which template to use.  
**Expected:**  
- Add a dedicated tab or section in the lead profile (next to Activity, Requirements, etc.) listing all available WhatsApp templates.  
- Automatically suggest the most relevant template at the top based on the lead's current stage (e.g., if quotation was sent but not yet approved, suggest a follow-up template).  
- The suggestion logic should check the lead's activity log and current status to determine the right template.  
- Before sending, allow the staff member to edit the message text.  
- Show a WhatsApp send button that opens the pre-filled message for confirmation.  
- Once sent, log the action in the lead's Activity.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → click the **WhatsApp** tab in the lead profile panel  
> All templates are listed. The most relevant one for the lead's current stage is pinned at the top (suggested). Edit the message text, then click the WhatsApp button to send. The sent message is logged in the Activity tab.

---

### Fix 22 · WhatsApp Auto-Send Tracking — Recent Sent & Next Suggested Message
**Problem:** When WhatsApp auto-send is enabled, there is no visibility into what was most recently sent or what the next recommended message should be based on the client's reply or stage progression.  
**Expected:**  
- In the WhatsApp/communication section of the lead profile, show the most recently sent automated message.  
- Based on the client's reply or the elapsed time, show the next recommended message to send.  
- This should tie into the template suggestion system from Fix 21.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **WhatsApp** tab  
> The tab shows **"Last sent: {template name}"** with a timestamp at the top. Below it, the next recommended message to send is highlighted based on the lead's current stage.

---

### Fix 23 · Dashboard — Quotation Approvals and Revision Requests as Upcoming Reminders
**Problem:** The dashboard does not surface quotations that have been approved or that have pending revision requests from clients.  
**Expected:** Add a section on the Dashboard (similar to "Upcoming Follow-ups") that shows:  
- Quotations approved by the client (awaiting invoice generation)  
- Quotations with revision requests (awaiting staff action)  
- Sort by date, with the oldest pending items shown first as they are most urgent.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/dashboard` → scroll down to find two new sections:  
> **"Approved — awaiting invoice"** and **"Revision requested — awaiting staff action"**  
> Both are sorted with the oldest items first so the most urgent ones appear at the top.

---

### Fix 24 · Payment Gateway in Quotation Approval Flow
**Problem:** When a client approves a quotation, there is no direct path to payment. The invoice is generated separately and the payment flow is disconnected. The current invoice layout also does not clearly list the services purchased.  
**Expected:**  
- When a client approves the quotation via the public link, the next step should offer payment options:  
  - **Online (Razorpay):** Process payment directly. Show a "Payment Successful" confirmation.  
  - **Cheque / Cash:** Show a message: *"Please visit our venue — our team will guide you through the payment process."*  
- The invoice/proforma should be formatted like the quotation — with a clear line-by-line breakdown of services, GST, and total.  
- The invoice should function as a proper **Proforma Invoice** and ask for the payment method before finalising.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/quotation/{token}` (open in browser without login) → click **"Approve"**  
> After approving, a payment options screen appears offering **Pay Online (Razorpay)** or **Cheque / Cash**. Online payment processes immediately and shows a success confirmation. Cheque/Cash shows the venue visit message.

---

## Phase 5 — Complex System Features & Deep Integrations
> These are the most architecturally significant changes. Each one touches multiple modules, requires new database tables or relationships, and involves end-to-end user flows. These should be planned and broken down further before development begins.

---

### Fix 1 · Lead Deduplication and Smart Merge
**Problem:** The system allows duplicate leads to be created for the same contact, especially when the same person comes in through different sources (e.g., IndiaMART, JustDial, manual entry). Currently, staff are forced to open the existing profile and manually create a new requirement, which is inefficient.  
**Expected:**  
- When a new lead is being created and a matching phone number already exists in the system, **do not create a new lead**.  
- Instead, show an alert: *"This contact already exists"* and redirect staff to the existing lead profile.  
- On the existing profile, automatically open the "New Requirement" popup so staff can add the new enquiry.  
- **Source handling:**  
  - If the lead comes from **IndiaMART or JustDial**, auto-merge the lead and append the new source to the existing profile. Merge the requirement data automatically.  
  - If the lead source is **Manual**, show a prompt informing staff that the contact already exists and guide them to the existing profile. Do not auto-merge; let the staff decide.  
- The lead profile should clearly list all sources through which the contact has reached out (e.g., "Sources: JustDial, Manual").

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/leads` → click **"+ New Lead"** → enter a mobile number that already exists in the system  
> An alert appears: *"This contact already exists in {company name} (status: {status})"* with a button to go to the existing lead. For IndiaMART/JustDial the source is auto-merged. For Manual entry, staff are guided to the existing profile to decide.

---

### Fix 9 · Double Booking, Calendar Mega View & Cross-Company Big Picture
**Problem:** The system does not warn about or display double bookings on the same date. The calendar does not show event names, timings, or layered detail. There is no cross-company overview for the super admin.  
**Expected:**  

**Double Booking Handling:**  
- When a date already has a confirmed booking, allow a second booking on the same date but clearly show what is already booked (lead name, event name, timing) before confirming.  
- The booking section should show full detail for each event on a given date: lead name, requirement details, payment status, and the assigned person — all connected and updated in real time based on each person's actions.  

**Calendar View:**  
- Mark booked dates with the event name.  
- When clicking a date, show all events scheduled for that day: event name, start and end time, and current status.  
- Below the day view, list all upcoming events in chronological order — each showing: date, time, event name, and lead name.  
- Double bookings on the same date should be visually distinct (e.g., stacked or colour-coded).  

**Cross-Company Big Picture (Super Admin):**  
- Add a mega dashboard view that shows all events across all companies in a single calendar and list view.  
- When a specific company is selected, show only that company's activity in a separate view.  
- All data shown must be connected to the lead profile, requirements, bookings, settings, and payment status — reflecting real-time updates.

> **❌ Not Yet Implemented**  
> **Where it should appear:** `localhost:8080/calendar` → double-booked dates should show a visual warning; clicking a date should show a full day breakdown  
> Super Admin cross-company view should be at `localhost:8080/dashboard` → "All Companies" mega view  
> Neither the double-booking warning nor the mega calendar has been built yet.

---

### Fix 16 · Event Coordinator Assignment System
**Problem:** There is no option to assign an event coordinator to a booking after payment is confirmed. Coordinators have no dedicated link to view their assigned event details and update progress.  
**Expected:**  

**In Settings:**  
- Add an "Event Coordinators" section where coordinators can be added with their name and mobile number.  
- Once added, coordinators should appear as assignable options in the lead profile after payment is confirmed.  

**Assignment Flow:**  
- After payment is confirmed, automatically trigger a popup prompting staff to assign an event coordinator.  
- Staff can select from the saved coordinators or enter a new name and mobile number directly.  

**Coordinator Link:**  
- Generate a unique link for the assigned coordinator (similar to the public invoice link).  
- This link should show the coordinator:  
  - Full requirement details (event date, time, event type, guest count, add-ons, special instructions)  
  - Lead name and contact  
  - Everything except payment details  
- The coordinator can update their progress using a status pole:  
  - Noted → Requirement Preparing → Almost Completed → Delivered / Completed  

**Lead Notification:**  
- Send the lead a separate view-only link showing the coordinator's progress updates. This link must not show payment details.  
- The lead's link should display: event details, coordinator name, and the current status update.  

**CRM Updates:**  
- The coordinator's progress updates must reflect in real time inside the lead profile.  
- Add an "Event Coordinator" card in the lead profile showing: assigned coordinator, all their status updates, and a timeline of their activity.  

**Reminders & Notifications:**  
- Add reminder options at each coordinator status stage.  
- When the coordinator updates their status, send a notification to the CRM staff.  
- All notifications across the system (coordinator updates, approvals, reminders, payments) must play a sound when they arrive.

> **✅ Solution Applied**  
> **Where to see:** `localhost:8080/bookings` → find a booking where payment is confirmed → a coordinator assignment popup appears automatically  
> The coordinator receives a link at `localhost:8080/event-status/{coordinator_token}` — shows full event details, no payment info. The lead receives a view-only link at `localhost:8080/event-status/{client_token}` — shows coordinator name and live progress. Both update in real time inside `localhost:8080/leads/{leadId}`.

---

### Fix 26 · Multi-Revision Requirements, Multiple Requirements per Lead & Full Coordinator Assignment Flow
**Problem:** The system does not cleanly handle multiple revisions of a requirement (R1 v1, R1 v2), does not allow a lead to have multiple independent requirements, and the full coordinator assignment flow after payment is incomplete.  
**Expected:**  

**Requirement Versioning:**  
- A single requirement (R1) can have multiple quotation revisions: R1 v1, R1 v2, and so on.  
- Once v1 is sent and a revision is requested, v1 becomes read-only (viewable and downloadable). A new v2 is created and follows the same draft → send cycle.  
- Clearly label each version in the quotation list (e.g., "R1 — v2 (Active)", "R1 — v1 (Archived)").  

**Multiple Requirements per Lead:**  
- A lead should be able to have multiple independent requirements (e.g., different event dates, different events).  
- Add a "New Requirement" button that is always visible on the lead profile as long as there is no active unclosed requirement.  
- Add an adjacent "Multiple Requirements" option that allows the lead to proceed with more than one requirement simultaneously, each with its own quotation and invoice cycle.  

**Drop / Close Requirement:**  
- Add a "Drop Requirement" option if a requirement is no longer needed.  
- Once dropped, a "New Requirement" button should become visible for that lead.  

**Post-Payment Coordinator Assignment:**  
- Once a cheque or any payment is confirmed, show a caution prompt asking staff to confirm receipt: *"Payment received — confirm and proceed."*  
- After confirmation, immediately trigger the coordinator assignment popup (as described in Fix 16).  
- The coordinator's link should contain all requirement and event details.  
- The first send should go to the assigned coordinator.  
- Simultaneously give staff the option to send a WhatsApp message to the lead with a view-only link showing the coordinator's progress — without payment details.  
- All updates from the coordinator should reflect in the lead profile and the lead's view link in real time.

> **⚠️ Partially Implemented**  
> **Where to see:** `localhost:8080/leads/{leadId}` → **Requirements** tab and **Quotations** tab  
> Multiple requirements per lead work — each has its own row. The post-payment coordinator nudge dialog exists (appears after confirming payment). The revise quotation flow creates a new draft when revision is requested.  
> **Not yet done:** R1v1 / R1v2 version labels are not shown in the UI, and the **"Drop Requirement"** button does not exist yet.
