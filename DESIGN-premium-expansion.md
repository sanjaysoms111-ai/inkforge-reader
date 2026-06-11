# DESIGN: Premium System Expansion (Short)

**Per AGENTS.md** (structural expansion of existing coin/premium simulation). Design produced first, then implement. All client-side, localStorage only. Preserve **every** invariant.

## Goals (from query)
- Multiple coin packages with mock purchase flow (localStorage balance update via addCoins).
- Subscription option (mock 30-day pass for unlimited unlocks).
- Limited-time free chapters/events.
- Detailed coin transaction history page.
- **Keep first-chapter-free rule** (isPremium flag + !isPremium always free; isUnlocked = unlocked || !isPremium).
- **Keep all existing bridges** (creator imports via inkforg_apexpanel_published_comics + normalize, their custom coinPrice/unlockAllPrice still work, source:'creator' badges/analytics, separate from user-published in PUBLISHED_KEY).

## Current State (from code inspection)
- **ComicsContext**:
  - coinBalance (default 85, persisted in COIN_KEY = "inkforg_apexpanel:coins").
  - addCoins(amount) — optimistic, used by Buy modal.
  - unlocked (Record `${comicId}:${chapterId}`), isChapterUnlocked, unlockChapter (deducts effectiveCost = coinPrice ?? 10 or passed, fails if insufficient), unlockAllChapters (60 or custom).
  - myUnlockedComics (derived).
  - First ch free enforced in reader (isUnlocked = isChapterUnlocked(id) || !isPremium) and detail unlock buttons.
  - BuyCoinsModal: 3 packs (100/₹49, 500/₹199 popular, 1000/₹349), optimistic add + mock timeout + toast. Dynamic from Navbar/detail/reader.
- **Types**: UserCoinState (legacy?), Publish* support coinPrice/unlockAllPrice (forwarded in publish/normalize).
- **UI**: Coin pill (balance), premium badges ("PREMIUM • X"), unlock buttons show cost or "FREE" for ch1, Buy modal.
- **LS keys**: :coins, :unlocked. No sub, no tx log, no events yet.
- **Creator bridge**: Fully intact (prices, source, analytics, import flow). User uploads (source 'user'/pub-) use same premium logic.
- **AGENTS notes**: "Premium flow preserved", "first-chapter-free / isPremium gating, coin/unlock/localStorage keys", "test unlock/coin paths". (Some outdated "no paywall" text from past, but code + recent requests require full preservation.)

**Existing invariants (non-negotiable)**:
- Client-side + LS only (no real Stripe/etc).
- Context sole source (all coin/unlock/sub/tx must go through it; UI calls useComics()).
- First ch always free (logic in unlock + UI must not change).
- Custom prices from creator/user publish respected in costs.
- Unlocked state + coins persist; optimistic UI.
- Creator comics (separate LS key, source flag, badges, analytics, views/unlocks mock) unaffected.
- No breakage to reader (progress, comments, swipe, download, etc.), detail, home discovery, /creator uploads, PWA, etc.
- ResetToDemo clears relevant keys.
- Update AGENTS.md with new keys/methods/patterns.

## Architecture Decisions
1. **Coin packages**:
   - Expand PACKAGES in BuyCoinsModal (or move const to context/utils for sharing) to 5: e.g. 50/₹29, 100/₹49, 250/₹99 (bonus +25), 500/₹199, 1200/₹399 (best value +200 bonus).
   - Mock purchase: Keep optimistic addCoins(coins) immediately. Add "processing" state per pack, fake "payment" (e.g. different methods: UPI/Card/Wallet mock selects). Log as transaction (type: 'purchase', amount: +coins, desc: `Purchased ${coins} coins for ${price}`).
   - Balance update only via context.addCoins (which will log).

2. **Subscription (30-day pass)**:
   - New LS key: `inkforg_apexpanel:subscription` = { endDate: ISO string } or null.
   - In context: subscriptionEnd state, persist/load effect, buySubscription() (sets end = now + 30 days, costs e.g. 299 coins or fixed mock "₹299", logs tx), isSubscriptionActive() (Date.now() < end).
   - In unlockChapter / unlockAll: if (isSubscriptionActive()) { unlock without deducting coins; log 'sub-free' tx } else normal.
   - UI: In Buy modal, prominent "Subscription" card/section: "30-Day Unlimited Pass — ₹299 (mock)". On buy: call buySubscription(), show "Active until DD MMM" badge in coin pill / Navbar / reader header. Auto-expire on reload (no timer needed, check on use).
   - Affects all comics (user + creator imports) for unlimited during pass.

3. **Limited-time free chapters/events**:
   - Simple global mock event in context: activeEvent = { until: ISO, title: "Weekend Free Unlock Event", makesAllPremiumFree: true } or per-comic map for granularity.
   - New key: `inkforg_apexpanel:events` (or single active for simplicity).
   - isEventActive() + isChapterFreeDuringEvent(comicId, chId).
   - On "start event" (button in home or auto on load for demo, or claim in Buy modal "Claim Free Event"), set until = now + 3-7 "days".
   - In unlock UI (detail/reader buttons): if event active for ch, show "FREE (Event)" instead of price/lock. Unlock still records but no coin cost.
   - Banner: On home (above For You) and detail: "⏰ Limited-Time Event: All premium chapters free until [date]!".
   - Creator comics: Events apply (or opt-out per design, but apply for seamlessness).
   - Clear on reset or event end.

