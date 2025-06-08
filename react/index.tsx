"use client";

import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";

// TODO: check validity of these as well
type CapWidgetProps = {
  "data-cap-api-endpoint"?: string;
} & React.ComponentProps<"form">;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cap-widget": CapWidgetProps;
    }
  }
}

export type HTMLCapElement = HTMLFormElement;

// TODO: check validity of these types (1/2)
type SolveEventDetail = {
  token: string;
};
type ErrorEventDetail = {
  isCap: boolean;
  message: string;
};
type ProgressEventDetail = {
  progress: number;
};

// TODO: check validity of these types (2/2)
type SolveEvent = SolveEventDetail & {
  type: "solve";
  detail: SolveEventDetail;
  target: HTMLElement;
  currentTarget: EventTarget | null;
  isTrusted: boolean;
};
type ErrorEvent = ErrorEventDetail & {
  type: "error";
  detail: ErrorEventDetail;
  target: HTMLElement;
  currentTarget: EventTarget | null;
  isTrusted: boolean;
};
type ResetEvent = {
  type: "reset";
  detail: object; // empty object
  target: HTMLElement;
  currentTarget: EventTarget | null;
  isTrusted: boolean;
};
type ProgressEvent = ProgressEventDetail & {
  type: "progress";
  detail: ProgressEventDetail;
  target: HTMLElement;
  currentTarget: EventTarget | null;
  isTrusted: boolean;
};

type CapProps = {
  apiEndpoint: string;
  onSolve?: (e: SolveEvent) => void | Promise<void>;
  onError?: (e: ErrorEvent) => void | Promise<void>;
  onReset?: (e: ResetEvent) => void | Promise<void>;
  onProgress?: (e: ProgressEvent) => void | Promise<void>;
  ref?: React.RefObject<unknown>;
  className?: string;
  style?: React.CSSProperties;
};

export function Cap({ apiEndpoint, ref, onSolve, onError, onReset, onProgress, ...props }: CapProps) {
  const widgetRef = useRef<HTMLFormElement>(null);

  // handle reseting the widget with a passed ref
  useImperativeHandle(
    ref,
    () => {
      return {
        solve: async () => {
          return await widgetRef?.current?.solve();
        },
        reset: () => {
          widgetRef?.current?.reset();
        }
      };
    },
    []
  );

  // TODO: ship js script with the package instead of using a CDN
  // inject cap.js widget web component script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@cap.js/widget";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // event listener handlers
  const onSolveCallback = useCallback(
    (e: unknown) => {
      onSolve?.(e as SolveEvent);
    },
    [onSolve]
  );
  const onErrorCallback = useCallback(
    (e: unknown) => {
      onError?.(e as ErrorEvent);
    },
    [onError]
  );
  const onResetCallback = useCallback(
    (e: unknown) => {
      onReset?.(e as ResetEvent);
    },
    [onReset]
  );
  const onProgressCallback = useCallback(
    (e: unknown) => {
      onProgress?.(e as ProgressEvent);
    },
    [onProgress]
  );

  // add event listeners to the widget
  useEffect(() => {
    const widget = widgetRef.current;

    if (!widget) return;

    widget.addEventListener("solve", (e) => onSolveCallback(e));
    widget.addEventListener("error", (e) => onErrorCallback(e));
    widget.addEventListener("reset", (e) => onResetCallback(e));
    widget.addEventListener("progress", (e) => onProgressCallback(e));

    return () => {
      widget.removeEventListener("solve", (e) => onSolveCallback(e));
      widget.removeEventListener("error", (e) => onErrorCallback(e));
      widget.removeEventListener("reset", (e) => onResetCallback(e));
      widget.removeEventListener("progress", (e) => onProgressCallback(e));
    };
  }, [onSolveCallback, onErrorCallback, onResetCallback, onProgressCallback]);

  return (
    <cap-widget
      ref={widgetRef}
      data-cap-api-endpoint={apiEndpoint}
      {...props}
    />
  );
}
