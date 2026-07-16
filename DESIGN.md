# Tuck — Product and Interface Design

Tuck is a local-first Chrome extension that reduces tab overload without making users feel that information has been lost.

It has two jobs:

1. Remove stale tabs safely.
2. Keep reusable links, text, and page references easy to retrieve from Chrome's side panel.

The product should feel closer to GitHub, Linear, or a native browser utility than a generated SaaS dashboard.

---

## 1. Product principles

### Preserve before closing

A tab is never automatically closed until its recoverable metadata has been written successfully.

At minimum, archive:

- Page title
- URL
- Domain
- Favicon URL when available
- Last accessed time
- Archived time
- Original window ID when useful
- User tags
- User note
- Protection state
- Reason it was archived

### Local first

The MVP has:

- No account
- No backend
- No analytics
- No remote AI calls
- No page-content scraping
- No cloud synchronization by default

Use `chrome.storage.local` for durable extension data. Settings may use `chrome.storage.sync` only after the core local behavior is stable.

### Quiet automation

Tuck should work without interrupting browsing.

It must not:

- Show routine notifications
- Open itself automatically
- Close active tabs
- Close pinned tabs
- Close audible tabs
- Close protected tabs or protected domains
- Close tabs before the configured age
- Close browser-internal pages
- Close tabs whose archive write failed

### Honest controls

The user should always be able to see:

- When cleanup last ran
- When cleanup runs again
- The inactivity threshold
- Which tabs are protected
- Why a tab was archived
- How to restore or permanently delete an archived item

---

## 2. Primary experience

The extension action opens a persistent Chrome side panel.

The panel contains three simple views:

1. **Tabs**
2. **Notes**
3. **Settings**

Use text tabs with an underline or bottom border. Do not use pill navigation.

---

## 3. Tabs view

### Header

A fixed 52px toolbar:

- Left: Tuck wordmark
- Right: `Clean now` button
- Optional icon-only overflow menu

No subtitle, eyebrow label, hero copy, decorative status badge, gradient, or oversized logo block.

### Current site

This section changes based on the active tab's domain.

Example on LinkedIn:

```text
Current site
linkedin.com

My LinkedIn profile                         Copy
Recruiter introduction                     Copy
Portfolio URL                              Copy
Software engineering summary               Copy

+ Add a note for linkedin.com
```

Rules:

- Use one flat section.
- Separate rows with 1px borders.
- Show a maximum of five matching notes before a `Show all` text action.
- Domain notes match the normalized hostname, with optional subdomain support.
- Clicking the row performs the note's configured primary action: `copy`, `open`, or `edit`.
- Clicking the visible value enters inline edit mode unless the user clicked a dedicated action button.
- `Enter` saves an inline edit, `Escape` cancels it, and `Shift+Enter` inserts a newline for multiline values.
- Copy actions are compact buttons or icon buttons.
- A successful copy temporarily changes the action text to `Copied`.
- URL notes can be edited without leaving the current page.
- A failed edit must preserve the previous saved value.

### Open tabs

Show tabs that are candidates for future cleanup.

Each row contains:

```text
[Favicon] Page title
          domain.com · unused 4h

                         Keep   Archive
```

Rows may expose actions on hover or keyboard focus, but the layout must not shift.

Candidate filters:

- Current window by default
- Optional all-windows toggle in Settings
- Not active
- Not pinned
- Not audible
- Not protected
- Normal web URL
- Older than the configured inactivity threshold

### Archived tabs

Group archived tabs by date using plain headings:

- Today
- Yesterday
- This week
- Older

Each archived row contains:

```text
[Favicon] Axios NO_PROXY wildcard handling
          github.com · archived 2h ago

                         Restore   Delete
```

Additional behavior:

- Clicking the title restores the tab.
- `Restore` opens it and keeps the archive entry until opening succeeds.
- Shift-click or a secondary action restores in the background.
- `Delete` requires confirmation only when deleting multiple entries.
- Search filters title, URL, domain, note, and tags.
- Duplicate URLs are collapsed into one archive entry with the most recent timestamp unless the user explicitly keeps duplicates.

### Bottom status bar

A fixed 40px status row:

```text
18 archived · cleanup after 24h                         Settings
```

Do not use progress bars, usage meters, quota cards, or decorative system-health widgets.

---

## 4. Notes view

