import { waitFor } from '@testing-library/react';

/**
 * hub.tsx runs start().catch(...) as a side effect of being imported, so each test
 * imports it fresh (jest.resetModules) after wiring up the SDK mock for that scenario.
 */
function mockSdk(overrides: Record<string, unknown> = {}): Record<string, jest.Mock> {
  const sdk: Record<string, jest.Mock> = {
    init: jest.fn().mockResolvedValue(undefined),
    notifyLoadSucceeded: jest.fn().mockResolvedValue(undefined),
    notifyLoadFailed: jest.fn().mockResolvedValue(undefined),
    getService: jest.fn().mockResolvedValue({}),
    getAccessToken: jest.fn().mockResolvedValue('token'),
    getUser: jest.fn().mockReturnValue({ id: 'u1' }),
    getContributionId: jest.fn().mockReturnValue('some-other-contribution'),
    register: jest.fn(),
    getExtensionContext: jest.fn().mockReturnValue({ id: 'ext' }),
    ...overrides,
  };
  jest.doMock('azure-devops-extension-sdk', () => sdk);
  return sdk;
}

describe('hub init failure handling', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('notifies the host of the load failure (instead of leaving the loading spinner up forever) when init throws', async () => {
    const sdk = mockSdk({ init: jest.fn().mockRejectedValue(new Error('boom')) });

    require('../hub');

    await waitFor(() => expect(sdk.notifyLoadFailed).toHaveBeenCalled());
    expect(document.getElementById('root')?.textContent).toMatch(/Failed to initialize Workload Dashboard: boom/);
  });

  it('still shows the original failure message even when notifying the host of the failure itself rejects', async () => {
    const sdk = mockSdk({
      init: jest.fn().mockRejectedValue(new Error('boom')),
      notifyLoadFailed: jest.fn().mockRejectedValue(new Error('host unreachable')),
    });

    require('../hub');

    await waitFor(() => expect(sdk.notifyLoadFailed).toHaveBeenCalled());
    // Give the wrapped .catch on notifyLoadFailed a chance to run without throwing.
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('root')?.textContent).toMatch(/Failed to initialize Workload Dashboard: boom/);
  });
});
