import React from 'react';

const SupportingDocumentsHelp = () => (
  <div>
    <h2>Supporting documents</h2>
    <p>
      This widget is the single place to view, organize, and verify documents tied to the current file. In normal
      intake/application workflows it combines applicant uploads, secure message attachments, and signed forms. In
      imported or application-less client files it works as a case-based document library for the client, case, action
      plans, plus documents linked to interventions.
    </p>

    <h3>How to use this widget</h3>
    <ul>
      <li>
        <strong>Filter the view:</strong> Use the selector to focus on a specific application (application workspace)
        or to narrow the case view to documents relevant to a selected intervention (case workspace). "All documents"
        includes the full file for that workspace.
      </li>
      <li>
        <strong>Switch tabs:</strong> The <em>Documents</em> tab shows the file list; the <em>Checklist</em> tab shows
        required items and whether each is complete, missing, or in progress. Imported or application-less client files
        do not show the checklist tab because there is no linked application checklist to drive yet, even if the
        client already has a PATH account.
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
        <strong>Uploaded:</strong> Date and time the file was added to the system. This is the second column by default,
        and you can sort newest-to-oldest or oldest-to-newest from the table header.
      </li>
      <li>
        <strong>File Name:</strong> Original filename as uploaded or generated.
      </li>
      <li>
        <strong>Source:</strong> Where the file came from. Common values are Applicant upload, Secure message
        attachment, Signed form, Staff upload, and PATH generated.
      </li>
      <li>
        <strong>Application / Case:</strong> Shows the application reference or case number. Intervention documents
        appear as "Intervention: (name)" in the case workspace when the document is linked to that intervention.
      </li>
      <li>
        <strong>Scope:</strong> Client documents apply across the client file. Application documents belong to a
        specific application when one exists. Action-plan documents can also be linked to interventions.
      </li>
      <li>
        <strong>Actions:</strong> Edit metadata, duplicate to another application or intervention (when available),
        view the file, or delete it.
      </li>
      <li>
        <strong>Preferences:</strong> Use table preferences, column sorting, and column resizing to customize the view.
      </li>
    </ul>

    <h3>Uploading and managing documents</h3>
    <ul>
      <li>
        <strong>Upload:</strong> Choose a label and document type, then attach the file to the correct record. Use
        <strong>Case header &gt; Upload existing documents</strong> when adding historical files to a client file.
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
        tagged with the correct document type and attached to the right application or action plan.
      </li>
      <li>
        In the case workspace, select an intervention to view its checklist when the case has a linked application.
      </li>
    </ul>

    <h3>Troubleshooting</h3>
    <ul>
      <li>
        <strong>No checklist tab:</strong> Imported or application-less client files use case-based documents and do not
        currently participate in applicant checklist workflow. This remains true even when the imported client has a
        linked PATH account but no historical application.
      </li>
      <li>
        <strong>Silent uploads:</strong> For imported/application-less client files, uploads here are casework backload
        actions. They do not trigger applicant notifications, approval routing, or checklist completion, even when the
        document type would normally belong to an application.
      </li>
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
or by documents relevant to an intervention, interpret the Documents and Checklist tabs, and what each column means.
Clarify sources (applicant upload, secure message attachment, signed form, staff upload, PATH generated), scope (client,
application, case, and action plan), and how to upload, edit, duplicate, view, or delete documents. Note that duplicate
only appears when reuse is possible and delete requires typing "delete". Mention that the document list columns are
sortable, with Uploaded shown near the front by default, and that column preferences and resizing are available.
For historical client-file documents, keep the guidance practical: use \`Case header > Upload existing documents\`,
choose the label and document type, and attach the file to the correct client, case, or action-plan record. Avoid
implementation explanations unless the staff member specifically asks for them. Offer troubleshooting for missing checklist
counts and unavailable files.
`;

export default SupportingDocumentsHelp;
