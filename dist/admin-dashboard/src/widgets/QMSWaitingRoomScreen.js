import React, { useEffect, useState } from 'react';
import {
    Header,
    ButtonDropdown,
    Link,
    Box,
    SpaceBetween,
    Container,
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import axios from 'axios';

const QMSWaitingRoomScreen = ({ toggleHelpPanel, refreshTrigger }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [nowServing, setNowServing] = useState([]);
    const [comingUp, setComingUp] = useState([]);
    const [averageWaitMinutes, setAverageWaitMinutes] = useState(null);
    const [averageServiceMinutes, setAverageServiceMinutes] = useState(null);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
      .qms-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        font-family: Arial, sans-serif;
        background-color: #f3f4f6;
        color: #333;
      }
      .qms-header {
        background-color: #005ea5 !important;
        color: white !important;
        padding: 10px;
        text-align: center;
        font-size: 28px !important;
        font-weight: bold !important;
        position: relative;
      }
      .qms-clock {
        position: absolute;
        top: 10px;
        right: 20px;
        font-size: 18px;
        font-weight: normal;
        color: white;
      }
      .qms-main {
        display: flex;
        gap: 20px;
        padding: 20px;
      }
      .qms-left {
        flex: 3;
        background: white;
        padding: 20px;
        border-radius: 8px;
        font-size: 3.5em;
        line-height: 1.3;
      }
      .qms-sidebar {
        flex: 1;
        background: #dfe6f0;
        padding: 20px;
        border-radius: 8px;
        font-size: 1em;
      }
      .qms-title {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .qms-highlight {
        font-size: 40px;
        font-weight: bold;
        line-height: 1.3em;
        color: #005ea5;
      }
      .qms-highlight-small {
        font-weight: bold;
        color: #005ea5;
      }
      .qms-subsection {
        margin-bottom: 20px;
      }
    `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/queue/waiting-room?locationId=1`)
            .then((res) => {
                setNowServing(res.data.nowServing || []);
                setComingUp(res.data.comingUp || []);
                setAverageWaitMinutes(res.data.averageWaitMinutes || 0);
                setAverageServiceMinutes(res.data.averageServiceMinutes || 0);
            })
            .catch((err) => {
                console.error('Error loading waiting room data:', err);
            });
    }, [refreshTrigger]); // Trigger data reload when refreshTrigger changes

    const formattedTime = new Intl.DateTimeFormat('en-CA', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(currentTime);

    return (
        <BoardItem
            header={
                <Header
                    description="Display information for the waiting room."
                    info={
                        <Link
                            variant="info"
                            onFollow={() => toggleHelpPanel(null, 'Waiting Room Screen Help')}
                        >
                            Info
                        </Link>
                    }
                >
                    Waiting Room Screen
                </Header>
            }
            i18nStrings={{
                dragHandleAriaLabel: 'Drag handle',
                dragHandleAriaDescription:
                    'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
                resizeHandleAriaLabel: 'Resize handle',
                resizeHandleAriaDescription:
                    'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
            }}
            settings={
                <ButtonDropdown
                    items={[{ id: 'remove', text: 'Remove' }]}
                    ariaLabel="Board item settings"
                    variant="icon"
                />
            }
        >
            <Box className="qms-container">
                <Box className="qms-header">
                    Visa Application Centre - Queue Information
                    <span className="qms-clock">{formattedTime}</span>
                </Box>
                <Box className="qms-main">
                    <Box className="qms-left">
                        <Box className="qms-subsection">
                            <div className="qms-title">Now Serving</div>
                            {nowServing.length > 0 ? (
                                nowServing.map((entry, idx) => (
                                    <div key={idx} className="qms-highlight">
                                        {entry.ticket} - {entry.counter}
                                    </div>
                                ))
                            ) : (
                                <div>No tickets currently being served.</div>
                            )}
                        </Box>
                        <Box className="qms-subsection">
                            <div className="qms-title">Coming Up</div>
                            <div>{comingUp.length > 0 ? comingUp.join(', ') : 'No upcoming tickets.'}</div>
                        </Box>
                    </Box>
                    <Box className="qms-sidebar">
                        <Box className="qms-subsection">
                            <div className="qms-title">Average Wait Times</div>
                            <div>Appointments: {averageWaitMinutes ?? '-'} minutes</div>
                            <div>Walk-ins: 30 minutes</div>
                        </Box>
                        <Box className="qms-subsection">
                            <div className="qms-title">Walk-in Availability</div>
                            <div>Next Available Slot: 1:15 PM</div>
                            <div className="qms-highlight-small">Slots Available: Yes</div>
                        </Box>
                        <Box className="qms-subsection">
                            <div className="qms-title">Average Service Times</div>
                            <div>All Services: {averageServiceMinutes ?? '-'} minutes</div>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </BoardItem>
    );
};

export default QMSWaitingRoomScreen;
