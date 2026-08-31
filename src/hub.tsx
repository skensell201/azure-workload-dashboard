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
import { decideAccess } from './services/access';

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
  await SDK.init();
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
  const [list, isAdmin] = await Promise.all([accessService.readList(), accessService.isCollectionAdmin(user.id)]);
  // Skip the group-membership lookup once admin already grants access, or once there is
  // no list to match against — decideAccess ignores userGroupIds in both cases anyway.
  const userGroupIds = !isAdmin && list && list.entries.length > 0 ? await accessService.getUserGroupIds(user.id) : [];
  const decision = decideAccess({ list, userId: user.id, isAdmin, userGroupIds });

  if (SDK.getContributionId() === CONSTRAINT_CONTRIBUTION_ID) {
    SDK.register(CONSTRAINT_CONTRIBUTION_ID, () => ({ isMatch: () => decision.allowed }));
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
}

start().catch((e) => {
  console.error('Workload Dashboard init failed:', e);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to initialize Workload Dashboard: ${describeError(e)}`;
});
