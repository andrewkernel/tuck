import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
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
              <button className="text-button with-icon" onClick={() => void save()}>
                <Save aria-hidden="true" size={15} strokeWidth={1.8} />
                Save
              </button>
              <button
                className="text-button with-icon"
                onClick={() => {
                  setValue(note.value);
                  setError("");
                  setEditing(false);
                }}
              >
                <X aria-hidden="true" size={15} strokeWidth={1.8} />
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
        <button className="text-button with-icon" onClick={() => onCopy(note)}>
          <Copy aria-hidden="true" size={15} strokeWidth={1.8} />
          Copy
        </button>
        {note.kind === "url" && (
          <button className="text-button with-icon" onClick={() => onOpen(note)}>
            <ExternalLink aria-hidden="true" size={15} strokeWidth={1.8} />
            Open
          </button>
        )}
        <button className="text-button with-icon" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" size={15} strokeWidth={1.8} />
          Edit
        </button>
        {onDelete && (
          <button className="text-button danger-text with-icon" onClick={() => onDelete(note)}>
            <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
