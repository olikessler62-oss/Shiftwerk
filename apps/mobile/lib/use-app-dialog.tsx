import { useCallback, useRef, useState } from "react";
import { AppDialogModal } from "@/components/app-dialog-modal";

export type AppDialogAlertOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
};

export type AppDialogConfirmOptions = AppDialogAlertOptions & {
  cancelLabel?: string;
  confirmDestructive?: boolean;
};

type DialogState =
  | {
      kind: "alert";
      options: AppDialogAlertOptions;
      resolve: () => void;
    }
  | {
      kind: "confirm";
      options: AppDialogConfirmOptions;
      resolve: (confirmed: boolean) => void;
    };

export function useAppDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const alert = useCallback((options: AppDialogAlertOptions) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", options, resolve });
    });
  }, []);

  const confirm = useCallback((options: AppDialogConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", options, resolve });
    });
  }, []);

  const finishAlert = useCallback(() => {
    const current = stateRef.current;
    if (current?.kind !== "alert") return;
    current.resolve();
    setState(null);
  }, []);

  const finishConfirm = useCallback((confirmed: boolean) => {
    const current = stateRef.current;
    if (current?.kind !== "confirm") return;
    current.resolve(confirmed);
    setState(null);
  }, []);

  const dialog = (
    <AppDialogModal
      visible={state != null}
      title={state?.options.title ?? ""}
      message={state?.options.message ?? ""}
      confirmLabel={state?.options.confirmLabel ?? "OK"}
      cancelLabel={
        state?.kind === "confirm" ? (state.options.cancelLabel ?? "Abbrechen") : undefined
      }
      showCancel={state?.kind === "confirm"}
      confirmDestructive={
        state?.kind === "confirm" ? Boolean(state.options.confirmDestructive) : false
      }
      onCancel={() => finishConfirm(false)}
      onConfirm={() => {
        if (state?.kind === "confirm") {
          finishConfirm(true);
        } else {
          finishAlert();
        }
      }}
    />
  );

  return { alert, confirm, dialog };
}
