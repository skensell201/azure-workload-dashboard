import React from 'react';
import { AccessDecision } from '../services/access';
import { LoadOrchestrator } from '../services/LoadOrchestrator';
import { App } from './App';
import { AccessPanelService } from './AccessPanel';

const STORAGE_WARNING =
  'The access list could not be read — showing an empty list here too. Changes may not save until storage is available.';

/**
 * Sync render switch for the hub: denial sentence, unreadable-list error, or the app
 * (with the Access panel available to admins). All async work — resolving the user,
 * the decision, the list — happens upstream in hub.tsx.
 */
export function AccessGate({
  decision,
  listUnreadable,
  orchestrator,
  baseUrl,
  accessService,
}: {
  decision: AccessDecision;
  listUnreadable: boolean;
  orchestrator: LoadOrchestrator;
  baseUrl: string;
  accessService: AccessPanelService;
}): JSX.Element {
  if (!decision.allowed) {
    if (decision.reason === 'list-unreadable') {
      return (
        <div className="error-box">
          The access list could not be read, so access cannot be verified. Ask a collection
          administrator to check the extension&apos;s data storage and try again.
        </div>
      );
    }
    if (decision.reason === 'membership-unverified') {
      return (
        <div className="error-box">
          Your group membership could not be checked, so access to Workload could not be confirmed.
          Ask a collection administrator to add you directly.
        </div>
      );
    }
    return <div className="denied">You do not have access to Workload. Ask a collection administrator to grant it.</div>;
  }

  const isAdmin = decision.reason === 'admin';
  return (
    <App
      orchestrator={orchestrator}
      baseUrl={baseUrl}
      isAdmin={isAdmin}
      accessService={isAdmin ? accessService : undefined}
      accessWarning={isAdmin && listUnreadable ? STORAGE_WARNING : undefined}
    />
  );
}
