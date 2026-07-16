# UI stack

Tuck uses a compact, modern React UI stack selected for browser-extension constraints rather than a generic dashboard look.

## Chosen stack

- **React 19 + TypeScript + Vite** for a fast, typed extension UI.
- **Radix Primitives** for keyboard-safe dialogs and other complex interaction patterns. The primitives are unstyled, so Tuck keeps its own visual language while inheriting reliable focus management.
- **Lucide React** for a consistent 16px icon set across actions.
- **Semantic CSS custom properties** for themes, density, radius, and fonts. This keeps the installed extension small and makes every preset apply immediately.

## Why not a full Tailwind/shadcn migration?

Tailwind v4 plus shadcn is a popular React stack, especially for new product work. It is not the right wholesale migration for Tuck today: the extension already has a complete semantic-token theme system, a deliberate dense side-panel layout, and no need for a large pre-styled component layer. Replacing those foundations would add churn without improving the product.

Instead, Tuck adopts the parts of that modern ecosystem that produce a clear user benefit: accessible headless primitives and a maintained icon system. The CSS token layer remains the single source of visual truth, avoiding generated SaaS styling and preserving every user-created theme.

## References

- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
