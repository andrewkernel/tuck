import { useEffect, useRef, useState } from "react";
import type { SavedNote } from "../../domain/types";
import { normalizeUrl } from "../../shared/urls";

export function NoteRow({
  note,
  onCopy,
  onOpen,
  onSave,
  onDelete,
}: {
  note: SavedNote;
  onCopy: (note: SavedNote) => void;
  onOpen: (note: SavedNote) => void;
  onSave: (note: SavedNote) => Promise<boolean>;
  onDelete?: (note: SavedNote) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.value);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  useEffect(() => {
    setValue(note.value);
  }, [note.value]);
  const save = async () => {
    const next = value.trim();
    if (!next) {
      setError("Value cannot be empty.");
      return;
    }
    if (note.kind === "url" && !normalizeUrl(next)) {
      setError("Enter a valid http or https URL.");
      return;
    }
    if (await onSave({ ...note, value: next })) {
      setEditing(false);
      setError("");
    }
  };
  const primary = () => {
    if (note.primaryAction === "copy") onCopy(note);
    else if (note.primaryAction === "open") onOpen(note);
    else setEditing(true);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setValue(note.value);
      setError("");
      setEditing(false);
    }
    if (event.key === "Enter" && (!event.shiftKey || note.kind === "url")) {
      event.preventDefault();
      void save();
    }
  };
  return (
    <article className={`row note-row ${editing ? "editing" : ""}`} onClick={primary}>
      <div className="row-main">
        <button
          className="row-title"
          onClick={(event) => {
            event.stopPropagation();
            primary();
          }}
        >
          {note.title}
        </button>
        {editing ? (
          <div className="inline-editor" onClick={(event) => event.stopPropagation()}>
            {note.kind === "text" ||
            note.kind === "email" ||
            note.kind === "resume" ||
            note.kind === "form" ? (
              <textarea
                ref={input as React.RefObject<HTMLTextAreaElement>}
                aria-label={`Edit ${note.title}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={onKeyDown}
              />
            ) : (
              <input
                ref={input as React.RefObject<HTMLInputElement>}
                aria-label={`Edit ${note.title}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={onKeyDown}
              />
            )}
            <div className="inline-actions">
              <button className="text-button" onClick={() => void save()}>
                Save
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setValue(note.value);
                  setError("");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <button
            className="row-value"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
            title="Edit saved value"
          >
            {note.value}
          </button>
        )}
        {note.domains.length > 0 && <p className="row-meta">{note.domains.join(", ")}</p>}
      </div>
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        <button className="text-button" onClick={() => onCopy(note)}>
          Copy
        </button>
        {note.kind === "url" && (
          <button className="text-button" onClick={() => onOpen(note)}>
            Open
          </button>
        )}
        <button className="text-button" onClick={() => setEditing(true)}>
          Edit
        </button>
        {onDelete && (
          <button className="text-button danger-text" onClick={() => onDelete(note)}>
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