Notes are reusable snippets, links, and short reference blocks.

### Note types

- Plain text
- URL
- Email template
- Profile reference
- Project description
- Resume bullet
- Form answer
- Page selection captured through a context menu

### Note fields

```ts
type SavedNote = {
  id: string;
  title: string;
  value: string;
  kind: "text" | "url" | "email" | "profile" | "project" | "resume" | "form";
  primaryAction: "copy" | "open" | "edit";
  openTarget: "current-tab" | "new-tab";
  domains: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  copyCount: number;
  pinned: boolean;
};
```

### Note list

Use a dense list rather than cards.

Each row shows:

- Title
- One-line value preview
- Domain association, when present
- Primary action: Copy, Open, or Edit
- Edit action
- Optional pin icon

### Click-to-edit links and snippets

Saved values must be directly editable from both the Current site section and Notes view.

Interaction:

1. Click the value text or Edit action.
2. Replace the static value with an inline input or textarea in the same row.
3. Preselect the existing value when practical.
4. Show `Save` and `Cancel` actions without moving the rest of the list.
5. Validate URL notes before saving.
6. Persist the change locally.
7. Replace the editor with the updated value only after storage succeeds.
8. On failure, retain the old value and show a small inline error.

For URL notes:

- The title remains separate from the URL.
- `Open` follows `openTarget`.
- `Copy` copies the exact stored URL.
- Clicking the URL enters edit mode by default.
- Ctrl/Cmd-click may open the URL without changing the stored value.
- The user can change the row's primary click action in the editor.

The full editor uses a normal form:

- Label above input
- Standard bordered fields
- 6–8px radius by default
- Clear save and cancel buttons
- Primary action selector
- Open target selector for URLs
- Domain association controls
- No floating labels
- No animated field treatments

---

## 5. Settings view

Use stacked settings rows separated by borders.

### Cleanup

- Enable automatic cleanup
- Discard after: default 60 minutes
- Archive and close after: default 24 hours
- Cleanup interval: default 15 minutes
- Include tabs from all windows
- Close duplicate tabs
- Keep tabs with unsent form data: future enhancement, off in MVP

### Protection

- Never close pinned tabs
- Never close tabs playing audio
- Protected domains list
- Temporary protection options: 1 hour, today, forever

### Storage

- Export JSON
- Import JSON
- Clear archive
- Clear all local data
- Show storage used

### Appearance and themes

Themes are a first-class feature, not a light/dark toggle.

Built-in presets:

- **Obsidian** — warm black, muted gold, low contrast surfaces
- **Terminal** — near-black, green accent, monospace option
- **Arctic** — cool gray, ice-blue accent
- **Sunset** — deep brown, coral accent
- **Sakura** — charcoal, soft pink accent
- **Paper** — warm light background, ink-like text
- **System** — follows browser light or dark preference

Customization controls:

- Theme preset
- Accent color
- Background color
- Surface color
- Text color
- Muted text color
- Border color
- Compact, comfortable, or spacious density
- Square, subtle, or rounded controls
- Optional monospace body text
- Favicon visibility
- Reduced visual effects
- Reset to preset
- Save as custom theme
- Rename and delete custom themes
- Export and import themes with the extension JSON backup

Theme changes apply immediately in the side panel before the user saves them.

Custom themes must remain readable:

- Validate contrast between text and background.
- Warn when contrast is poor.
- Keep focus rings visible.
- Never allow transparent text or unusable zero-contrast combinations.
- Do not use gradients, blur, or glow merely because customization exists.
- Theme customization changes tokens, not information architecture.

```ts
type ThemePresetId =
  "system" | "obsidian" | "terminal" | "arctic" | "sunset" | "sakura" | "paper" | "custom";

type ThemeTokens = {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  danger: string;
  focus: string;
};

type ThemePreferences = {
  preset: ThemePresetId;
  customThemeId?: string;
  tokens?: ThemeTokens;
  density: "compact" | "comfortable" | "spacious";
  radius: "square" | "subtle" | "rounded";
  font: "sans" | "mono";
  showFavicons: boolean;
};
```

The default preset is Obsidian. Customization must preserve the same compact hierarchy and Uncodixfy-inspired structure.

---

## 6. Cleanup lifecycle

### Stage 1 — discard

When a safe tab has been inactive longer than `discardAfterMinutes`:

