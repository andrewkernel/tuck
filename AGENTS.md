# AGENTS.md

## Mission

Build **TabShelf**, a local-first Chrome extension that safely reduces tab overload and keeps reusable information available in Chrome's side panel.

The extension must preserve information before closing tabs. It must feel like a focused browser utility, not a generated SaaS dashboard.

---

## Read first

Before changing UI or behavior, read:

1. `DESIGN.md`
2. `manifest.json`
3. Existing storage types and migrations
4. Existing tests around tab eligibility and archive safety
5. The Uncodixfy rules at:
   `https://github.com/cyxzdev/Uncodixfy/blob/main/Uncodixfy.md`

`DESIGN.md` is the product source of truth. This file defines how agents should work.

---

## Product priorities

Use this order when requirements compete:

1. Never lose user information.
2. Never close a protected or unsafe tab.
3. Keep all MVP data local.
4. Make restoration obvious and reliable.
5. Keep the interface dense, quiet, and keyboard accessible.
6. Prefer simple code and normal UI patterns.
7. Add convenience only after safety and tests are complete.

---

## Non-negotiable safety rule

**Archive successfully before closing.**

For every automatic or manual archive-and-close operation:

1. Validate the tab.
2. Re-check protection rules immediately before the operation.
3. Construct the archive record.
4. Save it to `chrome.storage.local`.
5. Confirm the save succeeded.
6. Only then call `chrome.tabs.remove`.
7. If any save step fails, do not close the tab.
8. Surface a clear error in the side panel.

Never implement a close-first workflow.

---

## MVP scope

Implement:

- Manifest V3 Chrome extension
- Persistent side panel
- Open-tab inactivity tracking
- Safe discard stage
- Safe archive-and-close stage
- Searchable archive
- Restore and delete actions
- Domain-aware reusable notes
- Copy-to-clipboard actions
- Protected tabs and domains
- Configurable cleanup thresholds
- JSON export and import
- Built-in theme presets and user-created custom themes
- Click-to-edit saved links and snippets
- Configurable primary click actions for saved items
- Unit and integration tests

Do not implement in the MVP:

- User accounts
- Cloud sync
- Backend database
- AI categorization
- Full-page scraping
- Automatic reading of private page content
- Collaboration
- Billing
- Notifications for routine cleanup
- A dashboard homepage
- Metrics or charts
- Mobile support

---

## Recommended stack

- TypeScript
- React
- Vite
- Manifest V3
- `@types/chrome`
- Zustand or a small typed store only if state complexity justifies it
- Zod for persisted-data validation and migrations
- Vitest
- React Testing Library
- Playwright for extension integration tests
- ESLint
- Prettier

Avoid adding a large component library unless it clearly reduces complexity without changing the design language.

Prefer small project-owned components.

---

## Target browser

Target a Chrome version that supports:

- `chrome.sidePanel`
- `chrome.tabs.lastAccessed`
- Promise-based extension APIs used by the project

Set `minimum_chrome_version` intentionally in `manifest.json`.

Do not claim cross-browser support until Firefox and Edge behavior is tested separately.

---

## Required permissions

Start with the smallest practical permission set.

Expected permissions:

```json
{
  "permissions": ["tabs", "storage", "alarms", "sidePanel", "contextMenus"]
}
```

Add permissions only when a concrete feature requires them.

Avoid broad host permissions for the MVP. Domain-aware notes should derive the hostname from tab metadata available through the tabs permission. A future selection-capture feature may use `activeTab` and `scripting` after a direct user gesture.

Document every added permission in the README.

---

## Suggested repository structure

