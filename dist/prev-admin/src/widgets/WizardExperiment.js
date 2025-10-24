import React, { useState } from 'react';
import { Wizard, Container, Header, SpaceBetween, FormField, Input, Link, Button, KeyValuePairs } from '@cloudscape-design/components';

const WizardExperiment = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    return (
        <Wizard
            i18nStrings={{
                stepNumberLabel: stepNumber => `Step ${stepNumber}`,
                collapsedStepsLabel: (stepNumber, stepsCount) => `Step ${stepNumber} of ${stepsCount}`,
                skipToButtonLabel: (step, stepNumber) => `Skip to ${step.title}`,
                navigationAriaLabel: 'Steps',
                cancelButton: 'Cancel',
                previousButton: 'Previous',
                nextButton: 'Next',
                submitButton: 'Submit',
                optional: 'optional',
            }}
            onNavigate={({ detail }) => setActiveStepIndex(detail.requestedStepIndex)}
            activeStepIndex={activeStepIndex}
            submitButtonText="Launch instance"
            allowSkipTo
            steps={[
                {
                    title: 'Choose instance type',
                    info: <Link variant="info">Info</Link>,
                    description: 'Each instance type includes one or more instance sizes, allowing you to scale your resources to the requirements of your target workload.',
                    content: (
                        <Container header={<Header variant="h2">Form container header</Header>}>
                            <SpaceBetween direction="vertical" size="l">
                                <FormField label="First field">
                                    <Input />
                                </FormField>
                                <FormField label="Second field">
                                    <Input />
                                </FormField>
                            </SpaceBetween>
                        </Container>
                    ),
                },
                {
                    title: 'Add storage',
                    content: (
                        <Container header={<Header variant="h2">Form container header</Header>}>
                            <SpaceBetween direction="vertical" size="l">
                                <FormField label="First field">
                                    <Input />
                                </FormField>
                                <FormField label="Second field">
                                    <Input />
                                </FormField>
                            </SpaceBetween>
                        </Container>
                    ),
                    isOptional: true,
                },
                {
                    title: 'Configure security group',
                    content: (
                        <Container header={<Header variant="h2">Form container header</Header>}>
                            <SpaceBetween direction="vertical" size="l">
                                <FormField label="First field">
                                    <Input />
                                </FormField>
                                <FormField label="Second field">
                                    <Input />
                                </FormField>
                            </SpaceBetween>
                        </Container>
                    ),
                    isOptional: true,
                },
                {
                    title: 'Review and launch',
                    content: (
                        <SpaceBetween size="xs">
                            <Header variant="h3" actions={<Button onClick={() => setActiveStepIndex(0)}>Edit</Button>}>
                                Step 1: Instance type
                            </Header>
                            <Container header={<Header variant="h2">Container title</Header>}>
                                <KeyValuePairs
                                    columns={2}
                                    items={[
                                        { label: 'First field', value: 'Value' },
                                        { label: 'Second Field', value: 'Value' },
                                    ]}
                                />
                            </Container>
                        </SpaceBetween>
                    ),
                },
            ]}
        />
    );
};

export default WizardExperiment;
