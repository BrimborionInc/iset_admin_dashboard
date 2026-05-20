import {
  sortWorkQueueItems,
  toSortTimestamp,
} from '../workQueueItemsSorting';

describe('workQueueItemsSorting', () => {
  it('sorts the adaptive Item column using the same applicant/title fallbacks as the table', () => {
    const items = [
      { id: 'case-2', title: 'Zoe Martin' },
      { id: 'case-1', applicant: 'Avery Stone' },
      { id: 'case-3', applicant_name: 'Mika Lee' },
    ];

    expect(sortWorkQueueItems(items, 'title').map(item => item.id)).toEqual([
      'case-1',
      'case-3',
      'case-2',
    ]);
  });

  it('sorts the NWAC All Cases next-action column by date and keeps blank values last', () => {
    const items = [
      { id: 'no-next-action', dueDate: null },
      { id: 'later', dueDate: '2026-04-17' },
      { id: 'earlier', dueDate: '2025-11-26' },
    ];

    expect(sortWorkQueueItems(items, 'dueDate').map(item => item.id)).toEqual([
      'earlier',
      'later',
      'no-next-action',
    ]);

    expect(
      sortWorkQueueItems(items, 'dueDate', { isDescending: true }).map(item => item.id)
    ).toEqual([
      'later',
      'earlier',
      'no-next-action',
    ]);
  });

  it('uses supplied timeline resolvers for role-specific SLA columns', () => {
    const items = [
      { id: 'b', dueAt: '2026-04-20' },
      { id: 'a', dueAt: '2026-04-03' },
    ];

    const sorted = sortWorkQueueItems(items, 'dueDate', {
      resolveDueDateSortValue: item => toSortTimestamp(item.dueAt),
    });

    expect(sorted.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('sorts the Tag column so tagged rows can be grouped', () => {
    const items = [
      { id: 'untagged', __isWatched: false },
      { id: 'tagged', __isWatched: true },
    ];

    expect(
      sortWorkQueueItems(items, 'watch', { isDescending: true }).map(item => item.id)
    ).toEqual(['tagged', 'untagged']);
  });
});
