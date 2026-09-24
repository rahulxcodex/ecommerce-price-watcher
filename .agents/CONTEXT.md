# Ecommerce Tracker - Project Context

## Overview
Next.js e-commerce price tracking web app + browser companion extension for Indian e-commerce sites (Amazon, Flipkart, Myntra, Ajio, Meesho, Westside). Supports Supabase backend, Telegram/email notifications.

## Architecture
- `src/app/api/products/route.ts`: API endpoint to add/track products, invokes scrapers.
- `src/app/add/page.tsx`: UI for adding a product URL with manual price override.
- `scripts/scrapers/`: Individual scrapers (`ajio.ts`, `myntra.ts`, `amazon.ts`, etc.) and `resilient-extractor.ts`.
- `extension/`: Chrome companion extension for client-side price extraction when cloud IPs are blocked.

## Current Milestone - Anti-Bot Handling & Web Push Diagnostic Resolution
- Enhanced Ajio & Myntra tracking: Added instant client-side anti-bot awareness on `/add`, automatic URL slug title derivation, streamlined manual price bypass with link to 1-click companion extension, and fallback title extraction in scrapers.
- Fixed Web Push notifications: Resolved "No active push subscriptions found" false-positive by adding automatic client-to-server subscription synchronization on page mount and prior to test dispatch, plus enabling re-sync from settings button.
- Companion Extension: Improved DOM & state extraction (`window.__PRELOADED_STATE__` / `window.__myx`) for 1-click tracking on Ajio and Myntra.

