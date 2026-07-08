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

    const regionalSheet = workbook.getWorksheet("Test Region");
    expect(regionalSheet.getCell("D6").value).toBe("Approved Applications");
    expect(regionalSheet.getCell("E6").value).toBe("4");
    expect(regionalSheet.getCell("D8").value).toBe("Pending / No Decision");
    expect(regionalSheet.getCell("A11").value).toBe("Funded Clients");
    expect(regionalSheet.getCell("B11").value).toBe("7");
  });
});
