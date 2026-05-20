<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:
 
Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
 
Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
 
Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
 
Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.
 
Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
 
Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

<styling_guide>
## UI/UX Guidelines
- **Theme:** "Cyber-Boutique" / "Editorial Luxury". Dark mode by default (`#060608` background, `#101014` surfaces).
- **Typography:** 'Syne' for headings (bold, geometric, high-impact), 'Plus Jakarta Sans' for body text for high legibility.
- **Colors:** Deep charcoal backgrounds with high-contrast acid neon-lime (`#c4ff00`) accents. Text is mostly `#f5f5f5` with `#8e8e99` for muted elements. Borders are low-opacity white (`rgba(255, 255, 255, 0.08)`).
- **Components:** 
  - **Cards:** Subtle borders, dark background. Hover states include `translateY` lift, border brightening, and image scaling.
  - **Buttons:** Fully rounded (`--radius-full`). Primary buttons are solid neon lime (`var(--accent)`). Secondary buttons are bordered dark surfaces.
  - **Inputs/Forms:** Dark backgrounds (`#1a1a20`), subtle borders, neon focus states with `box-shadow` outline for accessibility. Strong typography on labels.
- **Motion:** Framer-motion for page and component reveals. Favor staggered fade-up animations (using spring transitions) on lists/grids for a deliberate, premium feel.
- **Forms & Validations:** Always show validation and error states clearly. Use optimistic locking (`version` field) when updating entities as required by the API.

</styling_guide>

<code_guidelines>
- **Stack:** Bun, React 19, React Router v7, SWR (for data fetching), Framer Motion, Lucide React (for icons).
- **Routing:** Client-side routing with `react-router-dom` in `App.tsx`.
- **API Fetching & Authentication:** 
  - Use `SWR` for reactive GET requests.
  - Centralized `fetcher` and `apiCall` utilities in `src/api.ts`. 
  - API utilities must automatically attach the `Authorization: Bearer <token>` header if a token exists in `localStorage`.
  - For user context, decode the JWT `accessToken` (using standard base64 decoding) to retrieve the `sub` claim which usually holds the `userId`.
- **Structure:** 
  - `src/pages/` for route-level components (Home, Login, Register, ListingDetail).
  - `src/components/` for reusable UI components (Navbar).
  - `src/api.ts` for API configuration, helpers, and price formatting.
  - `src/AuthContext.tsx` for global authentication state management.
- **Styling:** 
  - Vanilla CSS with semantic CSS variables defined in `:root` inside `index.css`. 
  - Avoid utility class frameworks (like Tailwind) to maintain strict adherence to the custom aesthetic. Use structural classes (`.container`, `.grid`, `.card`).
</code_guidelines>
