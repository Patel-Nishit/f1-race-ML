# F1 Race Replay — web app

Next.js 16 (App Router, TypeScript, Tailwind) front end for the replay API.

```bash
# terminal 1, from the repo root
python main.py serve            # API on http://127.0.0.1:8000

# terminal 2, here in web/
npm install
npm run dev                     # http://localhost:3000
npm test                        # vitest
npm run typecheck && npm run lint && npm run build
```

Set `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`) to point at another API.

| Path | What it is |
|------|------------|
| `app/page.tsx`, `components/RacePicker.tsx` | Season calendar, prepare races, progress bars |
| `app/replay/[year]/[round]/page.tsx` | Replay route (params read inside `<Suspense>`) |
| `components/ReplayView.tsx` | Loads metadata, opens the stream, page layout |
| `components/TrackCanvas.tsx` | Canvas drawing loop |
| `lib/replaySocket.ts` | WebSocket client with reconnect + backoff |
| `lib/replayStore.ts` | Zustand store |
| `lib/frameBuffer.ts`, `lib/interpolate.ts` | Ack handling, 10 Hz → 60 fps interpolation |
| `lib/track.ts`, `lib/protocol.ts`, `lib/api.ts`, `lib/types.ts` | Transforms, decoding, REST client, types |

The learning guide for this part is `../docs/10-nextjs-react-typescript.md` and
`../docs/11-canvas-rendering-and-animation.md`.
