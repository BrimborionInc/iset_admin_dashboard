import React from 'react';

const SupportingDocumentsHelp = () => (
  <div>
    <h2>Supporting documents</h2>
    <p>
      This widget is the single place to view, organize, and verify files tied to the applicant. It pulls together
      original application uploads, secure message attachments, and digitally signed forms so you can confirm eligibility
      evidence and track what is still missing.
    </p>

    <h3>How to use this widget</h3>
    <ul>
      <li>
        <strong>Filter the view:</strong> Use the selector to focus on a specific application (application workspace)
        or intervention (case workspace). "All documents" includes client files plus all related records.
      </li>
      <li>
        <strong>Switch tabs:</strong> The <em>Documents</em> tab shows the file list; the <em>Checklist</em> tab shows
        required items and whether each is complete, missing, or in progress.
      </li>
      <li>
        <strong>Refresh:</strong> Use the refresh button after new uploads or signed forms arrive to pull in the latest files.
      </li>
    </ul>

    <h3>Document list columns</h3>
    <ul>
      <li>
        <strong>Document label:</strong> Human-friendly label you can edit inline to make the file easy to recognize.
      </li>
      <li>
        <strong>File Name:</strong> Original filename as uploaded or generated.
      </li>
      <li>
        <strong>Application / Case:</strong> Shows the application reference or case number. Intervention documents
        appear as "Intervention: {name}" in the case workspace.
      </li>
      <li>
        <strong>Source:</strong> Where the file came from. Common values are Application submission, Message attachment,
        Digitally signed, and Manual upload.
      </li>
      <li>
        <strong>Scope:</strong> Client documents apply to all applications; Application documents apply to a specific
        application or intervention.
      </li>
      <li>
        <strong>Uploaded:</strong> Date the file was added to the system.
      </li>
      <li>
        <strong>Actions:</strong> Edit metadata, duplicate to another application or intervention (when available),
        view the file, or delete it.
      </li>
      <li>
        <strong>Preferences:</strong> Use table preferences and column resizing to customize the view.
      </li>
    </ul>

    <h3>Uploading and managing documents</h3>
    <ul>
      <li>
        <strong>Upload:</strong> Choose a label and document type, then attach it to an application or intervention.
        Client-scoped documents do not need an attachment and are reusable across applications.
      </li>
      <li>
        <strong>Duplicate:</strong> Use this to reuse the same file across applications or interventions. The option
        appears only when duplication is possible (for example, when the applicant has multiple applications).
      </li>
      <li>
        <strong>Delete:</strong> Deleting requires typing <code>delete</code>. Use it only when the file should no longer
        be part of the official record.
      </li>
    </ul>

    <h3>Checklist tips</h3>
    <ul>
      <li>
        Checklist status updates based on document type and attachment. If a document is not counting, confirm it is
        tagged with the correct document type and attached to the right application or intervention.
      </li>
      <li>
        In the case workspace, select an intervention to view its checklist.
      </li>
    </ul>

    <h3>Troubleshooting</h3>
    <ul>
      <li>
        <strong>Unavailable:</strong> The file link is missing. Ask the applicant to re-upload or contact support.
      </li>
      <li>
        <strong>Expired download:</strong> Refresh the page to get a new secure download link.
      </li>
    </ul>
  </div>
);

SupportingDocumentsHelp.aiContext = `
You are assisting an ISET program staff member using the Supporting Documents widget. Explain how to filter by application
or intervention, interpret the Documents and Checklist tabs, and what each column means. Clarify sources (application
submission, message attachment, digitally signed, manual upload), scope (client vs application), and how to upload,
edit, duplicate, view, or delete documents. Note that duplicate only appears when reuse is possible and delete requires
typing "delete". Mention column preferences and resizing. Offer troubleshooting for missing checklist counts and unavailable files.
`;

export default SupportingDocumentsHelp;
