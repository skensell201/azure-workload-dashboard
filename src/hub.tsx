import './hub.css';
import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, ILocationService } from 'azure-devops-extension-api';
import React from 'react';
import ReactDOM from 'react-dom';
import { RestApiClient } from './services/ApiClient';
import { ProjectService } from './services/ProjectService';
import { IterationService } from './services/IterationService';
import { WorkItemService } from './services/WorkItemService';
import { LoadOrchestrator } from './services/LoadOrchestrator';
import { colorSchemeOf } from './services/theme';
import { App, describeError } from './components/App';

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
  });
  ReactDOM.render(<App orchestrator={orchestrator} baseUrl={baseUrl} />, document.getElementById('root'));
}

start().catch((e) => {
  console.error('Workload Dashboard init failed:', e);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to initialize Workload Dashboard: ${describeError(e)}`;
});
