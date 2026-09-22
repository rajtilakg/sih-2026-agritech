# 🌾 Krishi Rakshak - Complete Developer Onboarding & Architecture Guide

Welcome to the **Krishi Rakshak** project. This document serves as the comprehensive onboarding manual and technical reference for backend engineers and integration specialists. To maintain a lightweight footprint, this repository has been stripped of all heavy local caches (`.gradle`, `build/`, `.idea/`), compiled APK artifacts, and `node_modules`.

Because this project utilizes a strict **offline-first architecture**[cite: 6] requiring precise synchronization between a local mobile database and cloud infrastructure, please read this guide thoroughly before initializing your local development environment.

---

## 🏗️ 1. Environment Setup & Prerequisites

Mobile development environments are highly sensitive to version mismatches. Do not skip or gloss over these version requirements, or the Android Gradle build will fail.

*   **Node.js:** Ensure you are running an LTS version of Node.js (v18 or v20). 
*   **Android Studio:** Install the Koala feature drop or the latest standard release.
*   **Java Development Kit (JDK) [CRITICAL]:** The Android Gradle Plugin (AGP 8.6) used in this project requires **exactly JDK 17 or JDK 21**. Do NOT use Java 22, 23, or 25, as modern experimental Java versions will cause silent compilation failures. If you have multiple JDKs installed, you must point your `JAVA_HOME` environment variable to JDK 17/21.

### Hydrating the Project
1. Open your terminal in the root `mobile-react-native` directory and install dependencies:
~~~bash
npm install
~~~
2. Open Android Studio. Click **File -> Open**, and select the **`android`** subfolder (Do not open the root project folder). 
3. Allow Gradle to sync. Verify your JDK by navigating to **File -> Project Structure -> SDK Location -> Gradle Settings** and ensuring the Gradle JDK is set to JDK 17 or 21.

### Running the App
*   **Development / Hot-Reloading:** Start the Metro bundler (`npx react-native start`) and compile the app to your emulator/device (`npx react-native run-android`).
*   **Standalone Offline APK:** To build an APK that does not require the Metro server, first bundle the assets locally (`npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res`), then use Android Studio's **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** menu.

---

## ☁️ 2. Supabase Cloud Configuration

The cloud infrastructure is entirely managed via **Supabase**, specifically utilizing its PostgreSQL database and Storage features[cite: 6]. 

**Credentials to be used:**
~~~text
SUPABASE_URL= https://mienidajgwhyyfjrdykt.supabase.co
SUPABASE_PUBLISHABLE_KEY= sb_publishable_psbyjk9b5yrSh-Wpr1Je1A_NRF4Nv7C
~~~
*Note: The credentials above represent the specific Supabase instance for this project[cite: 6].*

**Security Protocol:** The exact same Supabase client is used for connecting to both PostgreSQL and the Storage buckets[cite: 6]. You must **never** put the `service_role`/secret key or the database password in the mobile app[cite: 6].

---

## 🗄️ 3. Database Architecture & Schema

The application relies on two mirroring databases:
1.  **WatermelonDB:** This acts as the local database on the phone[cite: 6].
2.  **Supabase PostgreSQL:** This serves as the cloud database[cite: 6].
3.  **Supabase Storage (`images`):** This is utilized for cloud image storage[cite: 6].

You must strictly adhere to the following schema definitions. **Do NOT redesign the existing Supabase schema**[cite: 6], and do NOT create duplicate cloud tables[cite: 6].

### A. Profiles Table (`profiles`)
The authenticated Supabase user is identified by `auth.users.id`[cite: 6]. This ID must correspond exactly to `profiles.id`[cite: 6]. Do not create a separate user ID system in WatermelonDB[cite: 6]. The authenticated user's Supabase UUID should be used consistently[cite: 6].

~~~text
id                  (references auth.users.id)
full_name
phone_number
role
district
taluka
village
preferred_language
created_at
updated_at
~~~
*All fields above are required as part of the `profiles` schema[cite: 6].*

### B. Field Reports Table (`field_reports`)
The `field_reports.user_id` strictly references `profiles.id`[cite: 6].

~~~text
id                  (Canonical UUID generated locally)
user_id             (references profiles.id)
name
phone_number
image               
crop_type
ai_diagnosis        
reviewed_by_expert
location
created_on
updated_at
~~~
*All fields above are required as part of the `field_reports` schema[cite: 6].*

---

## 🔄 4. Offline-First Synchronization Protocol

