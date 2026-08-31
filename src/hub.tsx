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

/**
 * Full id of the ms.vss-web.control-constraint contribution declared in vss-extension.json,
 * used only to tell "the host loaded this page to evaluate the hub-visibility constraint"
 * apart from "the host loaded this page to render the hub". Harmless if the on-prem host
 * does not honour control-constraint at all — the in-hub gate below is the real enforcement.
 */
const CONSTRAINT_CONTRIBUTION_ID = 'iksoftware.workload-dashboard.workload-access-constraint';

/** Runs after SDK.init, once the host has injected its theme variables. */
function followHostTheme(): void {
  const neutralZero = getComputedStyle(document.documentElement).getPropertyValue('--palette-neutral-0');
  document.documentElement.style.colorScheme = colorSchemeOf(neutralZero);
}

async function start(): Promise<void> {
  // loaded: false so the host does not consider this page ready (and does not honour the
  // navigation constraint below) until this function explicitly calls
  // notifyLoadSucceeded() -- see I6. The default (loaded: true) would tell the host the
  // page is ready before SDK.register() for the constraint below ever runs.
  await SDK.init({ loaded: false });
  followHostTheme();
  const loc = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const baseUrl = (await loc.getServiceLocation()).replace(/\/$/, '');
  const token = await SDK.getAccessToken();
  const api = new RestApiClient(baseUrl, token);
  const orchestrator = new LoadOrchestrator({
    projects: new ProjectService(api),
    iterations: new IterationService(api),
    workItems: new WorkItemService(api),
    teams: new TeamService(api),
  });

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

  if (SDK.getContributionId() === CONSTRAINT_CONTRIBUTION_ID) {
    try {
      SDK.register(CONSTRAINT_CONTRIBUTION_ID, () => ({ isMatch: () => decision.allowed }));
    } catch (e) {
      // Registration failing must not prevent notifyLoadSucceeded below (see I6) --
      // an on-prem host that doesn't support this contribution type is a harmless no-op
      // here; the in-hub AccessGate below is the real enforcement either way.
      console.error('Workload Dashboard: failed to register the access constraint:', e);
    }
    await SDK.notifyLoadSucceeded();
    return;
  }

  ReactDOM.render(
    <AccessGate
      decision={decision}
      listUnreadable={list === null}
      orchestrator={orchestrator}
      baseUrl={baseUrl}
      accessService={accessService}
    />,
    document.getElementById('root')
  );
  // Only after registration/first render does the host learn the page is ready (I6).
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
