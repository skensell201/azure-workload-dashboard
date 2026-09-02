import React from 'react';
import { AccessDecision } from '../services/access';
import { LoadOrchestrator } from '../services/LoadOrchestrator';
import { App } from './App';

const STORAGE_WARNING =
  'The access list could not be read, so the restriction is not being applied. Open Collection Settings → Extensions → Workload Access to check it.';

/**
 * Sync render switch for the hub: denial sentence, unreadable-list error, or the app
 * All async work — resolving the user, the decision, the list — happens upstream in
 * hub.tsx; the allow-list itself is edited from collection settings, not from here.
 */
export function AccessGate({
  decision,
  listUnreadable,
  orchestrator,
  baseUrl,
}: {
  decision: AccessDecision;
  listUnreadable: boolean;
  orchestrator: LoadOrchestrator;
  baseUrl: string;
}): JSX.Element {
  if (!decision.allowed) {
    if (decision.reason === 'list-unreadable') {
      return (
        <div className="error-box">
          The access list could not be read, so access cannot be verified. Please contact your
          company&rsquo;s technical support.
          <div className="hint">reason: {decision.reason}</div>
        </div>
      );
    }
    if (decision.reason === 'membership-unverified') {
      return (
        <div className="error-box">
          Your group membership could not be checked, so access to Workload could not be confirmed.
          Please contact your company&rsquo;s technical support.
          <div className="hint">reason: {decision.reason}</div>
        </div>
      );
    }
    return (
      <div className="denied">
        You do not have access to Workload. Please contact your company&rsquo;s technical support.
        {/* Named so a wrong denial can be diagnosed from the screen rather than server logs. */}
        <div className="hint">reason: {decision.reason}</div>
      </div>
    );
  }

  const isAdmin = decision.reason === 'admin';
  // Without this, "the restriction is configured but this page reads an empty list" is
  // indistinguishable from "everyone is meant to see this" — both just show the data.
  const unrestrictedNotice =
    decision.reason === 'unrestricted'
      ? 'The access list is empty, so everyone can open Workload. Add entries in Collection Settings → Extensions → Workload Access.'
      : undefined;
  return (
    <App
      orchestrator={orchestrator}
      baseUrl={baseUrl}
      accessWarning={isAdmin && listUnreadable ? STORAGE_WARNING : unrestrictedNotice}
    />
  );
}