```text
.
├── AGENTS.md
├── DESIGN.md
├── README.md
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── icons/
├── src/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── alarms.ts
│   │   ├── cleanup.ts
│   │   ├── eligibility.ts
│   │   └── messages.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── TabsView.tsx
│   │   │   ├── NotesView.tsx
│   │   │   └── SettingsView.tsx
│   │   └── components/
│   │       ├── AppHeader.tsx
│   │       ├── TextTabs.tsx
│   │       ├── SearchInput.tsx
│   │       ├── CurrentSiteSection.tsx
│   │       ├── OpenTabRow.tsx
│   │       ├── ArchivedTabRow.tsx
│   │       ├── NoteRow.tsx
│   │       ├── InlineValueEditor.tsx
│   │       ├── ThemePicker.tsx
│   │       ├── ThemeEditor.tsx
│   │       ├── ThemePreview.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── StatusBar.tsx
│   ├── storage/
│   │   ├── schema.ts
│   │   ├── repository.ts
│   │   ├── migrations.ts
│   │   └── export-import.ts
│   ├── domain/
│   │   ├── archived-tab.ts
│   │   ├── saved-note.ts
│   │   ├── theme.ts
│   │   ├── settings.ts
│   │   └── cleanup-result.ts
│   ├── shared/
│   │   ├── chrome.ts
│   │   ├── urls.ts
│   │   ├── time.ts
│   │   ├── ids.ts
│   │   └── errors.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── base.css
│   │   └── components.css
│   └── test/
│       ├── chrome-mocks.ts
│       └── fixtures.ts
└── tests/
    ├── unit/
    └── extension/
```

Do not create layers that contain only pass-through functions. Keep boundaries useful.

---

## Persisted schema

Use a versioned root object.

```ts
type StorageRoot = {
  version: number;
  archivedTabs: ArchivedTab[];
  notes: SavedNote[];
  protectedTabs: ProtectedTab[];
  settings: ExtensionSettings;
  cleanupLog: CleanupLogEntry[];
};
```

### Archived tab

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

### Saved note

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

### Theme preferences

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

type CustomTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
  createdAt: number;
  updatedAt: number;
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

### Settings

```ts
type ExtensionSettings = {
  cleanupEnabled: boolean;
  discardAfterMinutes: number;
  archiveAfterMinutes: number;
  cleanupIntervalMinutes: number;
  includeAllWindows: boolean;
  closeDuplicates: boolean;
  ignoreIncognito: boolean;
  protectPinned: boolean;
  protectAudible: boolean;
  protectedDomains: string[];
  theme: ThemePreferences;
  customThemes: CustomTheme[];
};
```

Use defaults:

```ts
const DEFAULT_SETTINGS: ExtensionSettings = {
  cleanupEnabled: true,
  discardAfterMinutes: 60,
  archiveAfterMinutes: 24 * 60,
  cleanupIntervalMinutes: 15,
  includeAllWindows: false,
  closeDuplicates: false,
  ignoreIncognito: true,
  protectPinned: true,
  protectAudible: true,
  protectedDomains: [],
  theme: {
    preset: "obsidian",
    density: "comfortable",
    radius: "subtle",
    font: "sans",
    showFavicons: true,
  },
  customThemes: [],
};
```

Validate all persisted and imported data. Never trust storage or imported JSON blindly.

---

## Storage rules

Use `chrome.storage.local` for:

- Archived tabs
- Notes
- Protected-tab metadata
- Cleanup log
- Data version

Settings may remain in local storage during the MVP.

Requirements:

- Centralize storage reads and writes in `src/storage/repository.ts`.
- Do not call `chrome.storage.local` directly from random UI components.
- Keep migrations deterministic and tested.
- Cap cleanup logs to a reasonable number, such as 100 entries.
- Use atomic-style root updates or carefully scoped keys to avoid lost updates.
- Serialize conflicting writes when necessary.
- Never store complete webpage HTML.
- Never store page screenshots.
- Never store cookies, auth tokens, or form values.

---

## URL normalization

Create shared helpers.

```ts
normalizeUrl(url: string): string
getHostname(url: string): string | null
isInternalUrl(url: string): boolean
matchesDomain(hostname: string, rule: string): boolean
```

Rules:

- Lowercase hostnames.
- Remove `www.` for matching, not necessarily display.
- Preserve URL paths and query strings for restoration.
- Strip fragments only for duplicate detection when appropriate.
- Treat malformed URLs as ineligible.
- Domain rule `linkedin.com` matches `www.linkedin.com`.
- Domain rule `jobs.linkedin.com` may be exact when marked exact.
- Do not match `notlinkedin.com` to `linkedin.com`.

Test domain boundary behavior thoroughly.

---

## Tab eligibility

Implement eligibility as a pure function whenever possible.

```ts
type EligibilityResult = { eligible: true } | { eligible: false; reason: ProtectionReason };
```

A tab is ineligible when:

