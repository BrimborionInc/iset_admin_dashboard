import React from 'react';
import Alert from '@cloudscape-design/components/alert';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import Button from '@cloudscape-design/components/button';

const tutorialSteps = [
    {
        title: 'Encryption Settings Tutorial',
        content: (
            <div>
                <p>This tutorial will guide you through managing various encryption settings.</p>
                <ol>
                    <li>Use the toggle switches to enable or disable different encryption features.</li>
                    <li>Select the desired encryption protocol for data in transit from the dropdown.</li>
                    <li>Observe the status text to confirm the current encryption settings.</li>
                    <li>Changes will be saved automatically and persist within the application.</li>
                </ol>
            </div>
        ),
    },
    {
        title: 'AES-256 Encryption Tutorial',
        content: (
            <div>
                <p>This tutorial will guide you through understanding and implementing AES-256 encryption.</p>
                <ol>
                    <li>Learn what AES-256 encryption is and how it works.</li>
                    <li>Understand the benefits of using AES-256 encryption for data security.</li>
                    <li>Explore use cases and compliance with security standards.</li>
                </ol>
            </div>
        ),
    },
];

const EncryptionSettingsHelp = ({ section }) => {
    const renderSection = () => {
        switch (section) {
            case 'aes256':
                return (
                    <div>
                        <h1>AES-256 Encryption</h1>
                        <p>AES-256 encryption is used in this application to protect sensitive data stored within the system. It ensures that all data classified as **Protected B** under CCCS Medium is securely encrypted at rest.</p>
                        <h2>Benefits of AES-256 Encryption</h2>
                        <ul>
                            <li><strong>Government-Grade Security:</strong> AES-256 is approved under CCCS Medium and aligns with FIPS 140-2 standards for protecting sensitive but unclassified information.</li>
                            <li><strong>Full Data Coverage:</strong> All database records, logs, and user-generated content stored within this application are encrypted using AES-256.</li>
                            <li><strong>Compliance with CCCS Medium:</strong> AES-256 meets the **Government of Canada’s encryption requirements** for cloud-hosted applications handling Protected B data.</li>
                        </ul>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this web application, AES-256 encryption is automatically applied to:</p>
                        <ul>
                            <li><strong>Database Encryption:</strong> All structured data within AWS RDS and DynamoDB is encrypted at rest.</li>
                            <li><strong>Storage Buckets:</strong> Encrypted S3 buckets are used for file uploads, backups, and archived records.</li>
                            <li><strong>Application Logs:</strong> Security and event logs are encrypted to prevent tampering.</li>
                            <li><strong>API Request & Response Data:</strong> Any API request payload containing sensitive information is encrypted before processing.</li>
                            <li><strong>Session Data:</strong> Temporary session-related data is encrypted at rest to prevent hijacking.</li>
                            <li><strong>Configuration Files:</strong> Sensitive application configurations (e.g., API keys, database credentials) are encrypted at rest.</li>
                            <li><strong>Key Rotation Records:</strong> Any cryptographic key changes and rotations are logged and stored in an encrypted database.</li>
                        </ul>
                        <p>By enabling this setting, all stored data remains encrypted even in the event of unauthorized access to the storage infrastructure.</p>
                    </div>
                );

            case 'envelope':
                return (
                    <div>
                        <h1>Envelope Encryption</h1>
                        <p>Envelope encryption is used to optimize encryption performance while maintaining **strict key security**. In this application, AWS Key Management Service (KMS) generates a **data key** to encrypt application data, and then encrypts that key using a **master key** stored in KMS.</p>
                        <h2>Benefits of Envelope Encryption</h2>
                        <ul>
                            <li><strong>CCCS Medium Compliance:</strong> Ensures encryption key management aligns with the **Government of Canada’s cloud security profile**.</li>
                            <li><strong>Performance Optimization:</strong> Allows large datasets to be encrypted efficiently without impacting application response times.</li>
                            <li><strong>Granular Access Control:</strong> Data encryption keys (DEKs) are rotated and protected by role-based access policies in KMS.</li>
                        </ul>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this web application, Envelope Encryption is applied to:</p>
                        <ul>
                            <li><strong>Database Fields:</strong> Sensitive fields (e.g., personally identifiable information, financial records) are encrypted at the column level using envelope encryption.</li>
                            <li><strong>Session Tokens:</strong> Temporary session data, including authentication tokens and user state, is encrypted to prevent unauthorized access.</li>
                            <li><strong>Inter-Service Communication:</strong> API payloads containing sensitive data are encrypted before transmission between microservices.</li>
                            <li><strong>File Storage:</strong> Documents and media uploads are encrypted before being stored in AWS S3.</li>
                            <li><strong>Backup Archives:</strong> Historical data backups are encrypted using envelope encryption to maintain security over long-term stored data.</li>
                            <li><strong>Logging & Monitoring Data:</strong> Security logs containing audit trails and access records are encrypted to prevent tampering.</li>
                            <li><strong>Application Configuration Secrets:</strong> API keys, database credentials, and environment variables are encrypted at rest.</li>
                        </ul>
                        <p>By enabling this setting, the application ensures that encryption keys are never exposed, reducing the risk of compromise.</p>
                    </div>
                );

            // Add more cases for other sections as needed
            case 'hsm':
                return (
                    <div>
                        <h1>Hardware Security Module (HSM) Usage</h1>
                        <p>A Hardware Security Module (HSM) is a dedicated hardware device designed to securely generate, store, and manage cryptographic keys. It ensures that cryptographic operations are performed in a tamper-resistant environment.</p>
                        <h2>Benefits of HSM Usage</h2>
                        <ul>
                            <li><strong>High Security:</strong> HSMs provide physical and logical protection against key exposure and unauthorized access.</li>
                            <li><strong>Performance:</strong> HSMs accelerate cryptographic operations, reducing the load on software-based encryption.</li>
                            <li><strong>Compliance:</strong> Many HSMs are FIPS 140-2 Level 3 certified, meeting strict regulatory standards.</li>
                        </ul>
                        <h2>Use Cases</h2>
                        <p>HSMs are widely used in security-critical environments, including:</p>
                        <ul>
                            <li><strong>Key Management:</strong> Generating and securely storing cryptographic keys for applications.</li>
                            <li><strong>Digital Signatures:</strong> Securing digital signing processes in financial transactions and legal documents.</li>
                            <li><strong>Certificate Authorities:</strong> Protecting private keys used in Public Key Infrastructure (PKI) environments.</li>
                            <li><strong>Data Encryption:</strong> Encrypting sensitive information such as payment data and identity records.</li>
                        </ul>
                    </div>
                );
            case 'tls':
                return (
                    <div>
                        <h1>TLS Version</h1>
                        <p>Transport Layer Security (TLS) is a cryptographic protocol that secures data in transit over networks. TLS 1.2 and TLS 1.3 are the most widely used versions for securing communications.</p>
                        <h2>Benefits of TLS</h2>
                        <ul>
                            <li><strong>Data Integrity:</strong> Ensures that data remains unchanged during transmission.</li>
                            <li><strong>Authentication:</strong> Uses certificates to verify the identity of the communicating parties.</li>
                            <li><strong>Encryption:</strong> Protects sensitive data from eavesdropping and interception.</li>
                        </ul>
                        <h2>Use Cases</h2>
                        <p>TLS is used in various security-sensitive applications, including:</p>
                        <ul>
                            <li><strong>Web Security:</strong> Encrypting HTTP traffic to enable HTTPS for secure website communication.</li>
                            <li><strong>Email Security:</strong> Securing email transmission through protocols like SMTP, IMAP, and POP3.</li>
                            <li><strong>VPN Security:</strong> Encrypting network traffic in virtual private networks.</li>
                            <li><strong>API Communication:</strong> Ensuring secure connections between microservices and external systems.</li>
                        </ul>
                    </div>
                );
            case 'pfs':
                return (
                    <div>
                        <h1>Perfect Forward Secrecy (PFS)</h1>
                        <p>Perfect Forward Secrecy (PFS) ensures that even if a long-term encryption key is compromised, past encrypted communications cannot be decrypted.</p>
                        <h2>Benefits of PFS</h2>
                        <ul>
                            <li><strong>Session Key Protection:</strong> Uses unique session keys that are not derived from a static private key.</li>
                            <li><strong>Mitigates Key Compromise Risk:</strong> If a private key is exposed, past communications remain secure.</li>
                            <li><strong>Enhanced Security:</strong> Required for strong cryptographic compliance with modern security standards.</li>
                        </ul>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this application, enabling PFS ensures that session keys used for encrypting data in transit are ephemeral and not reusable. This prevents an attacker from decrypting stored network traffic, even if a long-term key is compromised.</p>
                    </div>
                );
            case 'fips':
                return (
                    <div>
                        <h1>FIPS 140-2 Compliance</h1>
                        <p>FIPS 140-2 (Federal Information Processing Standard) is a security standard for cryptographic modules used by the Government of Canada under **CCCS Medium Cloud Security Profile**. This web application ensures compliance by using cryptographic libraries and encryption mechanisms that meet or exceed FIPS 140-2 standards.</p>
                        <h2>Application in Encryption Settings</h2>
                        <p>All cryptographic operations in this application, including **data encryption, key management, and secure communications**, use FIPS 140-2 validated modules where required. This applies to:</p>
                        <ul>
                            <li>Encryption at rest (AES-256 for databases, storage, and logs).</li>
                            <li>Encryption in transit (TLS 1.2+ with strong cipher suites and Perfect Forward Secrecy).</li>
                            <li>Key management (AWS Key Management Service using FIPS 140-2 validated HSMs).</li>
                            <li>API authentication and session security using FIPS-compliant cryptographic algorithms.</li>
                        </ul>
                        <p>By enforcing FIPS 140-2 compliance, this application aligns with **CCCS Medium Cloud Security Profile** requirements, ensuring that cryptographic protections meet the highest security standards.</p>
                    </div>
                );
            case 'certpinning':
                return (
                    <div>
                        <h1>Certificate Pinning</h1>
                        <p>Certificate Pinning strengthens transport security by ensuring that only a specific, pre-approved set of SSL/TLS certificates can be used to establish secure connections. This prevents man-in-the-middle (MITM) attacks by blocking unauthorized or compromised certificate authorities.</p>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this web application, certificate pinning is enforced for:</p>
                        <ul>
                            <li>All HTTPS connections between the frontend, backend, and external APIs.</li>
                            <li>Communication with AWS services (e.g., S3, KMS, RDS) to prevent interception.</li>
                            <li>Client applications (e.g., mobile apps or third-party integrations) to ensure they only trust specific certificates.</li>
                        </ul>
                        <p>By enabling certificate pinning, the application ensures that only trusted certificates are used, reducing the risk of credential interception and unauthorized access.</p>
                    </div>
                );
            case 'multiregion':
                return (
                    <div>
                        <h1>Multi-Region Key Replication</h1>
                        <p>Multi-Region Key Replication enhances **resilience and availability** by ensuring cryptographic keys are securely replicated across AWS regions. This prevents key loss due to regional failures while maintaining compliance with **CCCS Medium Cloud Security Profile** requirements.</p>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this web application, multi-region replication is configured to:</p>
                        <ul>
                            <li>Ensure encryption keys are **automatically synchronized** between primary and secondary AWS regions.</li>
                            <li>Support **disaster recovery** by enabling encrypted data to be decrypted in an alternate region if needed.</li>
                            <li>Maintain **strict access controls**, ensuring that replicated keys adhere to the same security policies as the primary keys.</li>
                        </ul>
                        <p>By enabling Multi-Region Key Replication, the application ensures continuous encryption availability without compromising security, reducing downtime risks while remaining compliant with CCCS Medium cloud security guidelines.</p>
                    </div>
                );
            case 'kmslogging':
                return (
                    <div>
                        <h1>AWS KMS Logging</h1>
                        <p>AWS Key Management Service (KMS) logging is essential for tracking cryptographic key usage, ensuring compliance with **CCCS Medium Cloud Security Profile**. By integrating with AWS CloudTrail, all encryption and decryption activities are recorded in a **tamper-resistant** audit log.</p>
                        <h2>Application in Encryption Settings</h2>
                        <p>In this web application, every key operation—including encryption, decryption, key generation, and rotation—is logged. These logs provide real-time monitoring, enabling **anomaly detection, forensic analysis, and compliance auditing**. The logs also support incident response, helping administrators quickly identify unauthorized key usage or unexpected changes.</p>
                        <p>By enabling AWS KMS Logging, the application maintains **end-to-end traceability** of encryption processes, ensuring that all cryptographic actions align with **government security policies and organizational access controls**.</p>
                    </div>
                );

                default:
                    return (
                      <div>
                        <h1>Encryption Settings Overview</h1>
                        <p>This application enforces encryption policies aligned with the <strong>CCCS Medium Cloud Security Profile</strong>, ensuring that sensitive data is protected both at rest and in transit. The Encryption Settings widget provides configurable security controls for:</p>
            
                        <h2>Data at Rest Protection</h2>
                        <ul>
                            <li><strong>AES-256 Encryption:</strong> Secures all stored data, including databases, file storage, and backups.</li>
                            <li><strong>Envelope Encryption:</strong> Uses AWS KMS to encrypt data keys before encrypting application data.</li>
                            <li><strong>HSM Usage:</strong> Ensures cryptographic keys are generated and managed within FIPS 140-2 validated hardware security modules.</li>
                        </ul>
            
                        <h2>Data in Transit Protection</h2>
                        <ul>
                            <li><strong>TLS Version:</strong> Controls encryption for network traffic, enforcing TLS 1.2 or TLS 1.3.</li>
                            <li><strong>Perfect Forward Secrecy:</strong> Prevents session key reuse, protecting past communications from future key compromise.</li>
                        </ul>
            
                        <h2>Key Management & Compliance</h2>
                        <ul>
                            <li><strong>FIPS 140-2 Compliance:</strong> Enforces encryption standards required for secure government and enterprise environments.</li>
                            <li><strong>Certificate Pinning:</strong> Restricts trusted certificates for API communications to prevent MITM attacks.</li>
                            <li><strong>Multi-Region Key Replication:</strong> Ensures encryption keys are available across multiple AWS regions for resilience and disaster recovery.</li>
                            <li><strong>AWS KMS Logging:</strong> Provides auditable records of all cryptographic operations to detect unauthorized key usage.</li>
                        </ul>
            
                        <p>By configuring these settings, the application maintains <strong>data confidentiality, integrity, and compliance</strong> with security policies.</p>
            
                        <Alert header="Developer Notes">
                            Encryption state changes currently use mock functions. Replace with API integration for production deployment.
                        </Alert>
                      </div>
                    );
            
        }
    };

    return (
        <div>
            {renderSection()}
            <TutorialPanel
                title="Encryption Settings Tutorial"
                description="Learn how to manage various encryption settings."
                tutorials={tutorialSteps}
                learnMoreButton={<Button>Start Tutorial</Button>}
                i18nStrings={{
                    tutorialListTitle: 'Tutorials',
                    tutorialListDescription: 'Follow these steps to learn how to manage encryption settings.',
                    learnMoreButtonText: 'Learn more',
                    startTutorialButtonText: 'Start tutorial',
                    completionScreenTitle: 'Tutorial completed',
                    completionScreenDescription: 'You have successfully completed the tutorial.',
                    feedbackLinkText: 'Provide feedback',
                    dismissButtonText: 'Dismiss',
                }}
            />
        </div>
    );
};

export default EncryptionSettingsHelp;
