import './hub.css';
import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, ILocationService, IExtensionDataService } from 'azure-devops-extension-api';
import React from 'react';
import ReactDOM from 'react-dom';
import { RestApiClient } from './services/ApiClient';
import { AccessService, AccessDocumentStore } from './services/AccessService';
import { colorSchemeOf } from './services/theme';
import { AccessPanel } from './components/AccessPanel';
import { describeError } from './components/App';

/** Runs after SDK.init, once the host has injected its theme variables. */
function followHostTheme(): void {
  const neutralZero = getComputedStyle(document.documentElement).getPropertyValue('--palette-neutral-0');
  document.documentElement.style.colorScheme = colorSchemeOf(neutralZero);
}

/**
 * Collection Settings → Extensions → Workload Access. Azure DevOps only shows this page to
 * users who can administer the collection, so the page itself does not re-check membership;
 * the hub still verifies every viewer independently before showing any data.
 */
async function start(): Promise<void> {
  await SDK.init({ loaded: false });
  followHostTheme();
  const loc = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const baseUrl = (await loc.getServiceLocation()).replace(/\/$/, '');
  const token = await SDK.getAccessToken();
  const api = new RestApiClient(baseUrl, token);

  // As in the hub: no browser-storage fallback, so an unreadable list stays unreadable
  // rather than looking like an empty one.
  let store: AccessDocumentStore | null = null;
  try {
    const dataSvc = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
    store = (await dataSvc.getExtensionDataManager(SDK.getExtensionContext().id, token)) as unknown as AccessDocumentStore;
  } catch {
    store = null;
  }

  ReactDOM.render(
    <div className="app">
      <p className="hint">
        Who can open the Workload hub. An empty list means everyone can; collection administrators
        always can.
      </p>
      <AccessPanel service={new AccessService(api, store)} />
    </div>,
    document.getElementById('root')
  );
  await SDK.notifyLoadSucceeded();
}

start().catch((e) => {
  console.error('Workload Access init failed:', e);
  const root = document.getElementById('root');
  if (root) {
    root.textContent = `Failed to initialize Workload Access: ${describeError(e)}`;
    root.className = 'error-box';
  }
  void SDK.notifyLoadSucceeded().catch(() => undefined);
});
