# Functional Test Cases & Execution Matrix

This document records the end-to-end functional test cases executed on the live Android emulator (`emulator-5554`) and automated test suites for the **LB Delivery Partner Mobile Application**.

---

## Execution Status Legend

- **PASS:** Executed and observed output strictly matched expected behavior.
- **FAIL:** Executed and observed output failed or threw errors.
- **BLOCKED:** Could not proceed due to missing environment or unavailable third-party capability.
- **NOT EXECUTED:** Identified scenario not run during this cycle.

---

## 1. Application Launch, Lifecycle & Session Persistence

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-APP-001** | Splash | Cold app launch & initial route | App installed | Launch app from background | Splash screen displays brand logo; checks stored session; routes to Home if authenticated, else Login | Successfully rendered splash and navigated based on stored session | **PASS** | `test_screen.png` |
| **TC-APP-002** | App Tree | Missing Root Context Providers | Cold launch | Mount App component with screens consuming `useLocation`, `useAddress`, `useWishlist` | Application mounts safely without red-screen crash | Providers mounted in `App.tsx` with fallbacks; renders cleanly | **PASS** | `__tests__/App.test.tsx`, `App.tsx` |
| **TC-APP-003** | Auth | Session Persistence across App Restart | User logged in | Terminate app and relaunch | Authenticated session restored from AsyncStorage (`@lb_delivery_auth_token`, user payload) | Partner Felix Kumar Z restored immediately to Home dashboard | **PASS** | `home_live.png`, `home_authed.png` |

---

## 2. Authentication & Account Management

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-AUTH-001** | Login | Empty credentials submission | On Login screen | Leave email and password blank; observe button state | "Sign In to LB Delivery" button is disabled until both fields are populated | Button disabled; prevents accidental empty POST | **PASS** | `logout_done.png` |
| **TC-AUTH-002** | Login | Demo Fill button removal | On Login screen | Inspect UI for temporary demo buttons | Quick Fill Demo Partner button is permanently removed from production UI | Removed completely; clean branded login form rendered | **PASS** | `logout_done.png`, `LoginScreen.tsx` |
| **TC-AUTH-003** | Login | Valid Partner Login | Registered test account | Enter `felixkumarzack12@gmail.com` and password `1234`; tap Sign In | Authenticates against `/web/session/authenticate`, saves cookies & partner UID, transitions to Home | Authenticated successfully; transition to Home screen | **PASS** | `post_auth.png`, `home_authed.png` |
| **TC-AUTH-004** | Forgot Pwd | Request Reset Link | On Forgot Password | Enter valid email format; tap Send Reset Link | Dispatches reset payload to backend; displays confirmation state | Email validated and reset link dispatch triggered | **PASS** | `forgot_pwd.png` |
| **TC-AUTH-005** | Reset Pwd | Confirm Reset Screen | Reset code present | Tap "Have a reset code? Set New Password ›" | Navigates to Set New Password with email, new password, and confirmation fields | Screen opened with matching inputs and visibility toggles | **PASS** | `reset_pwd_final.png` |
| **TC-AUTH-006** | Register | Partner Onboarding Form | On Login screen | Tap "Register as Delivery Partner" | Multi-section onboarding form displays Personal Info, Vehicle Details, and KYC inputs | Onboarding form opened cleanly with vehicle selectors | **PASS** | `reg_view.png` |
| **TC-AUTH-007** | Logout | Session Cleanup | Logged in on Profile | Scroll to bottom of Profile; tap Log Out; confirm in modal | Clears AsyncStorage auth session, invalidates cookies, redirects to Login | Confirmation modal shown; session cleared; returned to Login screen | **PASS** | `logout_modal.png`, `logout_done.png` |

---

## 3. Home Screen & Dashboard

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-HOME-001** | Home | Unassigned Orders Count vs List Synchronization | 12 unassigned pickings on server | Open Home Screen; observe header counter and list cards | Counter shows 12 and list displays all 12 cards without artificial `.slice()` truncation | Counter shows (12) and all 12 cards render smoothly | **PASS** | `home_loaded.png`, `live_test.png` |
| **TC-HOME-002** | Home | Shift Duty Status Display | Partner online | Inspect shift banner | Shows "Online & On Duty" with green pulse and "End Shift" shortcut | Displayed cleanly with working shift state | **PASS** | `live_test.png` |
| **TC-HOME-003** | Home | Dashboard Metric Cards | Data fetched | Verify Available, Active, and Pending COD cards | Cards show exact counts (12 Available, 0 Active, ₹0 COD) | Metrics match live Odoo picking query | **PASS** | `live_test.png` |
| **TC-HOME-004** | Home | Pull to Refresh | On Home screen | Swipe down to refresh | Triggers `loadDashboardData(true)` and reloads active orders | Clean pull-to-refresh without memory leak | **PASS** | `HomeScreen.tsx` |

