import { useEffect, useState } from "react";
import { BrainCircuit, FolderPlus, Search } from "lucide-react";
import type { StorageRoot, TuckSenseTabContext } from "../../domain/types";
import {
  analyzeTuckSense,
  getTuckSenseAvailability,
  searchTuckSense,
} from "../../tuck-sense/engine";
import { send } from "../api";

type AvailabilityLabel = "checking" | "unsupported" | Availability;

export function TuckSensePanel({
  root,
  onArchive,
  onStatus,
  onRefresh,
}: {
  root: StorageRoot;
  onArchive: (tabId: number) => void;
  onStatus: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [availability, setAvailability] = useState<AvailabilityLabel>("checking");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    matches: Array<{ tab: TuckSenseTabContext; reason: string }>;
  } | null>(null);

  useEffect(() => {
    if (!root.tuckSense.enabled) return;
    void getTuckSenseAvailability()
      .then(setAvailability)
      .catch(() => setAvailability("unsupported"));
  }, [root.tuckSense.enabled]);

  const notes = includeNotes ? root.notes : [];
  const getContext = () => send<TuckSenseTabContext[]>({ type: "GET_TUCK_SENSE_CONTEXT" });
  const saveState = async (patch: Partial<StorageRoot["tuckSense"]>) => {
    const saved = await send<StorageRoot>({ type: "UPDATE_TUCK_SENSE", patch });
    if (!saved.ok) {
      onStatus(saved.error.message);
      return false;
    }
    await onRefresh();
    return true;
  };
  const analyze = async () => {
    setWorking(true);
    setSearchResult(null);
    try {
      const context = await getContext();
      if (!context.ok) return onStatus(context.error.message);
      if (context.data.length < 2)
        return onStatus("Tuck Sense needs at least two ungrouped web tabs.");
      if (availability === "downloadable" || availability === "downloading")
        onStatus("Preparing Chrome's on-device model. This can take a moment.");
      const result = await analyzeTuckSense(context.data, notes);
      await saveState({ lastAnalysis: result.analysis });
      onStatus(
        `Tuck Sense proposed ${result.analysis.groups.length} groups and ${result.analysis.archiveSuggestions.length} archive reviews.`,
      );
    } catch (error) {
      onStatus(
        error instanceof Error ? error.message : "Tuck Sense could not generate suggestions.",
      );
    } finally {
      setWorking(false);
    }
  };
  const search = async () => {
    const question = query.trim();
    if (!question) return;
    setWorking(true);
    try {
      const context = await getContext();
      if (!context.ok) return onStatus(context.error.message);
      const result = await searchTuckSense(question, context.data, notes);
      setSearchResult({ answer: result.answer, matches: result.matches });
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Tuck Sense could not search these tabs.");
    } finally {
      setWorking(false);
    }
  };
  const createGroup = async (tabIds: number[], label: string) => {
    const result = await send<{ tabs: number; label: string }>({
      type: "GROUP_SUGGESTED_TABS",
      tabIds,
      label,
    });
    if (!result.ok) return onStatus(result.error.message);
    onStatus(`Created “${result.data.label}” with ${result.data.tabs} tabs.`);
    await onRefresh();
  };

  if (!root.tuckSense.enabled)
    return (
      <section className="section tuck-sense">
        <div className="section-title-row">
          <h2>Tuck Sense</h2>
          <button className="button with-icon" onClick={() => void saveState({ enabled: true })}>
            <BrainCircuit aria-hidden="true" size={16} strokeWidth={1.8} />
            Turn on
          </button>
        </div>
        <p className="section-detail">
          Optional on-device suggestions. Tab titles and URLs are analyzed only after you turn this
          on.
        </p>
      </section>
    );

  const analysis = root.tuckSense.lastAnalysis;
  const isUnavailable = availability === "unsupported" || availability === "unavailable";
  return (
    <section className="section tuck-sense">
      <div className="section-title-row">
        <h2>Tuck Sense</h2>
        <button className="text-button" onClick={() => void saveState({ enabled: false })}>
          Turn off
        </button>
      </div>
      <p className="section-detail">
        Suggestions run in Chrome and never group or close a tab without your separate action.
      </p>
      {isUnavailable ? (
        <p className="inline-error">
          Tuck Sense is unavailable. It needs a supported Chrome device with on-device AI enabled.
        </p>
      ) : (
        <>
          <label className="check-row tuck-sense-note-option">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(event) => setIncludeNotes(event.target.checked)}
            />
            Include saved note values in this analysis
          </label>
          <div className="button-row tuck-sense-actions">
            <button
              className="button primary with-icon"
              disabled={working}
              onClick={() => void analyze()}
            >
              <BrainCircuit aria-hidden="true" size={16} strokeWidth={1.8} />
              {working ? "Thinking…" : "Analyze tabs"}
            </button>
          </div>
          <div className="search tuck-sense-search">
            <label htmlFor="tuck-sense-query">Ask Tuck Sense</label>
            <div className="inline-search">
              <input
                id="tuck-sense-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void search()}
                placeholder="Find tabs for an internship application"
              />
              <button
                className="button with-icon"
                disabled={working || !query.trim()}
                onClick={() => void search()}
              >
                <Search aria-hidden="true" size={16} strokeWidth={1.8} />
                Find
              </button>
            </div>
          </div>
        </>
      )}
      {searchResult && (
        <div className="tuck-sense-result">
          <p className="section-detail">{searchResult.answer}</p>
          {searchResult.matches.map(({ tab, reason }) => (
            <div className="row" key={tab.id}>
              <div className="row-main">
                <p className="row-title static">{tab.title}</p>
                <p className="row-meta">
                  {tab.domain} · {reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {analysis && (
        <div className="tuck-sense-result">
          <p className="section-detail">{analysis.summary}</p>
          {analysis.groups.map((group) => (
            <div className="row" key={`${group.label}-${group.tabIds.join("-")}`}>
              <div className="row-main">
                <p className="row-title static">{group.label}</p>
                <p className="row-meta">
                  {group.tabIds.length} tabs · {group.reason}
                </p>
              </div>
              <button
                className="text-button with-icon"
                onClick={() => void createGroup(group.tabIds, group.label)}
              >
                <FolderPlus aria-hidden="true" size={15} strokeWidth={1.8} />
                Create group
              </button>
            </div>
          ))}
          {analysis.archiveSuggestions.map((suggestion) => (
            <div className="row" key={suggestion.tabId}>
              <div className="row-main">
                <p className="row-title static">{suggestion.title}</p>
                <p className="row-meta">
                  {suggestion.domain} · {suggestion.reason}
                </p>
              </div>
              <button className="text-button" onClick={() => onArchive(suggestion.tabId)}>
                Archive
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