1. Confirm it is not active, pinned, audible, protected, internal, or already discarded.
2. Call `chrome.tabs.discard(tab.id)`.
3. Leave it visible in the tab strip.
4. Do not create an archive entry solely because it was discarded.

### Stage 2 — archive and close

When a safe tab has been inactive longer than `archiveAfterMinutes`:

1. Re-check all protection rules.
2. Normalize and validate the URL.
3. Build an `ArchivedTab` record.
4. Write the record to local storage.
5. Read back or otherwise confirm the write succeeded.
6. Close the tab with `chrome.tabs.remove`.
7. Record the cleanup result.

Never reverse steps 4 and 6.

### Archived tab model

```ts
type ArchivedTab = {
  id: string;
  url: string;
  title: string;
  domain: string;
  faviconUrl?: string;
  lastAccessedAt: number;
  archivedAt: number;
  sourceWindowId?: number;
  note?: string;
  tags: string[];
  protected: boolean;
  archiveReason: "inactive" | "manual" | "duplicate";
};
```

---

## 7. Protection rules

A tab is not eligible when any rule returns true.

```ts
type ProtectionReason =
  | "active"
  | "pinned"
  | "audible"
  | "protected-tab"
  | "protected-domain"
  | "internal-url"
  | "recently-opened"
  | "missing-url"
  | "incognito"
  | "user-excluded";
```

Protected URL schemes include:

- `chrome://`
- `chrome-extension://`
- `edge://`
- `about:`
- `file://` unless explicitly enabled
- Chrome Web Store pages if Chrome does not permit normal interaction

Incognito tabs should be ignored by default.

---

## 8. Visual direction

Theme presets may change color, density, radius, and font tokens. They must not turn the product into a different layout or introduce decorative dashboard patterns.

This project follows the Uncodixfy approach: normal interface patterns, clear hierarchy, restrained styling, and no generated-dashboard decoration.

### Layout

- Chrome side panel, responsive from roughly 320px upward
- Single-column structure
- No floating outer shell
- No detached cards
- No right rail
- No hero section
- No metric grid
- No ornamental empty space

### Spacing

Use one spacing scale:

- 4px
- 8px
- 12px
- 16px
- 24px
- 32px

Default panel padding: 16px.

List rows: 10–12px vertical padding.

### Radius

- Inputs and buttons: 6px
- Menus and dialogs: 8px
- Avoid rounding large structural sections
- Never use 20–32px radii

### Dark palette

```css
--bg: #171714;
--surface: #1d1d19;
--surface-hover: #24241f;
--border: #34342e;
--border-strong: #49483f;
--text: #f0efe8;
--text-muted: #a6a398;
--accent: #c8b66a;
--accent-hover: #d3c37c;
--danger: #d16f67;
--focus: #d7c982;
```

The accent is warm and muted rather than bright blue.

### Light palette

```css
--bg: #f5f3ed;
--surface: #fbfaf6;
--surface-hover: #efede5;
--border: #d8d4c9;
--border-strong: #bdb7aa;
--text: #24231f;
--text-muted: #706d64;
--accent: #756421;
--accent-hover: #5f511a;
--danger: #a33e37;
--focus: #8d792b;
```

### Typography

- Bundle a restrained sans-serif font such as Geist Sans.
- Body: 14px / 20px
- Secondary text: 12px / 18px
- Page title: 16px / 22px, weight 600
- Section heading: 13px / 18px, weight 600
- Avoid uppercase labels and excessive letter spacing.
- Do not pair decorative serif headings with a sans-serif body.

### Borders and shadows

- Use 1px borders to establish structure.
- Menus and dialogs may use `0 2px 8px rgba(0,0,0,.18)`.
- Main sections do not need shadows.
- No glow, blur haze, gradient border, or glass effect.

### Motion

- 100–160ms color and opacity transitions
- No translate-on-hover
- No bouncing
- No spring animation
- Respect `prefers-reduced-motion`

---

## 9. Text wireframe

