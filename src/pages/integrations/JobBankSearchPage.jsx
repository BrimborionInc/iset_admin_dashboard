import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  Container,
  FormField,
  Input,
  Link,
  SpaceBetween,
  Tabs,
} from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';

const JOB_BANK_BASE_URL = 'https://www.jobbank.gc.ca/jobsearch/jobsearch';
const JOB_BANK_OCCUPATION_SEARCH_URL = 'https://www.jobbank.gc.ca/trend-analysis/search-occupations';
const NOC_VERSION_CODE = '2021';
const TAB_IDS = {
  FIND_JOB: 'find-job',
  EXPLORE_PROFESSION: 'explore-profession',
};
const PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

const normalizeLocationForSearch = value => {
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

const toOccupationOption = item => {
  const title = String(item?.title || '').trim();
  const code = String(item?.code || '').trim();
  return {
    value: `${title} (${code})`,
    label: title,
    description: `NOC ${code}`,
    title,
    code,
  };
};

const JobBankSearchPage = () => {
  const [activeTabId, setActiveTabId] = useState(TAB_IDS.FIND_JOB);
  const [jobSearch, setJobSearch] = useState({ keyword: '', location: '' });
  const [professionSearch, setProfessionSearch] = useState({
    occupationInput: '',
    selectedOccupation: null,
    location: '',
  });
  const [professionSuggestions, setProfessionSuggestions] = useState([]);
  const [professionSuggestionsLoading, setProfessionSuggestionsLoading] = useState(false);
  const [professionError, setProfessionError] = useState('');
  const [professionLookupLoading, setProfessionLookupLoading] = useState(false);
  const [iframeSrc, setIframeSrc] = useState(JOB_BANK_BASE_URL);
  const [isLoading, setIsLoading] = useState(true);

  const currentSearchUrl = useMemo(
    () => buildSearchUrl(jobSearch),
    [jobSearch]
  );

  const fetchProfessionSuggestions = useCallback(async queryText => {
    const query = (queryText || '').trim();
    if (query.length < 2) {
      setProfessionSuggestions([]);
      return;
    }

    setProfessionSuggestionsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('version', NOC_VERSION_CODE);
      params.set('q', query);
      params.set('limit', '25');
      const response = await apiFetch(`/api/reference/noc-codes?${params.toString()}`, { method: 'GET' });
      if (!response.ok) throw new Error(`Failed to load NOC codes (${response.status})`);
      const data = await response.json();
      const options = Array.isArray(data?.codes)
        ? data.codes
            .filter(item => item?.code && item?.title)
            .map(toOccupationOption)
        : [];
      setProfessionSuggestions(options);
    } catch (error) {
      console.error('Failed to load profession suggestions', error?.message || error);
      setProfessionSuggestions([]);
    } finally {
      setProfessionSuggestionsLoading(false);
    }
  }, []);

  const runSearch = () => {
    setIsLoading(true);
    setIframeSrc(currentSearchUrl);
  };

  const runProfessionSearch = async () => {
    const occupationQuery = professionSearch.selectedOccupation?.title || professionSearch.occupationInput.trim();
    if (!occupationQuery) {
      setProfessionError('Enter or select a profession before exploring it.');
      return;
    }

    setProfessionLookupLoading(true);
    setProfessionError('');
    try {
      const params = new URLSearchParams();
      params.set('query', occupationQuery);
      if (professionSearch.selectedOccupation?.code) {
        params.set('nocCode', professionSearch.selectedOccupation.code);
      }
      if (professionSearch.location.trim()) {
        params.set('location', professionSearch.location.trim());
      }

      const response = await apiFetch(`/api/reference/jobbank-occupation-summary?${params.toString()}`, {
        method: 'GET',
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Failed to resolve occupation summary (${response.status})`);
      }

      if (!payload?.summaryUrl) {
        throw new Error('Job Bank did not return an occupation summary URL.');
      }

      setIsLoading(true);
      setIframeSrc(payload.summaryUrl);
    } catch (error) {
      setProfessionError(error?.message || 'Unable to resolve the Job Bank profession summary.');
    } finally {
      setProfessionLookupLoading(false);
    }
  };

  const clearJobSearch = () => {
    setJobSearch({ keyword: '', location: '' });
    setIsLoading(true);
    setIframeSrc(JOB_BANK_BASE_URL);
  };

  const clearProfessionSearch = () => {
    setProfessionSearch({
      occupationInput: '',
      selectedOccupation: null,
      location: '',
    });
    setProfessionSuggestions([]);
    setProfessionError('');
    setIsLoading(true);
    setIframeSrc(JOB_BANK_OCCUPATION_SEARCH_URL);
  };

  const tabs = [
    {
      id: TAB_IDS.FIND_JOB,
      label: 'Find a Job',
      content: (
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
                value={jobSearch.keyword}
                placeholder="Example: Administrative assistant"
                onChange={({ detail }) =>
                  setJobSearch(current => ({ ...current, keyword: detail.value }))
                }
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
                value={jobSearch.location}
                placeholder="Example: Winnipeg, MB"
                onChange={({ detail }) =>
                  setJobSearch(current => ({ ...current, location: detail.value }))
                }
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
            <Button onClick={clearJobSearch}>Clear</Button>
            <Button iconName="external" onClick={() => window.open(iframeSrc, '_blank', 'noopener,noreferrer')}>
              Open results in new tab
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      ),
    },
    {
      id: TAB_IDS.EXPLORE_PROFESSION,
      label: 'Explore a Profession',
      content: (
        <SpaceBetween size="s">
          {professionError ? (
            <Alert type="error" statusIconAriaLabel="Error">
              {professionError}
            </Alert>
          ) : null}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              alignItems: 'end',
            }}
          >
            <FormField
              label="Profession"
              description="Search 2021 NOC code titles from PATH reference data."
            >
              <Autosuggest
                value={professionSearch.occupationInput}
                onChange={({ detail }) => {
                  const nextValue = detail.value || '';
                  setProfessionSearch(current => ({
                    ...current,
                    occupationInput: nextValue,
                    selectedOccupation:
                      current.selectedOccupation && current.selectedOccupation.value === nextValue
                        ? current.selectedOccupation
                        : null,
                  }));
                  setProfessionError('');
                  if (nextValue.trim().length >= 2) {
                    fetchProfessionSuggestions(nextValue);
                  } else {
                    setProfessionSuggestions([]);
                  }
                }}
                onSelect={({ detail }) => {
                  const selectedOption =
                    professionSuggestions.find(option => option.value === (detail.value || '')) || null;
                  setProfessionSearch(current => ({
                    ...current,
                    occupationInput: detail.value || '',
                    selectedOccupation: selectedOption
                      ? {
                          value: selectedOption.value,
                          title: selectedOption.title,
                          code: selectedOption.code,
                        }
                      : null,
                  }));
                  setProfessionError('');
                }}
                onLoadItems={({ detail }) => {
                  if (detail.filteringText) {
                    fetchProfessionSuggestions(detail.filteringText);
                  }
                }}
                options={professionSuggestions}
                statusType={professionSuggestionsLoading ? 'loading' : 'finished'}
                placeholder="Example: Geoscientists and oceanographers (21102)"
                empty="No 2021 NOC titles found."
                enteredTextLabel={value => `Use "${value}"`}
                filteringType="manual"
                loadingText="Searching professions"
                expandToViewport
              />
            </FormField>
            <FormField
              label="Location"
              description="Leave blank for Canada, or enter a city, province, territory, or postal code."
            >
              <Input
                value={professionSearch.location}
                placeholder="Example: Winnipeg, MB"
                onChange={({ detail }) =>
                  setProfessionSearch(current => ({ ...current, location: detail.value }))
                }
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runProfessionSearch();
                  }
                }}
              />
            </FormField>
          </div>
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" loading={professionLookupLoading} onClick={runProfessionSearch}>
              Explore a Profession
            </Button>
            <Button onClick={clearProfessionSearch}>Clear</Button>
            <Button iconName="external" onClick={() => window.open(iframeSrc, '_blank', 'noopener,noreferrer')}>
              Open results in new tab
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      ),
    },
  ];

  const activeTabNote = activeTabId === TAB_IDS.FIND_JOB
    ? 'Use Find a Job for direct Job Bank posting searches.'
    : 'Explore a Profession resolves the selected PATH profession and location to the matching Job Bank summary page before loading it below.';

  return (
    <SpaceBetween size="m">
      <Container>
        <SpaceBetween size="s">
          <Tabs
            ariaLabel="Job Bank search tools"
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={tabs}
          />
          <Box variant="small">
            Source: <Link external href={iframeSrc}>{iframeSrc}</Link>
          </Box>
          <Box variant="small" color="text-body-secondary">
            Note: {activeTabNote}
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
