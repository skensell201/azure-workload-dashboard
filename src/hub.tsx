import './hub.css';
import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, ILocationService, IExtensionDataService } from 'azure-devops-extension-api';
import React from 'react';
import ReactDOM from 'react-dom';
import { RestApiClient } from './services/ApiClient';
import { ProjectService } from './services/ProjectService';
import { IterationService } from './services/IterationService';
import { WorkItemService } from './services/WorkItemService';
import { TeamService } from './services/TeamService';
import { LoadOrchestrator } from './services/LoadOrchestrator';
import { colorSchemeOf } from './services/theme';
import { describeError } from './components/App';
import { AccessGate } from './components/AccessGate';
import { AccessService, AccessDocumentStore } from './services/AccessService';
import { resolveAccess } from './services/resolveAccess';

/** Runs after SDK.init, once the host has injected its theme variables. */
function followHostTheme(): void {
  const neutralZero = getComputedStyle(document.documentElement).getPropertyValue('--palette-neutral-0');
  document.documentElement.style.colorScheme = colorSchemeOf(neutralZero);
}

async function start(): Promise<void> {
  // loaded: false keeps the host's own overlay up until this function has decided what to
  // render, so a viewer never sees an empty page before the access check has finished.
  await SDK.init({ loaded: false });
  followHostTheme();

  const loc = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const baseUrl = (await loc.getServiceLocation()).replace(/\/$/, '');
  const token = await SDK.getAccessToken();
  const api = new RestApiClient(baseUrl, token);
  // Never fall back to browser storage here: a per-browser fallback would let anyone
  // self-authorise. If the data manager can't be obtained, the store stays null and
  // AccessService.readList() reports the list as unreadable (fail closed).
  let store: AccessDocumentStore | null = null;
  try {
    const dataSvc = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
    store = (await dataSvc.getExtensionDataManager(SDK.getExtensionContext().id, token)) as unknown as AccessDocumentStore;
  } catch {
    store = null;
  }
  const accessService = new AccessService(api, store);

  const user = SDK.getUser();
  const { decision, list } = await resolveAccess({ user, accessService });

  const orchestrator = new LoadOrchestrator({
    projects: new ProjectService(api),
    iterations: new IterationService(api),
    workItems: new WorkItemService(api),
    teams: new TeamService(api),
  });
  ReactDOM.render(
    <AccessGate
      decision={decision}
      listUnreadable={list === null}
      orchestrator={orchestrator}
      baseUrl={baseUrl}
    />,
    document.getElementById('root')
  );
  // Only after the first render does the host learn the page is ready.
  await SDK.notifyLoadSucceeded();
}

start().catch((e) => {
  console.error('Workload Dashboard init failed:', e);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to initialize Workload Dashboard: ${describeError(e)}`;
  // The host is still showing its own loading overlay (see the loaded: false comment
  // above) on top of the message we just wrote -- without this, any throw between
  // SDK.init and notifyLoadSucceeded leaves that overlay up forever, hiding the error.
  // A failure here must not replace the message above with a notify-call error, so it
  // is swallowed after logging rather than left to reject unhandled.
  SDK.notifyLoadFailed(describeError(e)).catch((notifyErr) => {
    console.error('Workload Dashboard: failed to notify the host of the load failure:', notifyErr);
  });
});
