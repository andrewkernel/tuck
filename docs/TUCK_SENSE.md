# Tuck Sense

Tuck Sense is an optional, on-device tab context engine. It helps you review browser clutter without delegating browser actions to a model.

## What it can propose

- Project groups with a short, editable native Chrome group title.
- Individual duplicate or stale-tab archive reviews.
- Local-first tab search matches tab titles, domains, URLs, and any user-approved saved notes before Chrome's on-device model reranks only those candidates.
- Natural-language tab search, such as “find tabs for an internship application.”

## Privacy boundary

Tuck Sense runs through Chrome's built-in Prompt API in the side panel. TabShelf sends no tab titles, URLs, notes, or model output to a server.

Search results can be marked **Relevant** or **Not relevant**. TabShelf stores that local preference only for the normalized query and tab id, so it can refine repeat searches without creating a model profile.

Saved note values are excluded by default. The user must check **Include saved note values in this analysis** immediately before an analysis to share them with Chrome's on-device model. TabShelf persists only the validated suggestion result needed to resume review—not model prompts, model sessions, page content, screenshots, cookies, or tokens.

## Safety boundary

The model cannot call Chrome APIs. It produces constrained JSON only, which TabShelf validates before displaying it.

For search, the model may reorder only the locally retrieved candidate ids. Unknown or duplicate ids are discarded, and every local candidate remains reviewable.

- Group proposals must use known, ungrouped web tabs from one window.
- Existing native groups are never modified by Tuck Sense.
- Archive proposals are displayed only for tabs that are currently archive-eligible.
- Clicking **Create group** separately re-reads and validates each tab.
- Clicking **Archive** uses the same archive-write-confirmed-before-close flow as every other manual archive.
- Tuck Sense never automatically groups, archives, closes, restores, or opens a tab.

## Availability and fallback

Tuck Sense is progressive enhancement. The rest of TabShelf works from Chrome 116 onward. The Tuck Sense control is unavailable unless the current Chrome device supports the built-in Prompt API and its structured output. Users can always use the regular **Group tabs**, archive, and search flows.

Chrome documents the Prompt API's extension availability, model download behavior, device requirements, and structured-output support in the [Prompt API guide](https://developer.chrome.com/docs/ai/prompt-api).