- It is active.
- It is pinned and pinned protection is enabled.
- It is audible and audible protection is enabled.
- It is manually protected.
- Its domain is protected.
- Its URL is missing or malformed.
- Its URL uses an internal or disallowed scheme.
- It is incognito and incognito cleanup is disabled.
- It is younger than the applicable threshold.
- Chrome does not provide a valid tab ID.
- It is currently being processed by another cleanup operation.

Re-run eligibility immediately before discard or close. Do not rely only on an earlier list calculation.

---

## Cleanup engine

The cleanup engine belongs in the service worker.

### Alarm setup

- Ensure the named cleanup alarm exists whenever the worker starts.
- Recreate it when settings change.
- Do not assume alarms are permanently available.
- Use the configured interval.
- Cleanup must be safe if two triggers occur close together.
- Use an in-memory lock plus operation IDs where useful.
- Never run overlapping archive-close loops.

### Cleanup algorithm

```text
load settings
if cleanup disabled: return

query candidate tabs
sort oldest first

for each tab:
  re-check eligibility for discard threshold
  discard when eligible and not already discarded

for each tab:
  re-check eligibility for archive threshold
  archive record
  confirm storage
  remove tab
  record result
```

Limit large cleanup batches, for example 25 archive-close operations per run. Continue in a future alarm rather than blocking or producing a burst of tab closures.

### Manual cleanup

`Clean now` uses the same engine and safety checks as automatic cleanup.

Do not maintain separate logic paths with different protection behavior.

---

## Restore behavior

Restoring an archived tab:

1. Validate the stored URL.
2. Call `chrome.tabs.create`.
3. Confirm creation succeeds.
4. Keep the archive entry by default until the tab opens successfully.
5. Remove the archive entry after success when the user setting requests move-style restoration.
6. On failure, keep the entry and show a readable error.

Restoring multiple tabs should be rate limited and should ask for confirmation above a reasonable count.

---

## Duplicate handling

Duplicate detection must be deterministic.

Suggested duplicate key:

```ts
canonicalDuplicateKey(url);
```

Default behavior:

- Do not auto-close duplicates in the initial release.
- When enabled, keep the active tab.
- Prefer a pinned tab over an unpinned tab.
- Otherwise keep the most recently accessed tab.
- Archive duplicate tabs before closing them.
- Mark `archiveReason: "duplicate"`.

---

## Messaging

Define typed messages between the side panel and service worker.

Examples:

```ts
type ExtensionMessage =
  | { type: "GET_ACTIVE_CONTEXT" }
  | { type: "GET_OPEN_TABS" }
  | { type: "RUN_CLEANUP"; mode: "manual" }
  | { type: "ARCHIVE_TAB"; tabId: number }
  | { type: "PROTECT_TAB"; tabId: number; duration: "hour" | "day" | "forever" }
  | { type: "RESTORE_ARCHIVE"; archiveId: string }
  | { type: "DELETE_ARCHIVE"; archiveId: string };
```

Validate message shapes. Return typed success and error results. Do not throw raw Chrome errors into the UI.

---

## Saved-item click behavior

Saved notes and links support configurable primary behavior.

```ts
type SavedItemPrimaryAction = "copy" | "open" | "edit";
```

Rules:

- Clicking a row runs the configured primary action.
- Clicking the visible value always enters edit mode unless a modifier-click explicitly opens the URL.
- URL notes may open in the current tab or a new tab.
- Copy uses the exact persisted value.
- Edit uses an inline editor in the current row.
- Save only replaces the displayed value after storage succeeds.
- Cancel restores the exact previous value.
- A storage failure leaves the old value intact.
- URL validation errors remain local to the row.
- Inline editing must not cause the list to reorder until save succeeds.
- Keyboard behavior: Enter saves, Escape cancels, Shift+Enter adds a newline where supported.
- Do not require a separate settings page to make a quick link correction.

Add typed message or repository operations such as:

```ts
updateSavedNote(
  id: string,
  patch: Pick<SavedNote, "title" | "value" | "primaryAction" | "openTarget">
): Promise<Result<SavedNote>>;
```

Test copy, open, edit, cancel, invalid URL, and storage-failure behavior.

---

## Theme system

Themes are token sets, not alternate component trees.

Required presets:

- System
- Obsidian
- Terminal
- Arctic
- Sunset
- Sakura
- Paper

Requirements:

- Apply theme changes immediately as a preview.
- Persist only after the user confirms or exits according to the chosen UX.
- Allow custom token editing.
- Allow density, radius, font, and favicon visibility preferences.
- Allow save-as, rename, duplicate, delete, reset, export, and import for custom themes.
- Validate CSS color strings.
- Calculate and warn about text/background contrast.
- Guarantee a visible focus token.
- Fall back to a safe preset when imported theme data is invalid.
- Store theme preferences locally.
- Apply tokens through root CSS custom properties.
- Keep all components using semantic variables rather than hard-coded colors.
- Do not use theme customization as justification for gradients, glow, glass, or alternate dashboard layouts.

Suggested API:

```ts
resolveTheme(preferences: ThemePreferences, customThemes: CustomTheme[]): ResolvedTheme
validateTheme(tokens: ThemeTokens): ThemeValidationResult
applyTheme(theme: ResolvedTheme): void
```

Theme validation and resolution must be pure and unit tested.

---

## UI rules

Follow `DESIGN.md` and Uncodixfy.

### Required visual behavior

- Use a normal single-column side-panel layout.
- Use simple borders to separate sections.
- Use compact rows.
- Use semantic theme tokens for every color.
- Default to the restrained warm-neutral Obsidian preset.
- Let density and radius preferences change token values, not component structure.
- Use 6–8px radius for controls in the default preset.
- Use direct labels.
- Use one consistent icon set at 16–18px.
- Use normal forms with labels above inputs.
- Use underline or border-based text tabs.
- Use clear focus rings.
- Use 100–160ms opacity and color transitions only.

### Forbidden patterns

Do not add:

- Hero sections
- Eyebrow labels
- Uppercase letter-spaced section captions
- Gradient text
- Gradient backgrounds
- Glassmorphism
- Floating outer shells
- Detached rounded sidebars
- Decorative cards
- Large border radii
- Pill navigation
- Pills for every status
- Metric cards
- Charts
- Progress bars used as decoration
- Glows
- Blur haze
- Colored shadows
- Transform-on-hover motion
- Bouncy animation
- Decorative copy
- Fake activity feeds
- “Control center” language
- “Your workspace, reimagined” language
- Empty space used to make the interface appear premium

If a UI choice resembles a generic AI dashboard, replace it with a plainer and more functional pattern.

---

## Copy style

Use concise product language.

Preferred:

- `Clean now`
- `Archive`
- `Restore`
- `Keep`
- `Protect domain`
- `Unused for 6 hours`
- `No archived tabs`
- `Could not save this tab, so it was not closed`

Avoid:

- `Optimize workspace`
- `Begin cleanup journey`
- `Your focus hub`
- `Intelligent tab orchestration`
- `Operational clarity`
- `Digital serenity`
- `AI-powered organization`

The MVP should not describe itself as intelligent or AI-powered.

---

## Accessibility requirements

Every implementation must preserve:

- Keyboard navigation
- Visible focus states
- Semantic buttons and inputs
- Accessible names for icon buttons
- Polite live-region updates for copy and cleanup results
- Reduced-motion support
- Color contrast suitable for normal text
- Focus trapping and restoration in dialogs
- No hover-only essential actions

Do not merge UI work that cannot be used with a keyboard.

---

## Error handling

Use typed domain errors.

```ts
type TabShelfErrorCode =
  | "TAB_NOT_FOUND"
  | "TAB_INELIGIBLE"
  | "INVALID_URL"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "TAB_CLOSE_FAILED"
  | "TAB_RESTORE_FAILED"
  | "IMPORT_INVALID"
  | "UNKNOWN";
```

User-facing errors should state:

1. What failed.
2. Whether information is safe.
3. What the user can do next.

Example:

```text
This tab was not closed because its archive could not be saved.
```

Never hide a storage failure and continue closing.

---

## Testing requirements

### Unit tests

Cover:

- URL normalization
- Internal URL detection
- Domain matching
- Eligibility reasons
- Time threshold calculations
- Duplicate keys
- Note filtering by active domain
- Storage validation
- Storage migrations
- Export/import validation
- Cleanup batching
- Settings defaults
- Theme preset resolution
- Custom theme validation and fallback
- Contrast warnings
- Saved-item primary action behavior
- Inline edit validation