---

## 4. Order Management & Fulfillment Lifecycle

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-ORD-001** | Orders | Pill Filter Navigation | On Delivery Orders screen | Tap between "New Orders", "Active", "Delivered" pills | Active pill highlights with dark background and badge; list filters appropriately | Horizontal scrollable pill bar filters smoothly | **PASS** | `orders_loaded.png` |
| **TC-ORD-002** | Orders | Live Search Filtering | 12 orders displayed | Type "00073" into search bar | List instantly filters to matching order `#WH/OUT/00073 (S00195)` with results counter `Matching "00073" (1)` | 1 matching order displayed; clear button dismisses query | **PASS** | `search_filtered.png`, `search_cleared.png` |
| **TC-ORD-003** | Order Card | Sale Order Origin & Prepaid Status | Order card on Home / Orders | View order `#WH/OUT/00072` | Displays picking origin `(S00191)`, green `PREPAID` pill, and `Prepaid ✓` / `PAID ONLINE` without confusing ₹0.00 | Clean display: `#WH/OUT/00072 (S00191)` + `Prepaid ✓` | **PASS** | `live_test.png`, `order_det_updated.png` |
| **TC-ORD-004** | Order Details | Workflow Stepper & Actions | Open Order Details | Inspect order stepper and action buttons | Stepper shows Accepted, At Store, In Transit, At Customer, Delivered; buttons allow Accept/Decline | Stepper rendered with status progress and action buttons | **PASS** | `order_det_updated.png` |
| **TC-ORD-005** | Order Details | Customer Phone Dialer Trigger | On Order Details | Tap "Call" button | Safely triggers `tel:${phone}` intent with error catch fallback | Dialer intent initiated safely without application crash | **PASS** | `call_test.png`, `OrderDetailsScreen.tsx` |
| **TC-ORD-006** | Order Details | Map Navigation Intent | On Order Details | Tap "Map" button on delivery address | Launches Google Maps / Geo intent for coordinates | Geo link generated with fallback to web Google Maps | **PASS** | `OrderDetailsScreen.tsx` |

---

## 5. Cash Handover & Shift Attendance

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-CASH-001** | Handover | Pending COD Reconciliation | On Home / Profile | Tap "Cash Handover" | Displays Total Pending Cash In Hand (₹0.00), instructions, and empty state | Rendered cleanly with "No Cash Pending Handover" | **PASS** | `cash_test.png` |
| **TC-ATT-001** | Attendance | Shift Attendance Screen | On Home | Tap "Attendance" button | Displays Shift Active (Online), End Shift button, date, and shift guidelines | Shift Attendance screen rendered cleanly | **PASS** | `att_test.png` |

---

## 6. Profile, Addresses & Theme Audit

| Test ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| **TC-PROF-001** | Profile | Infinite Render Loop Prevention | Navigating to Profile | Open Profile screen from Home | Profile screen renders without `Maximum update depth exceeded` error | Infinite loop eliminated via memoized `fetchAddresses` and `refreshOrders` | **PASS** | `prof_live.png`, `AddressContext.tsx` |
| **TC-PROF-002** | Profile | Wishlist to Cash Handover Copy | In Profile menu list | View menu items | Replaced consumer e-commerce wishlist with "Cash Handover: Reconcile collected COD cash & receipts" | Replaced with wallet icon and COD badge | **PASS** | `prof_live.png` |
| **TC-PROF-003** | Profile | Address List Navigation | In Profile menu list | Tap "Delivery Addresses" | Navigates to `AddressListScreen` with options to add new address | Saved Address List rendered cleanly | **PASS** | `addr_form_screen.png` |
| **TC-PROF-004** | Profile | Add Delivery Address Form | In Address List | Tap "+ Add a new delivery address" | Opens `AddressFormScreen` with MapPreview pinpoint, contact info, and address inputs | Form rendered with auto-fill button and map | **PASS** | `addr_form_real.png` |
| **TC-PROF-005** | Theme | Dynamic Dark Mode Toggle | On Profile screen | Toggle Dark Mode switch | App theme updates immediately across components with zero white flash or styling crash | Theme mode switched cleanly | **PASS** | `prof_bottom.png`, `ThemeContext.tsx` |
