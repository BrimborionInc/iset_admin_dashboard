CREATE TABLE IF NOT EXISTS iset_runtime_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(32) NOT NULL,
  k VARCHAR(128) NOT NULL,
  v JSON NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_scope_key (scope, k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO iset_runtime_config (scope, k, v)
VALUES (
  'finance',
  'payment.payee_type_options',
  CAST('[
    {
      "code": "ParticipantClient",
      "label": "Participant (Client)",
      "description": "Payment made directly to the client (e.g., living allowance or reimbursement)."
    },
    {
      "code": "AccreditedEducationalTrainingInstitution",
      "label": "Accredited Educational / Training Institution",
      "description": "College, university, or approved training institution delivering the program."
    },
    {
      "code": "EmployerWageSubsidyPartner",
      "label": "Employer (Wage Subsidy Partner)",
      "description": "Employer participating in a wage subsidy or work placement arrangement."
    },
    {
      "code": "ChildcareProvider",
      "label": "Childcare Provider",
      "description": "Licensed or eligible childcare provider supporting the client during training."
    },
    {
      "code": "CommunityNonProfitOrganization",
      "label": "Community / Non-Profit Organization",
      "description": "Community or non-profit organization delivering a project or training activity."
    },
    {
      "code": "TrainingRelatedSupplier",
      "label": "Training-Related Supplier (Books, Equipment, Materials)",
      "description": "Supplier providing required books, materials, equipment, or certification fees."
    },
    {
      "code": "ProfessionalBusinessServicesProvider",
      "label": "Professional / Business Services Provider",
      "description": "Professional service supporting a self-employment activity (e.g., accounting or business training)."
    },
    {
      "code": "StudentLoanServicer",
      "label": "Student Loan Provider / Servicer",
      "description": "Bank, lender, or loan servicing organization receiving repayment on an eligible student loan."
    }
  ]' AS JSON)
)
ON DUPLICATE KEY UPDATE
  v = VALUES(v),
  updated_at = CURRENT_TIMESTAMP;
