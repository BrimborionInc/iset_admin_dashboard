import ExcelJS from "exceljs";
import { buildRegionalSnapshotWorkbook } from "../regionalSnapshotExport";

const loadWorkbook = async buffer => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
};

describe("regionalSnapshotExport", () => {
  it("separates application activity from approved-funding funded-client metrics", async () => {
    const workbook = await loadWorkbook(await buildRegionalSnapshotWorkbook({
      includeSummary: true,
      subtitle: "Reporting Period: 2026-04-01 - 2027-03-31",
      reports: [
        {
          region: { name: "Test Region", code: "TR" },
          period: { start: "2026-04-01", end: "2027-03-31" },
          liveMetrics: {
            applicationsReceived: 10,
            funded: 4,
            fundedApplications: 4,
            deniedIneligibleWithdrawn: 2,
            pendingDecision: 4,
            fundedClients: 7,
          },
          fundingMetrics: {
            fundedClientCount: 7,
            crfFundingAmount: 1200,
            eiFundingAmount: 300,
          },
          derivedMetrics: {
            totalFunding: 1500,
            totalAdminCost: 150,
            clientAverageAmountFunded: 1500 / 7,
            adminCostPerClient: 150 / 7,
            adminRatioPercent: 10,
          },
          snapshot: {
            regionalManagerName: "Manager",
            regionalCoordinatorName: "Coordinator",
            coordinatorSalaryAmount: 100,
            operatingCostsAmount: 50,
            complianceFlag: "Ready",
          },
          dataQualityIssues: [
            {
              region: "TR",
              applicationReference: "APP-1",
              caseReference: "CASE-1",
              interventionReference: "Intervention 11",
              issueType: "unknown_funding_source",
              reportingEffect: "Included the approved amount in CRF by default.",
              remediation: "Assign the approved line to CRF or EI.",
            },
          ],
        },
      ],
    }));

    const summary = workbook.getWorksheet("Summary");
    expect(summary.getCell("F4").value).toBe("Approved Applications");
    expect(summary.getCell("I4").value).toBe("Funded Clients");
    expect(summary.getCell("F5").value).toBe(4);
    expect(summary.getCell("I5").value).toBe(7);
    expect(summary.getCell("P6").value).toEqual({ formula: 'IF(I6=0,"",L6/I6)' });
    expect(summary.getCell("Q6").value).toEqual({ formula: 'IF(I6=0,"",O6/I6)' });
    expect(summary.getCell("R6").value).toEqual({ formula: 'IF(L6=0,"",O6/L6)' });
    expect(summary.getCell("A9").value).toBe("Data Quality Issues");
    expect(summary.getCell("E10").value).toBe("Issue Type");
    expect(summary.getCell("A11").value).toBe("TR");
    expect(summary.getCell("E11").value).toBe("unknown funding source");

    const regionalSheet = workbook.getWorksheet("Test Region");
    expect(regionalSheet.getCell("D6").value).toBe("Approved Applications");
    expect(regionalSheet.getCell("E6").value).toBe("4");
    expect(regionalSheet.getCell("D8").value).toBe("Pending / No Decision");
    expect(regionalSheet.getCell("A11").value).toBe("Funded Clients");
    expect(regionalSheet.getCell("B11").value).toBe("7");
  });

  it("leaves the client average blank when there are no funded clients", async () => {
    const workbook = await loadWorkbook(await buildRegionalSnapshotWorkbook({
      includeSummary: true,
      reports: [
        {
          region: { name: "No Funding", code: "NF" },
          liveMetrics: {},
          fundingMetrics: { fundedClientCount: 0, crfFundingAmount: 0, eiFundingAmount: 0 },
          derivedMetrics: { totalFunding: 0, clientAverageAmountFunded: null },
          snapshot: {},
        },
      ],
    }));

    expect(workbook.getWorksheet("Summary").getCell("P5").value).toBeNull();
    expect(workbook.getWorksheet("Summary").getCell("A9").value).toBe("Data Quality Issues");
    expect(workbook.getWorksheet("Summary").getCell("A11").value).toBe(
      "No data quality issues identified for this reporting period."
    );
    expect(workbook.getWorksheet("No Funding").getCell("B16").value).toBe("—");
  });
});
