import React from 'react';
import { ContentLayout } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import AssessedCasesWidget from '../widgets/AssessedCasesWidget';

const boardI18nStrings = {
  liveAnnouncementDndStarted: (position, title) => `Picked up item at position ${position + 1}${title ? `, titled ${title}` : ''}.`,
  liveAnnouncementDndItemReordered: (initialPosition, currentPosition, title) => {
    if (initialPosition === currentPosition) {
      return `Item is back to its starting position${title ? `, titled ${title}` : ''}.`;
    }
    return `Item moved from position ${initialPosition + 1} to position ${currentPosition + 1}${title ? `, titled ${title}` : ''}.`;
  },
  liveAnnouncementDndItemCommitted: (initialPosition, currentPosition, title) => {
    if (initialPosition === currentPosition) {
      return `Item was dropped and is back to its starting position${title ? `, titled ${title}` : ''}.`;
    }
    return `Item was dropped at position ${currentPosition + 1}${title ? `, titled ${title}` : ''}.`;
  },
  liveAnnouncementDndDisallowed: () => 'Move not allowed',
  liveAnnouncementItemRemoved: (position, title) => `Removed item at position ${position + 1}${title ? `, titled ${title}` : ''}.`,
  liveAnnouncementItemAdded: (position, title) => `Added item at position ${position + 1}${title ? `, titled ${title}` : ''}.` ,
  navigationAriaLabel: 'Board navigation',
  navigationAriaDescription: 'Use arrow keys to navigate between items.',
};

const AssessmentReviewDashboard = () => {
  return (
    <ContentLayout>
      <Board
        items={[
          {
            id: 'assessed-cases',
            rowSpan: 7,
            columnSpan: 4,
            data: { title: 'Assessed Cases', content: null }
          }
        ]}
        i18nStrings={boardI18nStrings}
        renderItem={(item, actions) => (
          <AssessedCasesWidget actions={actions} />
        )}
      />
    </ContentLayout>
  );
};

export default AssessmentReviewDashboard;