The core rule of Krishi Rakshak is that **WatermelonDB is the offline source of pending work, and Supabase is the cloud copy**[cite: 6]. Never make the app depend on internet connectivity to create a field report[cite: 6]. 

### Phase 1: Local Creation (Offline)
WatermelonDB records must be created and updated locally FIRST[cite: 6]. The app must work completely offline[cite: 6]. When a user creates a field report, the system follows this exact pipeline:

~~~text
Generate field_report UUID
        ↓
Save report to WatermelonDB
        ↓
Save original image to app-private filesystem
        ↓
Run local ML inference
        ↓
Save inference result to WatermelonDB
        ↓
Mark record as pending_sync
~~~
*This entire flow is executed locally[cite: 6]. Nothing should require internet at this stage[cite: 6].*

### Phase 2: Cloud Sync (Online)
When internet returns, a background sync process should find records with the status `pending_sync` and upload them[cite: 6]. 

**Step 1: Upload Image to Supabase Storage**
*   Upload the original image to `images/{user_id}/{field_report_id}.jpg`[cite: 6].
*   The image must NOT be stored in PostgreSQL[cite: 6].
*   A PostgreSQL trigger already links the uploaded Storage object to `field_reports.image`[cite: 6]. Therefore, the app does not need to manually write the image URL/path[cite: 6].

**Step 2: Sync the Field Report**
*   After the image upload succeeds, sync the WatermelonDB report to `public.field_reports`[cite: 6].
*   You must use the SAME `field_report_id` that was generated locally[cite: 6]. Do not generate a new ID in the cloud[cite: 6]. The local WatermelonDB ID is the canonical `field_reports.id`[cite: 6].
*   Map the fields directly from WatermelonDB to Supabase PostgreSQL (e.g., `id` to `field_reports.id`, `user_id` to `field_reports.user_id`, `name` to `field_reports.name`, `phone_number` to `field_reports.phone_number`, `crop_type` to `field_reports.crop_type`, `ai_diagnosis` to `field_reports.ai_diagnosis`, `reviewed_by_expert` to `field_reports.reviewed_by_expert`, `location` to `field_reports.location`, `created_on` to `field_reports.created_on`, and `updated_at` to `field_reports.updated_at`)[cite: 6].

### Phase 3: Sync Order & Idempotency

For a new report, follow this exact sync order[cite: 6]:
~~~text
WatermelonDB
     ↓
Upload image to Storage
     ↓
Storage trigger updates field_reports.image
     ↓
Upsert field_reports record
     ↓
Mark WatermelonDB record as synced
~~~

**Important Error Handling:**
*   If the image upload fails: DO NOT mark as synced[cite: 6]. Keep the local image and retry later[cite: 6].
*   If the database sync fails: DO NOT delete the local image[cite: 6]. Keep the record pending and retry later[cite: 6].

**Important: synchronization must be idempotent**[cite: 6]. The app may lose connectivity halfway through synchronization[cite: 6]. For example, if the image is uploaded successfully but the database update fails, when synchronization runs again, it must NOT create a duplicate report[cite: 6]. Always use the existing `field_report_id` and perform an **upsert** rather than blindly inserting a new UUID[cite: 6].

---

## 🖼️ 5. Image & Status Handling Details

**Image Handling Paths:**
*   **Local:** WatermelonDB uses `imageLocalPath` which points to the app private filesystem[cite: 6].
*   **Cloud:** Supabase Storage uses `images/{user_id}/{field_report_id}.jpg` which triggers `field_reports.image`[cite: 6].
*   `field_reports.image` contains the Storage object path, NOT the image binary and NOT a permanent signed URL[cite: 6].

**Sync Status Tracking:**
*   Keep local-only synchronization state in WatermelonDB[cite: 6]. Examples of local states include `pending`, `uploading`, `synced`, and `failed`[cite: 6].
*   These status fields do NOT need to be added to Supabase[cite: 6]. 
*   Only mark a report `synced` after all required cloud operations have succeeded[cite: 6].

---

## 🗺️ 6. Final Architecture Map

Use this visual reference to understand the boundaries between the mobile device and cloud environment[cite: 6].

~~~text
                 PHONE
                   │
          ┌────────▼────────┐
          │   WatermelonDB  │
          │                 │
          │ profiles        │
          │ field_reports   │
          │ sync status     │
          └────────┬────────┘
                   │
              INTERNET
                   │
          ┌────────▼────────┐
          │    Supabase     │
          │                 │
          │ PostgreSQL      │
          │   profiles      │
          │   field_reports │
          │                 │
          │ Storage         │
          │   images/       │
          └─────────────────┘
~~~