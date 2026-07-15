"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const appPath = path.join(projectRoot, "web", "app.js");
const codebookPath = path.join(projectRoot, "web", "codebook.json");
const indexPath = path.join(projectRoot, "web", "index.html");
const stylesPath = path.join(projectRoot, "web", "styles.css");
const schemaPath = path.join(projectRoot, "schema", "data_txt_schema.json");
const extensionSchemaPath = path.join(projectRoot, "schema", "case_extension_schema.json");

let source = fs.readFileSync(appPath, "utf8");
source = source.slice(0, source.indexOf('$("#loadDataButton")'));
source += `\nglobalThis.__test = {
  TABLE_CONFIG, FORM_SETS, state, activeTables, formCatalogForSet, optionsFor, allFields, sampleRowsFor,
  buildSampleCsv, buildSampleXml, parseDelimited, guessTarget, codeSpecFor, CODE_OPTIONS,
  COPY_CURRENT_TO_OLD, copyMappedValues, sortOptionsByName, leadingChineseNumber,
  fieldDefinition, renderField, renderBulkControl, bulkColumnClass, sectionStartsOpen,
  useModalForOptions, renderInlineOptionMarkup, clearTableData, isDialogBackdropClick,
  fieldOrderFor, tableMetaFor, standardTablesPayload, extraTablesPayload, mergeCaseTables,
  hasExtraData, caseEnvelope, caseNewBlank, visibleSections, visibleFields
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
const index = fs.readFileSync(indexPath, "utf8");
const styles = fs.readFileSync(stylesPath, "utf8");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const extensionSchema = JSON.parse(fs.readFileSync(extensionSchemaPath, "utf8"));
app.state.codebook = codebook;
app.state.tables = { BMSBASE: [{ BMPAS: "I80" }] };

assert.equal(app.state.schemaVersion, null);
assert.equal(app.state.formSet, "A");
assert.deepEqual(Object.keys(app.FORM_SETS), ["A", "B", "C", "D"]);
assert.deepEqual(Array.from(app.FORM_SETS.A.tables), ["BMSBASE", "BMSLAN", "BMSLANOWNER", "BMSMEMO", "BMSP01", "BMSP02", "BMSP03", "BMSP04", "BMSPARK", "BMSSTAIR", "BMSWORK"]);
assert.deepEqual(Array.from(app.FORM_SETS.B.tables), ["BMSBASE", "BMSLAN", "BMSMEMO", "BMSP01", "BMSP03", "BMSP04", "BMSSC", "BMSSCRP", "BMSROAD", "BMSCHK", "RPTPHOTO", "BM_TEC"]);
assert.deepEqual(Array.from(app.FORM_SETS.C.tables), ["BMSBASE", "BMSLAN", "BMSMEMO", "BMSP01", "BMSP02", "BMSP03", "BMSP04", "BMSPARK", "BMSSTAIR", "C21_3", "BMELVTR"]);
assert.deepEqual(Array.from(app.FORM_SETS.D.tables), ["BMSBASE", "BMSLAN", "BMSLANOWNER", "BMSMEMO", "BMSP01", "BMSP03", "BMSP04", "BMSROAD", "BM_TEC"]);
assert.equal(new Set(Object.values(app.FORM_SETS).flatMap(({ tables }) => tables)).size, Object.keys(app.TABLE_CONFIG).length);
assert.strictEqual(app.activeTables(), app.state.tables, "activeTables must expose the current case tables");

app.state.formSet = "A";
assert(!app.visibleSections("BMSBASE").some(({ section }) => section.formSets?.includes("B")), "B-only BMSBASE sections must stay hidden in A");
const aBaseFieldCount = app.visibleFields("BMSBASE").length;
app.state.formSet = "B";
assert(app.visibleSections("BMSBASE").some(({ section }) => section.formSets?.includes("B")), "B-only BMSBASE sections must be visible in B");
assert(app.visibleFields("BMSBASE").length > aBaseFieldCount, "B should add fields without changing the A field set");
app.state.formSet = "C";
assert(app.visibleSections("BMSBASE").some(({ section }) => section.formSets?.includes("C")), "C-only BMSBASE sections must be visible in C");
app.state.formSet = "D";
assert(app.visibleSections("BMSBASE").some(({ section }) => section.formSets?.includes("D")), "D-only BMSBASE sections must be visible in D");
app.state.formSet = "A";
assert(source.includes("state.schemaVersion = data.schemaVersion"));
assert(source.includes('data.initialCase === "blank"'));
assert(source.includes("已建立空白案件，可以開始填寫或主動載入既有資料"));
assert.equal(
  source.split("JSON.stringify(caseEnvelope())").length - 1,
  2,
  "Validate and export must both send the versioned case envelope",
);
assert(source.includes("formSet: state.formSet") && source.includes("tables: standardTablesPayload()") && source.includes("extraTables: extraTablesPayload()"), "The case envelope must separate data.txt and extension tables");
assert.equal(schema.schemaVersion, extensionSchema.schemaVersion);
assert.equal(extensionSchema.extraTableOrder.length, 6);
assert.equal(Object.values(extensionSchema.extraFieldOrder).reduce((sum, fields) => sum + fields.length, 0), 110);

app.state.bootstrap = {
  tableOrder: schema.tableOrder,
  fieldOrder: schema.fieldOrder,
  tableMeta: schema.tableMeta,
  extraTableOrder: extensionSchema.extraTableOrder,
  extraFieldOrder: extensionSchema.extraFieldOrder,
  extraTableMeta: extensionSchema.extraTableMeta,
};
app.caseNewBlank("空白案件");
assert.equal(app.state.sourceName, "空白案件");
assert.equal(app.state.tables.BMSBASE.length, 1, "A blank case must be immediately editable");
assert.equal(app.state.tables.BMSBASE[0].LAST_MODIFY, "00001");
for (const table of [...schema.tableOrder, ...extensionSchema.extraTableOrder]) {
  if (table !== "BMSBASE") assert.equal(app.state.tables[table].length, 0, `${table} must start empty`);
}
app.state.tables.BMSBASE[0].BMPAS = "I80";

assert.equal(codebook.version, 2);
assert.equal(codebook.source.bldcodeRows, 22383);
assert.equal(codebook.officialSections.length, 1626);
assert.equal(new Set(codebook.officialSections.map((row) => row.district)).size, 29);

const formSetCodes = { A: ["A"], B: ["B", "G"], C: ["C"], D: ["D", "F", "H"] };
for (const [formSet, codes] of Object.entries(formSetCodes)) {
  const expected = codebook.codeTypes.ALLRPT.filter((row) => codes.includes(row.code));
  const actual = app.formCatalogForSet(formSet);
  assert.equal(actual.length, expected.length, `${formSet} catalog count must follow current ALLRPT rows`);
  assert.equal(
    JSON.stringify(Array.from(actual, ({ code, mark, label }) => ({ code, mark, label }))),
    JSON.stringify(expected.map(({ code, mark, label }) => ({ code, mark, label }))),
    `${formSet} catalog entries must come directly from ALLRPT`,
  );
}

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
assert.equal(app.useModalForOptions([["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]), false, "Five options should stay in a native select");
assert.equal(app.useModalForOptions([["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]]), true, "Six options should use the searchable modal");
let shortCodeExample = null;
for (const table of Object.keys(app.TABLE_CONFIG)) {
  const field = app.allFields(table).find((item) => item.kind === "code" && app.optionsFor(table, item.name, {}).length > 0 && app.optionsFor(table, item.name, {}).length <= 5);
  if (field) { shortCodeExample = { table, field }; break; }
}
assert(shortCodeExample, "At least one real code field should exercise the five-or-fewer native-select path");
const shortCodeMarkup = app.renderField(shortCodeExample.field, { [shortCodeExample.field.name]: "" }, shortCodeExample.table);
assert(shortCodeMarkup.includes('<select class="compact-option-select"'));
assert(!shortCodeMarkup.includes("data-open-picker"));
assert(districtMarkup.includes("data-open-picker"));
assert(districtMarkup.includes("picker-display-label"), "Code fields should present the readable name as the primary control");
assert(districtMarkup.includes("picker-code-input"), "Raw code editing should remain available in advanced mode");
assert(!districtMarkup.includes("field-hint"), "Always-visible field hints should be removed from the main form");
assert(!districtMarkup.includes("目前："), "Picker controls should avoid redundant current-value captions");
assert(!districtMarkup.includes("<datalist"));
const bulkMarkup = app.renderBulkControl("BMSLAN", districtField, { DIST: "436" }, 0, 0);
assert(bulkMarkup.includes("data-open-bulk-picker"));
assert(bulkMarkup.includes(">⌄</button>"), "Bulk picker buttons should use a compact arrow control");
assert(!bulkMarkup.includes("<datalist"));
assert(!app.renderBulkControl("BMSLAN", districtField, { DIST: "" }, 0, 0).includes(">空白</small>"), "Blank bulk picker cells should not repeat an empty caption");
const spokesmanField = app.fieldDefinition("BMSLAN", "SPOKESMAN");
const spokesmanMarkup = app.renderField(spokesmanField, { SPOKESMAN: "Y" }, "BMSLAN");
assert(spokesmanMarkup.includes('<select class="compact-option-select"'), "Y/N fields should render as a native select");
assert(spokesmanMarkup.includes('<option value="Y" selected>是</option>'));
assert(spokesmanMarkup.includes('>否</option>'));
assert(!spokesmanMarkup.includes("data-open-picker"), "Y/N fields must not open a modal");
const bulkSpokesmanMarkup = app.renderBulkControl("BMSLAN", spokesmanField, { SPOKESMAN: "N" }, 0, 0);
assert(bulkSpokesmanMarkup.includes('<select class="compact-option-select"'), "Bulk Y/N fields should also use a native select");
assert(!bulkSpokesmanMarkup.includes("data-open-bulk-picker"));
assert(app.renderInlineOptionMarkup([["A", "甲"]], "legacy").includes("目前值：legacy"), "Unknown existing values must remain selectable and exportable");

const expectedEditableCounts = { BM_TEC: 16, BMSSC: 52, BMSROAD: 11, BMSCHK: 29, BMSSCRP: 12, RPTPHOTO: 4, C21_3: 4, BMELVTR: 19 };
for (const [table, count] of Object.entries(expectedEditableCounts)) {
  assert.equal(app.allFields(table).length, count, `${table} editable field count`);
}
const standardFields = schema.fieldOrder;
const extraFields = extensionSchema.extraFieldOrder;
for (const table of Object.keys(app.TABLE_CONFIG)) {
  const contract = standardFields[table] || extraFields[table];
  assert(contract, `${table} must exist in the data.txt or case-extension schema`);
  const configured = app.allFields(table).map((field) => field.name);
  assert.equal(new Set(configured).size, configured.length, `${table} UI fields must not repeat`);
  assert.equal(configured.filter((field) => !contract.includes(field)).length, 0, `${table} UI fields must use exact schema casing`);
}
const attachmentMarkup = app.renderField(app.fieldDefinition("RPTPHOTO", "barcode"), { barcode: "YWJj", FILE_NAME: "example.jpg", FILE_SIZE: "3" }, "RPTPHOTO");
assert(attachmentMarkup.includes("data-attachment-input") && attachmentMarkup.includes("可多選"));

const savedBootstrap = app.state.bootstrap;
const savedTables = app.state.tables;
app.state.bootstrap = {
  tableOrder: ["BMSBASE", "BMSLAN"],
  tableMeta: { BMSBASE: { repeatable: false }, BMSLAN: { repeatable: true } },
  fieldOrder: { BMSBASE: ["INDEX_KEY", "LICENSE"], BMSLAN: ["INDEX_KEY", "ROAD_NO1"] },
  extraTableOrder: ["BMSROAD"],
  extraTableMeta: { BMSROAD: { repeatable: true } },
  extraFieldOrder: { BMSROAD: ["INDEX_KEY", "person_seq", "ROAD_SEC"] },
};
app.state.tables = {
  BMSBASE: [{ INDEX_KEY: "115071400001", LICENSE: "中市建字第 1 號" }],
  BMSLAN: [{ INDEX_KEY: "115071400001", ROAD_NO1: "100" }, { INDEX_KEY: "115071400001", ROAD_NO1: "200" }],
  BMSROAD: [{ INDEX_KEY: "115071400001", person_seq: "1", ROAD_SEC: "範例路" }],
};
const splitEnvelope = app.caseEnvelope();
assert.deepEqual(Object.keys(splitEnvelope.tables), ["BMSBASE", "BMSLAN"]);
assert.deepEqual(Object.keys(splitEnvelope.extraTables), ["BMSROAD"]);
assert.equal(splitEnvelope.extraTables.BMSROAD[0].ROAD_SEC, "範例路");
assert.equal(app.hasExtraData(), true);
assert.equal(app.clearTableData("BMSLAN").length, 0, "Clearing a repeatable page should remove all rows from that page only");
assert.equal(app.state.tables.BMSBASE[0].LICENSE, "中市建字第 1 號", "Clearing one page must not alter another page");
const clearedBaseRows = app.clearTableData("BMSBASE");
assert.equal(clearedBaseRows.length, 1, "A non-repeatable page should keep one editable blank record");
assert.equal(clearedBaseRows[0].INDEX_KEY, "115071400001", "Clearing the main page must preserve the cross-table system key");
assert.equal(clearedBaseRows[0].LICENSE, "");
app.state.bootstrap = savedBootstrap;
app.state.tables = savedTables;

assert.equal(app.TABLE_CONFIG.BMSLAN.sections.find((section) => section.copyCurrent)?.copyCurrent, "BMSLAN");
assert.equal(app.TABLE_CONFIG.BMSSTAIR.sections.find((section) => section.copyCurrent)?.copyCurrent, "BMSSTAIR");
assert.equal(app.bulkColumnClass(districtField), "bulk-col-code");
assert.equal(app.bulkColumnClass(app.fieldDefinition("BMSSTAIR", "BUILDING_NO")), "bulk-col-text");
assert.equal(app.bulkColumnClass(app.fieldDefinition("BMSSTAIR", "STORY_AREA")), "bulk-col-number");
assert.equal(app.sectionStartsOpen("BMSLAN", app.TABLE_CONFIG.BMSLAN.sections[0], 0), true, "Current-data sections should start open");
const oldLandSectionIndex = app.TABLE_CONFIG.BMSLAN.sections.findIndex((section) => section.old);
assert.equal(app.sectionStartsOpen("BMSLAN", app.TABLE_CONFIG.BMSLAN.sections[oldLandSectionIndex], oldLandSectionIndex), false, "Old-value sections should start collapsed");

assert(index.includes('id="actionMenu"'), "Secondary file actions should be grouped into a compact menu");
assert(index.includes('id="formSetSwitcher"'), "The sidebar should contain the form-set segmented control");
assert(index.includes('id="formSetPlaceholder"') && index.includes('id="formSetCatalogBody"'), "Unavailable form sets should use the catalog placeholder page");
assert(index.includes("此書表組尚未開放編輯。") && index.includes("data.txt 仍會完整輸出 13 表"));
assert(index.includes('id="loadCaseJsonButton"') && index.includes('id="exportCaseJsonButton"') && index.includes('id="caseJsonFileInput"'));
assert(index.includes('id="toggleSectionsButton"'), "Form sections should support one-click collapse/expand");
assert(index.includes('id="toggleRawFieldsButton"'), "Raw field names should be opt-in");
assert(index.includes('id="optionPickerRecent"'), "The option picker should expose recent selections");
assert(index.includes('id="bulkToggleAllButton"'), "The bulk table should provide a select-all button");
assert(index.includes('id="clearCurrentTableButton"'), "Every active data page should expose a clear-page action");
assert(index.includes('id="clearTableDialog"') && index.includes('id="confirmClearTableButton"'), "Clearing a page must require a custom warning modal");
assert(!index.includes('class="coverage-card"'), "The permanent coverage note should be removed from the sidebar");
assert(styles.includes("body.show-raw .picker-code-input"), "Advanced raw-code mode should reveal the underlying code input");
assert(styles.includes(".picker-option.keyboard-focus"), "Picker keyboard focus must be visible");
assert(source.includes("function movePickerCursor"), "The option picker should support arrow-key navigation");
assert(source.includes("function rememberPickerValue"), "The option picker should remember recent selections");
assert(source.includes("function sectionStartsOpen"), "Field sections should preserve their collapse state");
assert(source.includes("function toggleAllBulkRows") && source.includes("function syncBulkSelectAllButton"), "Bulk select-all state should stay synchronized after individual checkbox changes");
const fakeDialog = { getBoundingClientRect: () => ({ left: 100, right: 500, top: 80, bottom: 420 }) };
assert.equal(app.isDialogBackdropClick(fakeDialog, { target: fakeDialog, clientX: 40, clientY: 200 }), true, "Clicking outside a modal should count as a backdrop click");
assert.equal(app.isDialogBackdropClick(fakeDialog, { target: fakeDialog, clientX: 200, clientY: 200 }), false, "Clicking empty space inside the modal must not close it");
assert.equal(app.isDialogBackdropClick(fakeDialog, { target: {}, clientX: 40, clientY: 200 }), false, "Clicking modal content must not count as a backdrop click");
assert(source.includes("state.bulkDirty = true"), "Bulk edits should be tracked until the modal closes");
assert(styles.includes("cursor: pointer"), "The modal backdrop should visually indicate it can be clicked");
assert(styles.includes("overflow-y: scroll"), "The page should always reserve space for the right-side scrollbar");
assert((styles.match(/scrollbar-gutter:\s*stable/g) || []).length >= 2, "Page and modal scroll containers should reserve stable scrollbar gutters");
assert(styles.includes("min-width: 96px; width: 96px; max-width: 96px"), "Short bulk columns should be reduced to roughly two-thirds width");
assert(styles.includes("grid-template-columns: minmax(54px, 1fr) 30px"), "Bulk code inputs and picker arrows should use the compact layout");
assert(!styles.includes("min-width: 126px"), "The previous wide default bulk columns should be removed");
assert(styles.includes(".form-set-switcher") && styles.includes('.form-set-button[aria-pressed="true"]'), "Form-set selection needs segmented styling and a non-color accessibility state");
assert(styles.includes("@media (max-width: 920px)") && styles.includes(".form-set-switcher { display: flex; overflow-x: auto;"), "The form-set switcher should become horizontally scrollable at 920px");
assert(!/TODO|coming soon/i.test(index), "Placeholder copy must remain user-facing Traditional Chinese");

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
