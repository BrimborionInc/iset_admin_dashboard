import React from 'react';
import { Container, Header, Box, SpaceBetween } from '@cloudscape-design/components';

const FinancePlaceholder = ({ title, description, children }) => (
  <Container
    variant="stacked"
    header={<Header variant="h2">{title}</Header>}
  >
    <SpaceBetween size="m">
      {description && (
        <Box variant="p">{description}</Box>
      )}
      {children}
      {!description && !children && (
        <Box variant="p">This dashboard is under construction.</Box>
      )}
    </SpaceBetween>
  </Container>
);

export default FinancePlaceholder;
