import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormField,
  Input,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';

const JOB_BANK_BASE_URL = 'https://www.jobbank.gc.ca/jobsearch/jobsearch';
const PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

const normalizeLocationForSearch = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';

  const alreadyParenthesized = raw.match(/^(.*)\(([A-Za-z]{2})\)\s*$/);
  if (alreadyParenthesized) {
    const city = (alreadyParenthesized[1] || '').trim();
    const province = (alreadyParenthesized[2] || '').toUpperCase();
    if (city && PROVINCE_CODES.has(province)) return `${city} (${province})`;
    return raw;
  }

  const trailingProvince = raw.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  if (trailingProvince) {
    const city = (trailingProvince[1] || '').trim();
    const province = (trailingProvince[2] || '').toUpperCase();
    if (city && PROVINCE_CODES.has(province)) return `${city} (${province})`;
  }

  return raw;
};

const buildSearchUrl = ({ keyword, location }) => {
  const params = new URLSearchParams();
  const trimmedKeyword = (keyword || '').trim();
  const normalizedLocation = normalizeLocationForSearch(location);
  const mergedSearchTerm = [trimmedKeyword, normalizedLocation].filter(Boolean).join(' ');

  if (mergedSearchTerm) params.set('searchstring', mergedSearchTerm);

  const query = params.toString();
  return query ? `${JOB_BANK_BASE_URL}?${query}` : JOB_BANK_BASE_URL;
};

const JobBankSearchPage = () => {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [iframeSrc, setIframeSrc] = useState(JOB_BANK_BASE_URL);
  const [isLoading, setIsLoading] = useState(true);

  const currentUrl = useMemo(
    () => buildSearchUrl({ keyword, location }),
    [keyword, location]
  );

  const runSearch = () => {
    setIsLoading(true);
    setIframeSrc(currentUrl);
  };

  const clearSearch = () => {
    setKeyword('');
    setLocation('');
    setIsLoading(true);
    setIframeSrc(JOB_BANK_BASE_URL);
  };

  return (
    <SpaceBetween size="m">
      <Container>
        <SpaceBetween size="s">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              alignItems: 'end',
            }}
          >
            <FormField
              label="Keyword or job title"
              description="Use a job title, skill, or employer name (for example, Carpenter, bookkeeping, or Acme Corp)."
            >
              <Input
                value={keyword}
                placeholder="Example: Administrative assistant"
                onChange={({ detail }) => setKeyword(detail.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />
            </FormField>
            <FormField
              label="Location"
              description="Best results: include province code, e.g., Ottawa ON or Ottawa (ON)."
            >
              <Input
                value={location}
                placeholder="Example: Winnipeg, MB"
                onChange={({ detail }) => setLocation(detail.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />
            </FormField>
          </div>
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={runSearch}>
              Search Job Bank
            </Button>
            <Button onClick={clearSearch}>Clear</Button>
            <Button iconName="external" onClick={() => window.open(iframeSrc, '_blank', 'noopener,noreferrer')}>
              Open results in new tab
            </Button>
          </SpaceBetween>
          <Box variant="small">
            Source: <Link external href={iframeSrc}>{iframeSrc}</Link>
          </Box>
          <Box variant="small" color="text-body-secondary">
            Note: PATH combines keyword and location into Job Bank search keywords. Use Job Bank filters inside the frame to further refine location.
          </Box>
        </SpaceBetween>
      </Container>

      <Container>
        <div style={{ position: 'relative', minHeight: '70vh' }}>
          {isLoading ? (
            <Box
              color="text-body-secondary"
              style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 1, background: 'var(--color-background-container-content, #fff)' }}
            >
              Loading Job Bank results...
            </Box>
          ) : null}
          <iframe
            key={iframeSrc}
            title="Job Bank search results"
            src={iframeSrc}
            width="100%"
            height="900"
            frameBorder="0"
            style={{ border: '1px solid var(--color-border-container-top, #d5dbdb)', borderRadius: '8px' }}
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </Container>
    </SpaceBetween>
  );
};

export default JobBankSearchPage;
