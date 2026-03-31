"use client";

import Link from "next/link";
import { OwnerModuleMeta, OwnerProcessState, STATE_LABEL } from "@/lib/owner/owner-ui-metadata";

function stateClasses(state: OwnerProcessState): string {
  switch (state) {
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "working":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "waiting_action":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "paused":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    case "active":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

type OwnerProcessBadgeProps =
  | {
      state: OwnerProcessState;
      label?: string;
      className?: string;
    }
  | {
      processState: OwnerProcessState;
      label?: string;
      className?: string;
    };

export function OwnerProcessBadge(props: OwnerProcessBadgeProps) {
  const resolvedState = "state" in props ? props.state : props.processState;
  const label = props.label;
  const className = props.className || "";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        stateClasses(resolvedState),
        className,
      ].join(" ")}
    >
      {label || STATE_LABEL[resolvedState]}
    </span>
  );
}

type LegacyOwnerModuleHeaderProps = {
  title: string;
  helperText: string;
  processState: OwnerProcessState;
  nextStep?: string;
  nextAction?: {
    label: string;
    href?: string;
  };
  stateLabel?: string;
  className?: string;
};

type MetaOwnerModuleHeaderProps = {
  meta: OwnerModuleMeta;
  className?: string;
};

type OwnerModuleHeaderProps = LegacyOwnerModuleHeaderProps | MetaOwnerModuleHeaderProps;

function hasMetaProps(props: OwnerModuleHeaderProps): props is MetaOwnerModuleHeaderProps {
  return "meta" in props;
}

export default function OwnerModuleHeader(props: OwnerModuleHeaderProps) {
  const className = props.className || "";

  const resolved = hasMetaProps(props)
    ? props.meta
    : {
        title: props.title,
        helperText: props.helperText,
        processState: props.processState,
        nextStep: props.nextStep,
        nextAction: props.nextAction,
        stateLabel: props.stateLabel,
      };

  return (
    <div className={["flex items-start justify-between gap-4 mb-4", className].join(" ")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-900">{resolved.title}</h2>
          <OwnerProcessBadge
            processState={resolved.processState}
            label={resolved.stateLabel}
          />
        </div>

        <p className="mt-1 text-sm text-slate-600 max-w-3xl">{resolved.helperText}</p>

        {resolved.nextStep ? (
          <p className="mt-1 text-xs text-slate-500">
            Siguiente paso: {resolved.nextStep}
          </p>
        ) : null}
      </div>

      {resolved.nextAction ? (
        <div className="shrink-0">
          {resolved.nextAction.href ? (
            <Link
              href={resolved.nextAction.href}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {resolved.nextAction.label}
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {resolved.nextAction.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
