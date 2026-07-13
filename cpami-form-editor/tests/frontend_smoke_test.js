"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const appPath = path.join(projectRoot, "web", "app.js");
const codebookPath = path.join(projectRoot, "web", "codebook.json");

let source = fs.readFileSync(appPath, "utf8");
source = source.slice(0, source.indexOf('$("#loadDataButton")'));
source += `\nglobalThis.__test = {
  TABLE_CONFIG, state, optionsFor, allFields, sampleRowsFor,
  buildSampleCsv, buildSampleXml, parseDelimited, guessTarget, codeSpecFor, CODE_OPTIONS,
  COPY_CURRENT_TO_OLD, copyMappedValues, sortOptionsByName, leadingChineseNumber,
  fieldDefinition, renderField, renderBulkControl
};`;

const context = {
  console,
  Blob,
  TextDecoder,
  URL,
  window: { setTimeout, clearTimeout },
  document: { querySelector: () => null, querySelectorAll: () => [] },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: appPath });

const app = context.__test;
const codebook = JSON.parse(fs.readFileSync(codebookPath, "utf8"));
app.state.codebook = codebook;
app.state.tables = { BMSBASE: [{ BMPAS: "I80" }] };

assert.equal(codebook.version, 2);
assert.equal(codebook.source.bldcodeRows, 22383);
assert.equal(codebook.officialSections.length, 1626);
assert.equal(new Set(codebook.officialSections.map((row) => row.district)).size, 29);

const districts = app.optionsFor("BMSLAN", "DIST", {});
assert.equal(districts.length, 29);
assert(districts.some(([value, label]) => value === "436" && label.includes("清水區")));

const qingshuiSections = app.optionsFor("BMSLAN", "SECTION", { DIST: "436" });
assert.equal(qingshuiSections.length, 64);
assert(qingshuiSections.some(([value, label]) => value === "4662" && label === "福安段"));

const chineseNumberOptions = app.sortOptionsByName([
  ["10", "十號"], ["2", "二號"], ["1", "一號"], ["20", "二十號"], ["3", "三號"],
]);
assert.deepEqual(Array.from(chineseNumberOptions, (option) => option[0]), ["1", "2", "3", "10", "20"]);
assert.equal(app.leadingChineseNumber("壹佰零貳號").value, 102);
assert.equal(app.leadingChineseNumber("甲二號"), null, "Chinese text before a number must use normal stroke sorting");
assert.deepEqual(Array.from(app.sortOptionsByName([["001", "Beta"], ["999", "Alpha"]]), (option) => option[1]), ["Alpha", "Beta"], "Option labels, not codes, are the primary sort key");

const landRecord = {
  DIST: "436", SECTION: "", ROAD_NO1: "875", ROAD_NO2: "1", TOT_AREA: "600.5", USE_AREA: "",
  USE_CATEGORY_CODE1: "0140", USE_CATEGORY_CODE2: "",
  DIST_OLD: "old", SECTION_OLD: "old", ROAD_NO1_OLD: "old", ROAD_NO2_OLD: "old",
  TOT_AREA_OLD: "old", USE_AREA_OLD: "old", USE_CATEGORY_CODE1_OLD: "old", USE_CATEGORY_CODE2_OLD: "old",
};
app.copyMappedValues(landRecord, app.COPY_CURRENT_TO_OLD.BMSLAN);
assert.equal(landRecord.DIST_OLD, "436");
assert.equal(landRecord.SECTION_OLD, "", "Blank current parcel values must overwrite old values with blank");
assert.equal(landRecord.ROAD_NO1_OLD, "875");
assert.equal(landRecord.USE_AREA_OLD, "");

const stairRecord = {
  BUILDING_NO: "A", STORY_CODE: "U0010", USAGE_CODE1: "H2", USAGE_CODE1_DESC: "住宅", USAGE_CODE1_T: "H2",
  USAGE_CODE2: "", USAGE_CODE2_DESC: "", USAGE_CODE2_T: "", USAGE_CODE3: "00", USAGE_CODE3_DESC: "樓梯間", USAGE_CODE3_T: "其他",
  STORY_AREA: "500", STORY_HEIGHT: "3.6", VERANDA_AREA: "20", TERRACE_AREA: "",
  BUILDING_NO_OLD: "old", STORY_CODE_OLD: "old", USAGE_CODE2_OLD: "old", TERRACE_AREA_OLD: "old",
};
app.copyMappedValues(stairRecord, app.COPY_CURRENT_TO_OLD.BMSSTAIR);
assert.equal(stairRecord.STORY_CODE_OLD, "U0010");
assert.equal(stairRecord.USAGE_CODE1_DESC_OLD, "住宅");
assert.equal(stairRecord.USAGE_CODE1_OLD_T, "H2");
assert.equal(stairRecord.USAGE_CODE2_OLD, "");
assert.equal(stairRecord.TERRACE_AREA_OLD, "");

const districtField = app.fieldDefinition("BMSLAN", "DIST");
const districtMarkup = app.renderField(districtField, { DIST: "436" }, "BMSLAN");
assert(districtMarkup.includes("data-open-picker"));
assert(!districtMarkup.includes("<datalist"));
const bulkMarkup = app.renderBulkControl("BMSLAN", districtField, { DIST: "436" }, 0, 0);
assert(bulkMarkup.includes("data-open-bulk-picker"));
assert(!bulkMarkup.includes("<datalist"));
assert.equal(app.TABLE_CONFIG.BMSLAN.sections.find((section) => section.copyCurrent)?.copyCurrent, "BMSLAN");
assert.equal(app.TABLE_CONFIG.BMSSTAIR.sections.find((section) => section.copyCurrent)?.copyCurrent, "BMSSTAIR");

const unmappedCodeFields = [];
for (const table of Object.keys(app.TABLE_CONFIG)) {
  for (const field of app.allFields(table).filter((item) => item.kind === "code")) {
    const hasFallback = Boolean(app.CODE_OPTIONS[`${table}.${field.name}`]);
    if (!app.codeSpecFor(table, field.name) && !hasFallback) unmappedCodeFields.push(`${table}.${field.name}`);
  }
}
assert.deepEqual(unmappedCodeFields, [], `Code fields without a legacy code type: ${unmappedCodeFields.join(", ")}`);

for (const table of Object.keys(app.TABLE_CONFIG)) {
  const csv = app.buildSampleCsv(table);
  assert(csv.startsWith("\uFEFF"), `${table} sample CSV must include a UTF-8 BOM`);
  assert(csv.includes("\r\n"), `${table} sample CSV must use CRLF`);
  const parsed = app.parseDelimited(csv.replace(/^\uFEFF/, ""));
  const expectedFields = app.allFields(table).map((field) => field.name);
  assert.deepEqual(Array.from(parsed.headers), Array.from(expectedFields), `${table} CSV headers`);
  assert.equal(parsed.records.length, app.sampleRowsFor(table).length, `${table} CSV sample row count`);
  for (const header of parsed.headers) {
    assert.equal(app.guessTarget(table, header), header, `${table}.${header} must map automatically`);
  }

  const xml = app.buildSampleXml(table);
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert(xml.includes(`<CPAMIImport table="${table}">`));
  assert.equal((xml.match(new RegExp(`<${table}>`, "g")) || []).length, app.sampleRowsFor(table).length);
}

console.log(`Frontend smoke test passed: ${Object.keys(app.TABLE_CONFIG).length} table groups, ${districts.length} Taichung districts, ${qingshuiSections.length} Qingshui sections.`);
