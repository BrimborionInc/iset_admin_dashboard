import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ColumnLayout,
  Box,
  StatusIndicator,
  ButtonDropdown,
  Link,
  Icon,
  Alert,
} from "@cloudscape-design/components";
import boardItemI18nStrings from "./common";
import { apiFetch } from "../../../auth/apiClient";

const initialStats = {
  newToday: null,
  awaitingResponse: null,
  averageFirstResponseMinutes: null,
  escalations: null,
};

const ContactMessageInsightsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel, refreshToken = 0 }) => {
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    async function fetchCounts() {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        const fetchCount = async params => {
          const url = `/api/admin/contact-messages?${params.toString()}`;
          const response = await apiFetch(url, { signal: controller.signal });
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(text || `Failed to fetch contact metrics (status ${response.status})`);
          }
          const data = await response.json();
          return Number(data?.total ?? 0);
        };

        const [todayCount, newCount, inProgressCount, escalatedCount] = await Promise.all([
          fetchCount(new URLSearchParams({ pageSize: "1", submittedAfter: todayIso })),
          fetchCount(new URLSearchParams({ pageSize: "1", status: "new" })),
          fetchCount(new URLSearchParams({ pageSize: "1", status: "in-progress" })),
          fetchCount(new URLSearchParams({ pageSize: "1", status: "escalated" })),
        ]);

        if (isCancelled) return;
        setStats({
          newToday: todayCount,
          awaitingResponse: newCount + inProgressCount,
          escalations: escalatedCount,
          averageFirstResponseMinutes: null,
        });
      } catch (err) {
        if (isCancelled || controller.signal.aborted) return;
        console.error("[contact-admin] insights fetch failed", err);
        setStats(initialStats);
        setError(err?.message || "Failed to load insights");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchCounts();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [refreshToken]);

  const metricCards = useMemo(
    () => [
      {
        id: "new-today",
        title: "New today",
        value: stats.newToday,
        description: "Messages received since midnight",
        indicatorType: "info",
      },
      {
        id: "awaiting-response",
        title: "Awaiting response",
        value: stats.awaitingResponse,
        description: "Open items (new + in-progress)",
        indicatorType: Number(stats.awaitingResponse || 0) > 0 ? "warning" : "success",
      },
      {
        id: "first-response",
        title: "Avg first response",
        value:
          stats.averageFirstResponseMinutes != null
            ? `${Math.round(stats.averageFirstResponseMinutes / 60)}h`
            : "—",
        description: "Rolling average (coming soon)",
        indicatorType: "info",
      },
      {
        id: "escalations",
        title: "Flagged / escalated",
        value: stats.escalations,
        description: "Currently escalated",
        indicatorType: Number(stats.escalations || 0) > 0 ? "warning" : "info",
      },
    ],
    [stats]
  );

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Contact message insights",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Link href="/reports/contact-insights" external={false}>
                Analytics
              </Link>
              <Link href="/configuration/events?type=contact_message.received" external={false}>
                Event feed
              </Link>
            </SpaceBetween>
          }
          description="Snapshot of contact message volume and responsiveness."
        >
          Contact insights
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Contact insights settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {error && (
        <Box margin={{ bottom: "s" }}>
          <Alert type="error" header="Unable to load insights" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}
      <ColumnLayout columns={4} variant="text-grid">
        {metricCards.map(card => (
          <Box key={card.id} padding="m" background="bg-container" borderRadius="large">
            <SpaceBetween size="s">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">{card.title}</Box>
                <Box fontSize="display-l" display="flex" alignItems="center" columnGap="s">
                  {loading ? (
                    <StatusIndicator type="loading">Loading…</StatusIndicator>
                  ) : (
                    <>
                      <span>
                        {card.value == null
                          ? "—"
                          : typeof card.value === "number"
                          ? card.value.toLocaleString("en-CA")
                          : card.value}
                      </span>
                      <Icon name="status-info" variant="subtle" ariaLabel="KPI" />
                    </>
                  )}
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                {!loading && <StatusIndicator type={card.indicatorType || "info"} />}
                <Box color="text-body-secondary">{card.description}</Box>
              </SpaceBetween>
            </SpaceBetween>
          </Box>
        ))}
      </ColumnLayout>
    </BoardItem>
  );
};

export default ContactMessageInsightsWidget;
