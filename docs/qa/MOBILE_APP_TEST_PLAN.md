# Mobile Application Test Plan & Quality Audit

## 1. Executive Summary & Objective

This document outlines the comprehensive quality assurance and end-to-end testing plan for the **LB Delivery Partner Mobile Application** (`com.lbdelivery`), built on React Native 0.87.1 / React 19.2.3 with an Odoo 16+ JSON-RPC / REST backend (`https://lbfreshbasket.com`, database: `home_delivery`).

The objective is to establish an exhaustive test baseline, audit all user journeys from initial cold launch through order fulfillment, profile management, and session logout, detect and document all functional, architectural, navigation, and UI/UX defects, implement safe code fixes without breaking business logic, and verify stability via automated and emulator test execution.

---

## 2. Test Environment & Prerequisites

| Parameter | Specification |
|---|---|
| **Application Package** | `com.lbdelivery` / `LBDelivery` (v0.0.1, Build 42) |
| **Framework & Engine** | React Native 0.87.1, React 19.2.3, Hermes JS Engine |
| **Active Test Device** | Android Emulator `emulator-5554` (API 36 / Android 17, 1080x2424, 420dpi) |
| **Target OS Support** | Android 8.0 (API 26) through Android 15+ (API 35/36); iOS 14.0+ |
| **Active Backend Server** | `https://lbfreshbasket.com` |
| **Database** | `home_delivery` |
| **Authentication Endpoint** | `/web/session/authenticate` (Cookie-based session & JSON-RPC) |
| **Live Test Partner Account** | `felixkumarzack12@gmail.com` (UID: 2, Partner ID: 3, Name: "Felix Kumar Z") |
| **Local Tooling** | Android SDK Platform-Tools 35.0.2, Node.js v22+, Jest 29.6+, TypeScript 5.x |

---

## 3. Discovered Application Inventory & Architecture

### A. Screen & Route Inventory

| Module | Route / Screen Name | File Path | Primary Function |
|---|---|---|---|
| **Splash** | `Splash` | `src/modules/splash/screens/SplashScreen.tsx` | Brand loading animation, auth token check, initial routing |
| **Auth** | `Login` | `src/modules/auth/screens/LoginScreen.tsx` | Partner credentials entry, session initialization |
| **Auth** | `Register` | `src/modules/auth/screens/RegisterScreen.tsx` | Multi-step partner onboarding, vehicle & KYC input |
| **Auth** | `ForgotPassword` | `src/modules/auth/screens/ForgotPasswordScreen.tsx` | Reset link dispatch request by email |
| **Auth** | `ResetPassword` | `src/modules/auth/screens/ResetPasswordScreen.tsx` | Password reset confirmation with validation |
| **Home** | `Home` | `src/modules/home/screens/HomeScreen.tsx` | Duty toggle, metrics (Available, Active, COD), live orders |
| **Orders** | `Orders` | `src/modules/orders/screens/OrdersScreen.tsx` | Status pill filters, search query filtering, order list |
| **Orders** | `OrderDetails` | `src/modules/orders/screens/OrderDetailsScreen.tsx` | Stepper workflow, customer call/map, COD & Razorpay collection, OTP verification |
| **Cash Handover** | `CashHandover` | `src/modules/orders/screens/CashHandoverScreen.tsx` | Cash reconciliation, pending COD orders deposit, receipts |
| **Attendance** | `Attendance` | `src/modules/home/screens/AttendanceScreen.tsx` | Shift punch-in/out, hours tracking, guideline notes |
| **Profile** | `Profile` | `src/modules/profile/screens/ProfileScreen.tsx` | Fleet verified badge, vehicle data, theme toggle, logout |
| **Profile** | `EditProfile` | `src/modules/profile/screens/EditProfileScreen.tsx` | Personal info update, vehicle type editing |
| **Profile** | `AddressList` | `src/modules/profile/screens/AddressListScreen.tsx` | Saved delivery hub / pickup address list |
| **Profile** | `AddressForm` | `src/modules/profile/screens/AddressFormScreen.tsx` | Pinpoint map picker, address creation and editing |
| **Profile** | `Notifications` | `src/modules/profile/screens/NotificationsScreen.tsx` | Shift notifications, order dispatch broadcast logs |
| **Support** | `HelpAndLegal` | `src/modules/profile/screens/HelpAndLegalScreen.tsx` | Terms of Service, Privacy Policy, Delivery FAQs |

---

## 4. User Roles & Permission Matrices

| Role | Access Permissions | Restricted Areas |
|---|---|---|
| **Unauthenticated Guest** | Splash, Login, Register, ForgotPassword, ResetPassword, Help & Legal (Public) | Home, Order Management, Shift Attendance, Cash Handover, Profile Management |
| **Registered Delivery Partner** | Full access to shift check-in, unassigned orders viewing & accepting, delivery stepper transitions, COD collection, address management, profile settings | Admin configuration, arbitrary SQL or customer CRM records |

---

## 5. Testing Approach & Scope

The testing methodology follows a hybrid grey-box approach:
1. **Runtime Verification**: Real actions executed on the live Android emulator (`emulator-5554`) via ADB commands, capturing full-resolution screenshots at each milestone.
2. **Backend & Protocol Verification**: Direct JSON-RPC session requests and Odoo picking API testing (`https://lbfreshbasket.com/api/delivery/pickings/unassigned`).
3. **Automated Unit & Regression Tests**: Jest test runner executing component, mapper, and context fallback test suites (`npm test`).
4. **Type Safety & Static Analysis**: TypeScript compiler validation (`npx tsc --noEmit`) to verify zero compilation errors across all modules.
