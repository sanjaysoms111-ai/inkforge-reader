# inkforg_apexpanel Reader

**The public reading platform for inkforg_apexpanel** — browse, read, and support beautiful AI-generated webtoons & manhwa.

Built with **Next.js 16 (App Router) + TypeScript + Tailwind**.

## Features (MVP)

- **Homepage**: Hero, Trending This Week, Latest Releases, live genre filters + search
- **Comic Detail**: Beautiful cover + metadata, full chapter list with Free / Premium badges
- **Vertical Webtoon Reader**: Clean scrolling panel reader, chapter navigation, chapter quick-switcher
- **Premium Flow**: "Unlock with 5 Coins" buttons + working local coin balance + Buy Coins modal (UI + state)
- **Monetization Placeholders**: Clear Free vs Premium, ad space blocks, coin economy
- **AI Disclaimer**: Prominently shown on homepage, comic pages, reader, and footer
- Dark theme with rose/red accents matching the inkforg_apexpanel creator aesthetic. Mobile-first vertical reading.

## Tech & Future

- Pure client-side state + localStorage (no backend yet)
- Easy to connect later: `ComicsContext` + clean `Comic` / `Chapter` types in `app/lib/types.ts`
- `MOCK_COMICS` in `app/lib/mockData.ts` is intentionally empty (demo story comics removed). Real content comes from the Creator App bridge and user-published items.
- Published user comics are merged and persist across refreshes in the same browser

## Getting Started

```bash
cd "C:\inkforg_apexpanel reader"
npm install
npm run dev
```

Open http://localhost:3000

### Useful routes

- `/` — Homepage with discovery
- `/comics/eternal-shadow` — Example detail page
- `/read/eternal-shadow/1` — Reader (try a premium chapter too)

## Project Structure

```
app/
├── components/          # Reusable UI (Navbar, ComicCard, modals, filters...)
├── lib/
│   ├── types.ts
│   ├── mockData.ts
│   └── ComicsContext.tsx   # Global state, persistence, unlocking, comments
├── comics/[slug]/page.tsx
├── read/[slug]/[chapter]/page.tsx
├── layout.tsx
├── globals.css
└── page.tsx
```

## Connecting to a Real Backend / Creator App

1. Replace the mock loading strategy (currently empty `MOCK_COMICS`) + context logic with real API calls (fetch / React Query / Server Actions).
2. Replace `publishComic` with POST to your backend.
3. Store actual images in object storage instead of data URLs.
4. Share the `Comic` and `Chapter` interfaces with the creator app.

## Disclaimer

This is a fully functional demo. All coin purchases and unlocks are simulated locally.

---

Built for inkforg_apexpanel — the future of AI-assisted storytelling.


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
