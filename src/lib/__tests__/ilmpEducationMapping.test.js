const fs = require("fs");
const path = require("path");

const { normaliseIlmpEducationLevelCode } = require("../ilmpEducationMapping");

describe("ilmpEducationMapping", () => {
  test("maps every current intake highest-education option to an ILMP code", () => {
    expect(normaliseIlmpEducationLevelCode("no_formal_education")).toBe("1");
    expect(normaliseIlmpEducationLevelCode("grade_7_8")).toBe("2");
    expect(normaliseIlmpEducationLevelCode("grade_9_10")).toBe("3");
    expect(normaliseIlmpEducationLevelCode("grade_11_12")).toBe("4");
    expect(normaliseIlmpEducationLevelCode("secondary_school_diploma_or_ged")).toBe("5");
    expect(normaliseIlmpEducationLevelCode("post_secondary_training")).toBe("6");
    expect(normaliseIlmpEducationLevelCode("apprenticeship_trades")).toBe("7");
    expect(normaliseIlmpEducationLevelCode("cegep")).toBe("8");
    expect(normaliseIlmpEducationLevelCode("college")).toBe("8");
    expect(normaliseIlmpEducationLevelCode("university_certificate")).toBe("9");
    expect(normaliseIlmpEducationLevelCode("bachelors_degree")).toBe("10");
    expect(normaliseIlmpEducationLevelCode("masters_degree")).toBe("11");
    expect(normaliseIlmpEducationLevelCode("doctorate")).toBe("12");
  });

  test("maps transformed display labels used by reporting sync", () => {
    expect(normaliseIlmpEducationLevelCode("Up to Grade 7-8 (Secondaire I-II)")).toBe("2");
    expect(normaliseIlmpEducationLevelCode("Up to Grade 7–8 (Secondaire I–II)")).toBe("2");
    expect(normaliseIlmpEducationLevelCode("University - Bachelor Degree")).toBe("10");
    expect(normaliseIlmpEducationLevelCode("University – Bachelor Degree")).toBe("10");
    expect(normaliseIlmpEducationLevelCode("Bachelor's degree")).toBe("10");
  });

  test("server denied-reporting mapper delegates to the shared education normalizer", () => {
    const serverSource = fs.readFileSync(
      path.join(__dirname, "../../..", "isetadminserver.js"),
      "utf8"
    );
    const start = serverSource.indexOf("function mapEducationLevelToIlmpCode");
    const end = serverSource.indexOf("function mapProvinceToIlmpCode", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const helper = serverSource.slice(start, end);
    expect(helper).toContain("return normaliseIlmpEducationLevelCode(value);");
  });
});