4. **Detailed coin transaction history page**:
   - New LS key: `inkforg_apexpanel:transactions` = array of { id: string, timestamp: ISO, type: 'purchase' | 'unlock' | 'subscription' | 'event-free', amount: number (+ for gain, - for spend), description: string, comicSlug?: string, chapterNumber?: number }.
   - Context: transactions state + persist/load, getCoinTransactions(filter?), logCoinTransaction(entry) (called from addCoins, unlock*, buySub, event claims).
   - Page: New `/coins/history` (or `/my/coins` or modal from Buy/coin pill). List (reverse chrono), filters (All/Purchases/Unlocks/Subs/Events), summary (total spent/earned, current balance). Use existing glass/card styles. Link from Navbar coin pill ("History") or Buy modal footer.
   - On every balance change or free unlock: log (e.g. "Unlocked Ch. 3 of 'Title' for 10 coins", "Purchased 500 coins", "30-day pass activated", "Event: free unlock Ch. 2").
   - Persist across reloads; cleared in reset.

5. **Integration & UI placements** (minimal new files):
   - BuyCoinsModal: Expand packs, add "Subscription" row/card at top or bottom (mock purchase calls buySub). Keep optimistic + toast. Show current sub status.
   - Navbar (coin pill): Balance + (if sub active) "Subscribed" badge/pill. Click opens Buy or links to history.
   - Detail page + reader: Unlock buttons respect sub/event (FREE label + no cost). Reader header shows sub status if active.
   - Homepage: Event banner (if active). "My Unlocked" etc. still work (sub unlocks count toward myUnlocked).
   - History page: app/coins/history/page.tsx (simple list + filters, reuse patterns from other pages like /creator).
   - Coin pill / Buy: Link "View full history".
   - No changes to first-free (enforced before sub/event checks or alongside).
   - Creator bridge: Unlocks during sub/event still count for their analytics (recordCreatorView already called on read).

6. **Storage & reset**:
   - New keys (document in AGENTS): :subscription, :transactions (plus reuse :coins/:unlocked).
   - All in context useEffects (load on mount, save on change).
   - resetToDemo: clear the new keys (plus existing coin/unlocked).
   - Optimistic where possible (like current buys).

7. **Risks & mitigations (invariants)**:
   - Breaking first-free: Never remove the `|| !isPremium` check; sub/event only bypass cost for premium chs.
   - Creator bridge drift: Sub/event checks are in unlock (after finding comic), prices from comic still used for display; analytics separate.
   - LS bloat (tx history): Cap array to last 100 on log (or prune old). Small objects.
   - Mock "payments": Purely local addCoins + logs; no real money.
   - Existing data: Old coins/unlocked continue; new fields optional.
   - Performance: Logs are sync LS; history page is read-only list (virtual if long, but cap keeps small).
   - UI consistency: All premium UI (badges, buttons, costs) must query context (isSubscriptionActive() || isEventFree()).

## Files to Touch (prioritized)
- DESIGN-premium-expansion.md (this).
- app/lib/types.ts (minor: perhaps extend UserCoinState or add interfaces for Tx/Sub if useful; mostly no change).
- app/lib/ComicsContext.tsx (core: new states/keys/effects, methods for sub/tx/events, enhance unlock/addCoins, expose in interface/value).
- app/components/BuyCoinsModal.tsx (expand packs + sub UI, use new context methods).
- app/components/Navbar.tsx (coin pill enhancements for sub status + history link).
- app/comics/[slug]/page.tsx + app/read/[slug]/[chapter]/page.tsx (unlock buttons + sub/event awareness).
- app/page.tsx (event banner if active).
- New: app/coins/history/page.tsx (detailed list).
- AGENTS.md (new keys, methods, patterns, test cases; update premium section).
- (Optional light) Update reset, any coin display.

## Implementation Order (step-by-step after design)
1. Context: add keys/states/persist, sub methods + isActive, tx log + get, event state + isFree, wire into unlock/addCoins (respect first-free), update reset + value.
2. Buy modal: more packs, sub purchase card, call new methods, toasts.
3. UI surfaces: Navbar pill, detail/reader unlocks (FREE during sub/event), home banner, history page.
4. Polish: mock timers/dates for "30 days" and events, filters in history, ensure creator comics get sub benefits.
5. AGENTS + build/test.

**Success**: Mock buys update balance + log tx; sub allows free premium unlocks for 30d (persists); event makes chs free temporarily with banner; history page shows detailed log (purchases, unlocks, subs, events); first ch always free (even without sub); creator imports unaffected in their bridge; all via context; LS keys documented; build clean; tests pass per AGENTS checklist.

This keeps the "demo premium simulation" spirit while expanding features without real money or backend.

**End of short design doc.** (Now implement per todos.)