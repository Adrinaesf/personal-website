# Adrina Esfandiari — personal world

A first-person mountain world built with Three.js. Walk with WASD or arrow keys, drag to look around, and inspect five physical landmarks to discover resume-backed project, research, about, personal-life, and contact information. The map provides direct travel; resume and contact remain available without completing a game.

## Development

Install with `pnpm install`, bundle with `pnpm build`, and serve `dist/` with `python3 -m http.server 4173 --directory dist`. Run `pnpm check` for JavaScript syntax checks and `pnpm test` for audio and dog-navigation regressions. Static deployment uses `.openai/hosting.json`.

- `src/scene.js`: procedural landscape, first-person controls, stations, ground tracking, movement bounds, navigation and projected markers.
- `src/companions.js`: custom procedural African wild dog, articulated animation and autonomous exploration.
- `src/main.js`: game interface, map, journal, discoveries, touch controls and reduced-motion preference.
- `src/music.js`: default-on soundtrack with autoplay-policy handling, fades, looping, error handling and background pause.
- `dist/index.html`: game shell and journal content templates.
- `dist/assets/style.css`: game and journal styling, responsive layouts.
- `dist/assets/Adrina-Esfandiari-Resume.pdf`: supplied resume.
- `dist/assets/wind-song.mp3`: user-supplied Wind Song recording, credited in the interface. Playback is attempted by default and retried on Enter if the browser requires a gesture.

No accounts, database, analytics, external image assets, or physics engine. The terrain uses a local procedural mineral texture and 1,600 small instanced stones. Drawn destination icons and notebook tabs use Kalam for controls and Lora for journal headings; fonts load through Google Fonts with system fallbacks. Music is enabled by default, with a visible Off control even on the entrance. System reduced motion disables ambient animation and makes map travel instantaneous. Movement is disabled while journals or menus are open, and rendering pauses while the tab is hidden. Without WebGL, the map opens journal content directly. Without JavaScript, a resume and email link remain accessible.

The personal-life photo frames are intentionally empty until Adrina supplies photographs. Interests shown are limited to those she explicitly shared.

The PrintOpti result refers to held-out slicer-generated estimates, not physical print performance. Repository links were extracted from the supplied resume.