```text
┌─────────────────────────────────────┐
│ Tuck                      Clean now │
├─────────────────────────────────────┤
│ Tabs          Notes       Settings  │
│ ━━━                                 │
├─────────────────────────────────────┤
│ Search tabs...                      │
├─────────────────────────────────────┤
│ Current site                        │
│ linkedin.com                        │
│                                     │
│ My LinkedIn profile           Copy  │
│ Recruiter introduction        Copy  │
│ Portfolio URL                 Copy  │
│ + Add note for linkedin.com         │
├─────────────────────────────────────┤
│ Open tabs                           │
│                                     │
│ ● React Flow docs                   │
│   reactflow.dev · unused 5h         │
│                         Keep Archive│
│                                     │
│ ● Axios issue                       │
│   github.com · unused 9h            │
│                         Keep Archive│
├─────────────────────────────────────┤
│ Archived today                      │
│                                     │
│ ● Rust compiler diagnostics         │
│   github.com · 2h ago               │
│                      Restore Delete │
│                                     │
│ ● SWE internship application       │
│   jobs.example.com · 5h ago         │
│                      Restore Delete │
├─────────────────────────────────────┤
│ 18 archived · cleanup after 24h  ⚙ │
└─────────────────────────────────────┘
```

---

## 9.1 Theme customization wireframe

```text
Appearance

Theme
[ Obsidian                          ▾ ]

Preset preview
[● Background] [● Surface] [● Accent] [● Text]

Density
( Compact )  Comfortable  Spacious

Corners
Square  ( Subtle )  Rounded

Font
( Sans )  Mono

[ Customize colors ]   [ Reset preset ]

Custom colors
Background       [ #171714 ] [picker]
Surface          [ #1d1d19 ] [picker]
Accent           [ #c8b66a ] [picker]
Text             [ #f0efe8 ] [picker]
Muted text       [ #a6a398 ] [picker]
Border           [ #34342e ] [picker]

Contrast: Good

[ Save as new theme ]
```

Theme previews must use the actual list-row and button components, not decorative sample cards.

---

## 10. Keyboard behavior

- `Ctrl/Cmd + Shift + Y`: open or focus Tuck
- `/`: focus search when not editing
- `Arrow Up/Down`: move through rows
- `Enter`: open or restore selected item
- `C`: copy selected note
- `K`: protect selected open tab
- `A`: archive selected open tab
- `Delete`: delete selected archive entry after confirmation where appropriate
- `Escape`: close menu, dialog, or editor

Do not override shortcuts while the user is typing into an input or textarea.

---

## 11. Empty and error states

Use direct, useful copy.

Good:

```text
No archived tabs.
Tabs closed by Tuck will appear here.
```

Bad:

```text
Your digital workspace is beautifully clear.
Enjoy the calm.
```

Storage error:

```text
This tab was not closed because Tuck could not save it.
Try again or export your data from Settings.
```

Cleanup skipped:

```text
Cleanup skipped 4 protected tabs.
```

---

## 12. Accessibility

- Full keyboard navigation
- Visible focus ring
- Minimum 4.5:1 text contrast
- Icon-only buttons require accessible names
- Status changes use a polite live region
- Destructive actions are distinguishable without relying on color alone
- Row actions remain reachable on touch and keyboard, not hover only
- Dialog focus is trapped and restored correctly
- Search has a persistent label or accessible name

---

## 13. MVP acceptance criteria

The MVP is complete when:

1. The action icon opens the side panel.
2. The side panel remains useful while switching normal tabs.
3. The extension can identify tab inactivity using `lastAccessed`.
4. Safe inactive tabs can be discarded.
5. Safe stale tabs are archived before being closed.
6. Active, pinned, audible, protected, internal, and incognito tabs are never auto-closed.
7. Archived tabs can be searched, restored, and deleted.
8. Notes can be created, edited, deleted, copied, and associated with domains.
9. Notes matching the active domain appear under Current site.
10. A saved URL or snippet can be changed inline with one click.
11. Each saved item can choose Copy, Open, or Edit as its primary click action.
12. Built-in and custom themes apply immediately and persist.
13. Theme contrast validation prevents unreadable text and invisible focus states.
14. Settings persist.
15. Data, including custom themes, can be exported and imported as JSON.
16. The interface passes keyboard-only use.
17. There are unit tests for eligibility, domain matching, click actions, theme validation, deduplication, and migrations.
18. There are integration tests for archive-before-close behavior and inline link editing.
19. No backend or external service is required.

---

## 14. Official API references

- Side Panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Tabs API: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Storage API: https://developer.chrome.com/docs/extensions/reference/api/storage
- Alarms API: https://developer.chrome.com/docs/extensions/reference/api/alarms
