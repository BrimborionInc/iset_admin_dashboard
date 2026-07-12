import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PaymentsDataProvider, usePaymentsData } from './PaymentsDataContext';
import { apiFetch } from '../../../auth/apiClient';

jest.mock('../../../auth/apiClient', () => ({ apiFetch: jest.fn() }));

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
  json: jest.fn(async () => payload),
});

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

let latestContext = null;
const Probe = () => {
  latestContext = usePaymentsData();
  return null;
};

const packet = (id, caseId, lineId = `${id}-line`) => ({
  id,
  caseId,
  status: 'ready_to_send',
  lines: [{ id: lineId, packetId: id, amount: 10, status: 'ready_to_send' }],
});

describe('PaymentsDataProvider filter ownership', () => {
  beforeEach(() => {
    latestContext = null;
    apiFetch.mockReset();
  });

  test('masks the old packet immediately and ignores its superseded response', async () => {
    const caseA = deferred();
    const caseB = deferred();
    apiFetch.mockImplementation(url => {
      if (url === '/api/finance/payment-intervention-type-map') return Promise.resolve(response({}));
      if (url.includes('caseId=101')) return caseA.promise;
      if (url.includes('caseId=202')) return caseB.promise;
      if (url.includes('/api/finance/payment-communications')) return Promise.resolve(response([]));
      throw new Error(`Unexpected payment request: ${url}`);
    });

    const view = render(
      <PaymentsDataProvider filters={{ caseId: 101 }}><Probe /></PaymentsDataProvider>
    );
    view.rerender(
      <PaymentsDataProvider filters={{ caseId: 202 }}><Probe /></PaymentsDataProvider>
    );
    expect(latestContext.requests).toEqual([]);
    expect(latestContext.selectedRequest).toBeNull();
    expect(latestContext.selectedRequestId).toBeNull();

    await act(async () => {
      caseB.resolve(response([packet('B', 202, 'B-line')]));
      await caseB.promise;
    });
    await waitFor(() => expect(latestContext.selectedRequest?.id).toBe('B'));

    await act(async () => {
      caseA.resolve(response([packet('A', 101, 'A-line')]));
      await caseA.promise;
    });
    expect(latestContext.requests.map(item => item.id)).toEqual(['B']);
    expect(latestContext.selectedRequest?.id).toBe('B');
    await expect(latestContext.updatePacketStatus('A', 'submitted')).rejects.toMatchObject({
      code: 'PAYMENT_SCOPE_NOT_READY',
    });
    expect(apiFetch.mock.calls.some(([url, options]) =>
      url.includes('/payment-packets/A/status') && options?.method === 'POST'
    )).toBe(false);
  });

  test('ignores communications that resolve after the selected case changes', async () => {
    const communicationA = deferred();
    apiFetch.mockImplementation(url => {
      if (url === '/api/finance/payment-intervention-type-map') return Promise.resolve(response({}));
      if (url.includes('caseId=101')) return Promise.resolve(response([packet('A', 101)]));
      if (url.includes('caseId=202')) return Promise.resolve(response([packet('B', 202)]));
      if (url.includes('packetId=A')) return communicationA.promise;
      if (url.includes('packetId=B')) return Promise.resolve(response([{ id: 'B-comm', packetId: 'B' }]));
      throw new Error(`Unexpected payment request: ${url}`);
    });

    const view = render(
      <PaymentsDataProvider filters={{ caseId: 101 }}><Probe /></PaymentsDataProvider>
    );
    await waitFor(() => expect(latestContext.selectedRequest?.id).toBe('A'));
    view.rerender(
      <PaymentsDataProvider filters={{ caseId: 202 }}><Probe /></PaymentsDataProvider>
    );
    expect(latestContext.selectedRequest).toBeNull();
    expect(latestContext.communications).toEqual([]);
    await waitFor(() => expect(latestContext.selectedRequest?.id).toBe('B'));
    await waitFor(() => expect(latestContext.communications.map(item => item.id)).toEqual(['B-comm']));

    await act(async () => {
      communicationA.resolve(response([{ id: 'A-comm', packetId: 'A' }]));
      await communicationA.promise;
    });
    expect(latestContext.communications.map(item => item.id)).toEqual(['B-comm']);
  });
});
