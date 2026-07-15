import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, []);
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="dialog" aria-describedby="dialog-detail">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description id="dialog-detail">{detail}</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button ref={cancel} className="button">
                Cancel
              </button>
            </Dialog.Close>
            <button className="button danger-fill" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