### Integration tests

Cover:

- Side panel opens from extension action.
- Active tab is never auto-closed.
- Pinned tab is never auto-closed.
- Audible tab is never auto-closed.
- Protected domain is never auto-closed.
- Archive write occurs before tab removal.
- Storage failure prevents tab removal.
- Archived tab restores correctly.
- Domain note appears on the matching site.
- Copy button copies the exact stored value.
- Clicking a saved value enters inline edit mode.
- Saving a changed URL updates the Current site section immediately.
- Canceling an edit restores the original value.
- Storage failure preserves the original value.
- URL rows honor Copy, Open, and Edit primary actions.
- Theme presets apply without reloading.
- A custom theme persists across side-panel reload.
- Invalid imported theme data falls back safely.
- Manual cleanup and alarm cleanup use the same safety logic.
- Settings survive side-panel reload.
- Keyboard navigation reaches all actions.

### Regression tests

Every safety bug receives a regression test before or with the fix.

Do not weaken tests to make a change pass.

---

## Quality commands

Keep package scripts predictable:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run format:check && npm run test && npm run build"
  }
}
```

Before declaring work complete, run the relevant checks. For repository-wide changes, run `npm run check` and the extension integration tests.

Report failures honestly.

---

## Implementation order

Work in this order unless the repository already contains later phases:

### Phase 1 — foundation

- Scaffold Manifest V3 extension
- Configure Vite and TypeScript
- Add side panel
- Add service worker
- Add typed Chrome wrappers
- Add storage schema and defaults
- Add test harness

### Phase 2 — safe tab logic

- URL helpers
- Eligibility rules
- Inactivity calculations
- Discard flow
- Archive-before-close flow
- Cleanup alarm
- Manual cleanup
- Unit and integration tests

### Phase 3 — archive interface

- Archive search
- Date grouping
- Restore
- Delete
- Empty and error states
- Keyboard navigation

### Phase 4 — notes and editable links

- CRUD
- Domain associations
- Current-site filtering
- Clipboard actions
- Configurable Copy, Open, and Edit primary actions
- Inline click-to-edit values
- URL validation and safe rollback
- Context menu for manually saving selected text, only after required permissions and privacy review

### Phase 5 — settings, themes, and portability

- Cleanup settings
- Protected domains
- Built-in theme presets
- Custom theme editor
- Density, radius, font, and favicon preferences
- Contrast validation
- Theme save, rename, duplicate, reset, and delete
- Export/import
- Storage use
- Data migrations

### Phase 6 — polish

- Accessibility pass
- Reduced motion
- Performance
- Batch limits
- Regression tests
- README and permission explanation
- Chrome Web Store preparation

Do not start AI features before the MVP acceptance criteria pass.

---

## Agent working rules

When modifying this repository:

1. Inspect existing code before proposing a replacement.
2. Preserve working behavior unless the task explicitly changes it.
3. Prefer small, reviewable changes.
4. Keep tab-safety logic centralized.
5. Do not duplicate eligibility rules in UI components.
6. Do not make broad permission changes without explaining them.
7. Do not introduce a backend.
8. Do not add dependencies for trivial helpers.
9. Do not redesign unrelated surfaces.
10. Do not silently change persisted schemas.
11. Add a migration for schema changes.
12. Add tests for behavior changes.
13. Keep user-facing copy direct.
14. Treat the archive as user data.
15. Never claim a test passed unless it was run.
16. Never close a tab in a test or implementation path before archive persistence is confirmed.

---

## Definition of done

A task is done when:

- The requested behavior works.
- Safety invariants remain true.
- Types are accurate.
- Storage changes include validation and migration where needed.
- Tests cover the behavior.
- Accessibility remains intact.
- UI follows `DESIGN.md`.
- Saved links can be corrected inline without navigating away.
- Themes use semantic tokens, remain readable, and persist correctly.
- Required checks pass.
- Documentation is updated when permissions, data, or behavior change.
- No unrelated generated-dashboard styling was introduced.

For cleanup-related work, explicitly verify:

```text
archive write succeeded -> tab close attempted
archive write failed    -> tab close not attempted
```
