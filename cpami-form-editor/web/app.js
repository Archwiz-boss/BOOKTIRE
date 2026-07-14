"use strict";

const F = (name, label, extra = {}) => ({ name, label, ...extra });
const N = (name, label, extra = {}) => F(name, label, { kind: "number", ...extra });
const D = (name, label, extra = {}) => F(name, label, { kind: "date", placeholder: "民國 yyyMMdd，例如 1150713", ...extra });
const C = (name, label, extra = {}) => F(name, label, { kind: "code", ...extra });
const Y = (name, label, extra = {}) => F(name, label, { kind: "yn", ...extra });
const M = (name, label, extra = {}) => F(name, label, { multiline: true, ...extra });
const S = (title, fields, extra = {}) => ({ title, fields, ...extra });
const OPTION_MODAL_THRESHOLD = 5;

const addressFields = (prefix, title) => [
  C(`${prefix}ADR`, `${title}行政區代碼`, { hint: "報表會依行政區代碼組出縣市／區名。" }),
  F(`${prefix}AD1`, `${title}村里鄰`),
  F(`${prefix}AD2`, `${title}路街段`),
  F(`${prefix}AD3`, `${title}地址文字 3`),
  F(`${prefix}AD4`, `${title}地址文字 4`),
  F(`${prefix}AD5`, `${title}門牌主號`),
  F(`${prefix}AD6`, `${title}之號`),
  F(`${prefix}AD6_1`, `${title}之號附碼`),
  F(`${prefix}AD7`, `${title}樓號`),
  F(`${prefix}AD7_1`, `${title}樓號附碼`),
  F(`${prefix}AD8`, `${title}室號`),
  F(`${prefix}AD9`, `${title}其他地址文字`, { wide: true }),
];

const TABLE_CONFIG = {
  BMSBASE: {
    label: "案件主檔／申請書總表",
    forms: ["A11-1", "A11-2", "A11-2-2", "A11-3", "A11-4", "A11-5", "A11-6", "A12-2", "A12-4", "A12-4-2", "A12-5", "A13-1", "A13-2", "A13-3", "A13-10", "A21-1", "A21-4", "A23-1", "A31-1", "A31-4", "A31-5", "A32-2"],
    notice: "BMSBASE 是全案唯一主檔。INDEX_KEY 會同步到所有子表；報表上的主管機關、工程類別、構造及用途名稱，多半由這裡的代碼組成。",
    sections: [
      S("案件識別", [
        F("INDEX_KEY", "案件主鍵", { hint: "全 13 表必須一致；留白時匯出器會以目前時間產生民國 13 碼主鍵。", wide: true }),
        C("BMPAS", "縣市／系統代碼"), C("GOV", "主管機關代碼"),
        C("BUILDING_CATEGORY", "工程類別代碼"), C("APPLY_TYPE", "申請類型代碼"),
        F("BUILDING_NAME", "工程名稱", { full: true }), F("FILENAME", "案件檔名／顯示名稱", { wide: true }),
        F("LICENSE", "本次執照字號", { wide: true }), F("LICENSE_OLD", "原核准執照字號", { wide: true }),
        N("SEQ_NO", "案件版本／序號"), F("LAST_MODIFY", "最後修改版號", { hint: "文字欄，需保留前導 0。" }),
        Y("PUBLIC_CODE", "是否供公眾使用"), Y("LINK_TYPE", "是否為連結案件"), Y("TempBuild", "是否為臨時建築物"),
      ]),
      S("建築線與法規", [
        F("BUILDING_LINE_WORD", "建築線文號字別"), F("BUILDING_LINE_NO", "建築線文號號碼"), D("BUILDING_DATE", "建築線指定日期"),
        N("LAW_COVER_RATE", "法定建蔽率（%）"), N("LAW_SPACE_RATE", "法定容積率（%）"),
        C("LAW_01", "建築技術規則版本代碼"), C("LAW_03", "耐震規範版本代碼"),
      ]),
      S("基地與土地使用分區", [
        N("BASE_AREA_ARC", "基地騎樓地等面積（㎡）"), N("BASE_AREA_SHRINK", "基地退縮面積（㎡）"),
        N("BASE_AREA_OTHER", "基地其他面積（㎡）"), N("BASE_AREA_PURPOSE", "基地特定用途面積（㎡）"),
        N("BASE_AREA_TOTAL", "基地面積合計（㎡）"), N("STATUTORY_OPEN_SPACE", "法定空地面積（㎡）"),
        C("USE_CATEGORY_CODE1", "土地使用分區代碼 1"), C("USE_CATEGORY_CODE2", "土地使用分區代碼 2"), C("USE_CATEGORY_CODE3", "土地使用分區代碼 3"),
      ]),
      S("建築物概要與面積", [
        N("BUIL_AREA_ARC", "建築面積－騎樓等（㎡）"), N("BUIL_AREA_OTHER", "建築面積－其他（㎡）"),
        N("BUILDING_AREA", "建築面積（㎡）"), N("TOTAL_CONSTRU_AREA", "總樓地板面積（㎡）"),
        N("BUILD_COVER_RATE", "實設建蔽率（%）"), N("SPACE_RATE", "實設容積率（%）"),
        C("USAGE_CODE", "建築物主要用途代碼"), F("USAGE_CODE_DESC", "主要用途顯示文字", { wide: true, hint: "代碼與顯示文字要同步，報表會直接讀取文字欄。" }),
        C("BUILDING_KIND1", "構造種類代碼 1"), C("BUILDING_KIND2", "構造種類代碼 2"), C("BUILDING_KIND3", "構造種類代碼 3"),
        N("BUILDING_HEIGHT", "建築高度分類值"), N("BUILD_HIHIGHT", "建築物高度（m）"),
        N("CHWANG_NO", "幢數"), N("BUILDING_NO", "棟數"), N("UP_FLOOR_NO", "地上層數"),
        N("DN_FLOOR_NO", "地下層數"), N("TOT_HOUSE_NO", "戶數"), N("PRICE", "工程造價（元）"),
      ]),
      S("防空避難與其他金額", [
        N("AIRRAID_U_AREA", "防空避難地上面積"), N("AIRRAID_D_AREA", "防空避難地下面積"),
        N("LAW_AIRRAID_AREA", "法定防空避難面積"), N("AIRRAID_P_AREA", "防空避難停車面積"),
        M("OTHERS_NAME", "其他項目名稱／說明", { full: true }), N("OTHERS_PRICE", "雜項工作物造價（元）"),
        F("HOUSE_MEMO", "使用類組／住宅附註代碼"),
      ]),
      S("書表長文字", [
        M("A12_TITTLE", "土地使用權同意書前言", { full: true }),
        M("A12_5TITLE", "共同壁協定書標題／前言", { full: true }),
      ]),
      S("變更前／原核准值", [
        C("BUILDING_KIND1_OLD", "原構造種類代碼 1"), C("BUILDING_KIND2_OLD", "原構造種類代碼 2"), C("BUILDING_KIND3_OLD", "原構造種類代碼 3"),
        N("BUILDING_HEIGHT_OLD", "原建築高度分類值"), N("PRICE_OLD", "原工程造價（元）"), N("OTHERS_PRICE_OLD", "原雜項工作物造價（元）"),
      ], { old: true, note: "A11-6、A31 系列會同時顯示本次值與原核准值；新申請可留白。" }),
    ],
  },
  BMSLAN: {
    label: "基地地號",
    forms: ["A11-1", "A12-2", "A12-4", "A12-5", "A21-1", "A31-1", "A32-2"],
    notice: "一筆地號一列。母號與子號一定要分欄，不要先合成「875-1」再寫進 ROAD_NO1。",
    sections: [
      S("本次地號", [
        Y("SPOKESMAN", "代表地號"), C("DIST", "行政區代碼"), C("SECTION", "地段代碼"),
        F("ROAD_NO1", "地號母號"), F("ROAD_NO2", "地號子號"), N("TOT_AREA", "土地登記總面積（㎡）"), N("USE_AREA", "本案使用面積（㎡）"),
        C("USE_CATEGORY_CODE1", "土地使用分區代碼 1"), C("USE_CATEGORY_CODE2", "土地使用分區代碼 2"), Y("LOCATED", "位於特定範圍"),
      ]),
      S("變更前地號", [
        C("DIST_OLD", "原行政區代碼"), C("SECTION_OLD", "原地段代碼"), F("ROAD_NO1_OLD", "原地號母號"), F("ROAD_NO2_OLD", "原地號子號"),
        N("TOT_AREA_OLD", "原土地總面積（㎡）"), N("USE_AREA_OLD", "原使用面積（㎡）"),
        C("USE_CATEGORY_CODE1_OLD", "原分區代碼 1"), C("USE_CATEGORY_CODE2_OLD", "原分區代碼 2"),
      ], { old: true, note: "A32-2 變更設計地號表使用；非變更案留白。按鈕會以本次地號逐欄覆蓋原值，空白也會照樣帶入。", copyCurrent: "BMSLAN", copyLabel: "一鍵帶入本次地號" }),
    ],
  },
  BMSLANOWNER: {
    label: "土地所有權人",
    forms: ["A12-4"],
    notice: "這不是單純的所有權人名冊，而是「地號 × 所有權人」關係；同一人有多筆地號時需建立多列。",
    sections: [
      S("地號關聯", [C("DIST", "行政區代碼"), C("SECTION", "地段代碼"), F("ROAD_NO1", "地號母號"), F("ROAD_NO2", "地號子號")]),
      S("所有權資料", [
        F("owner_id", "所有權人身分證／統編"), F("owner", "所有權人姓名／名稱", { wide: true }),
        N("TOT_AREA_hold", "持有總面積（㎡）"), N("USE_AREA_hold", "供本案使用面積（㎡）"), D("owner_birth", "出生日期"),
        F("owner_add", "所有權人地址", { full: true }), F("owner_tel", "所有權人電話"), M("owner_memo", "所有權備註", { wide: true }),
      ]),
    ],
  },
  BMSMEMO: {
    label: "案件備註",
    forms: ["A11-1", "A21-1", "A31-1"],
    notice: "備註代碼、代碼名稱與實際全文要一起填。沒有對應代碼的自由備註可讓 MEMO_SEQ／NAME 留白，只填 DESE。",
    sections: [S("備註內容", [C("MEMO_SEQ", "備註代碼"), F("MEMO_SEQ_NAME", "備註代碼名稱"), M("DESE", "備註全文", { full: true })])],
  },
  BMSP01: {
    label: "起造人／棟戶門牌",
    forms: ["A11-1", "A11-2", "A11-2-2", "A11-5", "A12-5", "A13-3", "A21-1", "A31-1"],
    notice: "一列代表「起造人 × 棟號／門牌／用途」關係，不一定是一位起造人一列。本樣本 24 棟因此有 24 列。",
    sections: [
      S("起造人基本資料", [
        Y("SPOKESMAN", "主要起造人"), F("CNAME", "姓名／公司名稱", { wide: true }), D("BIRTH_DATE", "出生日期"),
        F("IDENTIFY_NO", "身分證號／統一編號"), F("Law_represent", "法定代理人／代表人"),
        F("TEL_NO", "電話"), F("Fax_NO", "傳真"), F("eMail", "電子郵件", { wide: true }),
      ]),
      S("棟戶與用途", [
        F("BUILDING_NO", "棟別／單元代號"), F("CHWANG", "幢序號"), F("DONG", "棟序號"), F("FLOOR", "層序號"), F("HOUSE", "戶序號"),
        C("BLD_CODE1", "用途類組代碼 1"), F("BLD_CODE1_DESC", "用途 1 顯示全文", { wide: true }), F("BLD_CODE1_T", "用途 1 類組輔助值"),
        C("BLD_CODE2", "用途類組代碼 2"), F("BLD_CODE2_DESC", "用途 2 顯示全文", { wide: true }), F("BLD_CODE2_T", "用途 2 類組輔助值"),
        C("BLD_CODE3", "用途類組代碼 3"), F("BLD_CODE3_DESC", "用途 3 顯示全文", { wide: true }), F("BLD_CODE3_T", "用途 3 類組輔助值"),
      ]),
      S("戶籍／公司地址", addressFields("O_ADDR", "戶籍／公司－")),
      S("通訊地址", addressFields("H_ADDR", "通訊－")),
      S("建築物門牌地址", addressFields("ADDR", "門牌－"), { note: "報表會把 ADDRADR～ADDRAD9 組成完整門牌地址。" }),
    ],
  },
  BMSP02: {
    label: "設計人",
    forms: ["A11-1", "A11-3", "A11-5", "A21-1", "A31-1"],
    sections: [
      S("建築師", [
        Y("SPOKESMAN", "主要設計人"), F("CNAME", "建築師姓名"), F("IDENTIFY_NO", "身分證號"),
        C("COM_ID_AREA", "開業證書縣市字母"), F("COM_ID_WORD", "開業證書字別／年度"), F("COM_ID_NO", "開業證書號碼"), F("COM_ID_NO1", "開業證書附加號碼"),
        F("OFFICE_NAME", "事務所名稱", { wide: true }), C("COM_ZIP", "郵遞區號／行政區代碼"), F("COM_ADDRESS", "事務所地址", { full: true }),
        F("TEL_NO", "電話"), F("FAX_NO", "傳真"), F("eMail", "電子郵件", { wide: true }),
      ]),
    ],
  },
  BMSP03: {
    label: "監造人",
    forms: ["A31-1"],
    sections: [
      S("監造建築師", [
        Y("SPOKESMAN", "主要監造人"), F("CNAME", "建築師姓名"), F("IDENTIFY_NO", "身分證號"),
        C("COM_ID_AREA", "開業證書縣市字母"), F("COM_ID_WORD", "開業證書字別／年度"), F("COM_ID_NO", "開業證書號碼"), F("COM_ID_NO1", "開業證書附加號碼"),
        F("OFFICE_NAME", "事務所名稱", { wide: true }), C("COM_ZIP", "郵遞區號／行政區代碼"), F("COM_ADDRESS", "事務所地址", { full: true }),
        F("TEL_NO", "電話"), F("FAX_NO", "傳真"), F("eMail", "電子郵件", { wide: true }),
      ]),
    ],
  },
  BMSP04: {
    label: "承造人",
    forms: ["A11-5", "A31-1"],
    sections: [
      S("營造業", [
        Y("SPOKESMAN", "主要承造人"), F("COMPANY_NAME", "營造業公司名稱", { wide: true }), F("COM_IDNO", "公司統一編號"), F("BOSS", "負責人"),
        C("COM_ZIP", "郵遞區號／行政區代碼"), F("COM_ADDRESS", "公司地址", { full: true }),
        C("ARC_REG_WORD", "營造業登記縣市字母"), C("ARC_REG_CLAS", "營造業登記等級"), F("ARC_REG_PRI", "登記字號前置／序號"), F("ARC_REG_NO", "登記字號主體"),
        F("TEL_NO", "電話"), F("FAX_NO", "傳真"), F("eMail", "電子郵件", { wide: true }),
      ]),
      S("工程人員", [
        F("TECH_NAME", "專任工程人員姓名"), F("TECH_LIC", "專任工程人員證書字號", { wide: true }), C("FTENGTYPE", "專任工程人員種類代碼"),
        F("SCTNAME", "工地主任姓名"), F("SCTNO", "工地主任執業證號"),
      ]),
    ],
  },
  BMSPARK: {
    label: "停車空間",
    forms: ["A11-1", "A31-1"],
    notice: "每種「停車方式 × 車種 × 法定／自設 × 室內外 × 地上下」組合各一列。",
    sections: [S("停車分類與數量", [
      C("PARK_KIND", "停車方式代碼"), C("CAR_KIND", "車種代碼"), C("APPL_KIND", "設立類別代碼"), C("IN_OUT", "室內外別代碼"), C("UP_DOWN", "地上地下別代碼"),
      N("NUM", "車位數"), N("AREA", "停車面積（㎡）"), Y("AIR_FLAG", "兼作防空避難"),
    ])],
  },
  BMSSTAIR: {
    label: "樓層／用途／面積",
    forms: ["A11-4", "A11-6", "A31-4"],
    notice: "一列代表一個「樓層 × 用途組合」。同一樓層有兩種用途時，可以同列填用途 1、2，也可能依原系統拆成多列。",
    sections: [
      S("本次樓層概要", [
        F("BUILDING_NO", "棟別代號"), C("STORY_CODE", "樓層代碼"),
        C("USAGE_CODE1", "用途代碼 1"), F("USAGE_CODE1_DESC", "用途 1 顯示文字", { wide: true }), F("USAGE_CODE1_T", "用途 1 輔助值"),
        C("USAGE_CODE2", "用途代碼 2"), F("USAGE_CODE2_DESC", "用途 2 顯示文字", { wide: true }), F("USAGE_CODE2_T", "用途 2 輔助值"),
        C("USAGE_CODE3", "用途代碼 3"), F("USAGE_CODE3_DESC", "用途 3 顯示文字", { wide: true }), F("USAGE_CODE3_T", "用途 3 輔助值"),
        N("STORY_AREA", "樓層／用途面積（㎡）"), N("STORY_HEIGHT", "層高（m）"), N("VERANDA_AREA", "陽台面積（㎡）"), N("TERRACE_AREA", "露臺面積（㎡）"),
      ]),
      S("變更前／原核准樓層概要", [
        F("BUILDING_NO_OLD", "原棟別代號"), C("STORY_CODE_OLD", "原樓層代碼"),
        C("USAGE_CODE1_OLD", "原用途代碼 1"), F("USAGE_CODE1_DESC_OLD", "原用途 1 顯示文字", { wide: true }), F("USAGE_CODE1_OLD_T", "原用途 1 輔助值"),
        C("USAGE_CODE2_OLD", "原用途代碼 2"), F("USAGE_CODE2_DESC_OLD", "原用途 2 顯示文字", { wide: true }), F("USAGE_CODE2_OLD_T", "原用途 2 輔助值"),
        C("USAGE_CODE3_OLD", "原用途代碼 3"), F("USAGE_CODE3_DESC_OLD", "原用途 3 顯示文字", { wide: true }), F("USAGE_CODE3_OLD_T", "原用途 3 輔助值"),
        N("STORY_AREA_OLD", "原面積（㎡）"), N("STORY_HEIGHT_OLD", "原層高（m）"), N("VERANDA_AREA_OLD", "原陽台面積（㎡）"), N("TERRACE_AREA_OLD", "原露臺面積（㎡）"),
      ], { old: true, note: "A11-6、A31-4 使用。新申請可留白。按鈕會以本次樓層概要逐欄覆蓋原值，空白也會照樣帶入。", copyCurrent: "BMSSTAIR", copyLabel: "一鍵帶入本次樓層概要" }),
    ],
  },
  BMSWORK: {
    label: "雜項工作物",
    forms: ["A21-4", "A31-5"],
    sections: [
      S("本次工作物", [
        F("CONSNAME", "工作物名稱", { wide: true }), F("BUILDING_KIND", "工作物構造"),
        N("LENGTH", "長度（m）"), N("HEIGHT", "高度（m）"), N("WIDE", "寬度／厚度（m）"), N("AREA", "面積（㎡）"), F("CONNUM", "數量"),
        M("DESE", "工作物說明", { full: true }),
      ]),
      S("變更前／原核准工作物", [
        F("CONSNAME_OLD", "原工作物名稱", { wide: true }), F("BUILDING_KIND_OLD", "原工作物構造"),
        N("LENGTH_OLD", "原長度（m）"), N("HEIGHT_OLD", "原高度（m）"), N("WIDE_OLD", "原寬度／厚度（m）"), N("AREA_OLD", "原面積（㎡）"),
        M("DESE_OLD", "原工作物說明", { full: true }),
      ], { old: true, note: "A31-5 使用；非變更案可留白。" }),
    ],
  },
};

const CODE_OPTIONS = {
  "BMSBASE.BMPAS": [["I80", "臺中市"]],
  "BMSBASE.GOV": [["I80", "臺中市政府"]],
  "BMSBASE.BUILDING_CATEGORY": [["01", "新建"]],
  "BMSBASE.APPLY_TYPE": [["A11-1", "建造執照申請"], ["A21-1", "雜項執照申請"], ["A31-1", "建造變更設計申請"]],
  "BMSBASE.USE_CATEGORY_CODE1": [["0140", "第四種住宅區（臺中市）"]],
  "BMSBASE.USAGE_CODE": [["01", "住宅"]],
  "BMSBASE.BUILDING_KIND1": [["10", "鋼筋混凝土造（臺中市）"]],
  "BMSBASE.BUILDING_KIND1_OLD": [["10", "鋼筋混凝土造（臺中市）"]],
  "BMSBASE.LAW_01": [["41", "112/5/10 建築技術規則版本"]],
  "BMSBASE.LAW_03": [["05", "113/3/1 耐震設計規範版本"]],
  "BM_TEC.TEC_ITEM": [["2", "地基調查"]],
  "BM_TEC.TEC_TYPE": [["04", "大地技師"]],
  "BMSLAN.DIST": [["436", "臺中市清水區"], ["420", "臺中市豐原區"]],
  "BMSLAN.DIST_OLD": [["436", "臺中市清水區"], ["420", "臺中市豐原區"]],
  "BMSLAN.SECTION": [["4662", "福安段（本案；須以新系統代碼庫複核）"]],
  "BMSLAN.SECTION_OLD": [["4662", "福安段（本案；須以新系統代碼庫複核）"]],
  "BMSLAN.USE_CATEGORY_CODE1": [["0140", "第四種住宅區"]],
  "BMSLAN.USE_CATEGORY_CODE1_OLD": [["0140", "第四種住宅區"]],
  "BMSMEMO.MEMO_SEQ": [["M591", "火災警報器"], ["M2Q1", "污水用戶"], ["M161", "地質敏感"]],
  "BMSP01.BLD_CODE1": [["H2", "住宅類組"], ["00", "其他"]],
  "BMSP01.BLD_CODE2": [["00", "其他（可自行填停車空間等文字）"]],
  "BMSP01.BLD_CODE3": [["00", "其他"]],
  "BMSP02.COM_ID_AREA": [["M", "臺中市"]],
  "BMSP03.COM_ID_AREA": [["M", "臺中市"]],
  "BMSP04.ARC_REG_WORD": [["M", "臺中市"]],
  "BMSP04.ARC_REG_CLAS": [["1", "甲等"]],
  "BMSPARK.PARK_KIND": [["1", "平面"]],
  "BMSPARK.CAR_KIND": [["1", "小型車"]],
  "BMSPARK.APPL_KIND": [["1", "法定"]],
  "BMSPARK.IN_OUT": [["1", "室內"]],
  "BMSPARK.UP_DOWN": [["1", "地上"]],
  "BMSSTAIR.STORY_CODE": [["U0010", "地上 1 樓"], ["U0020", "地上 2 樓"], ["U0030", "地上 3 樓"], ["U0040", "地上 4 樓"]],
  "BMSSTAIR.STORY_CODE_OLD": [["U0010", "地上 1 樓"], ["U0020", "地上 2 樓"], ["U0030", "地上 3 樓"], ["U0040", "地上 4 樓"]],
  "BMSSTAIR.USAGE_CODE1": [["H2", "住宅"], ["00", "其他"]],
  "BMSSTAIR.USAGE_CODE2": [["00", "其他"]],
  "BMSSTAIR.USAGE_CODE3": [["00", "其他"]],
  "BMSSTAIR.USAGE_CODE1_OLD": [["H2", "住宅"], ["00", "其他"]],
  "BMSSTAIR.USAGE_CODE2_OLD": [["00", "其他"]],
  "BMSSTAIR.USAGE_CODE3_OLD": [["00", "其他"]],
};

const genericDistrictOptions = [["436", "臺中市清水區"], ["420", "臺中市豐原區"], ["403", "臺中市西區"], ["411", "臺中市太平區"]];

// Maps editable data.txt fields to the legacy Bldcode.CODE_TYPE used by the
// original program.  The complete rows live in codebook.json; the small
// CODE_OPTIONS object above is retained only as a fallback for values missing
// from the 2019 local code database.
const FIELD_CODEBOOK = {
  BMSBASE: {
    BMPAS: { type: "PAS" }, GOV: { type: "BUDWD" }, BUILDING_CATEGORY: { type: "BIN" }, APPLY_TYPE: { type: "APP" },
    LAW_01: { type: "BMLAW1" }, LAW_03: { type: "BMLAW2" },
    USE_CATEGORY_CODE1: { type: "KIN", city: true }, USE_CATEGORY_CODE2: { type: "KIN", city: true }, USE_CATEGORY_CODE3: { type: "KIN", city: true },
    USAGE_CODE: { type: "BLU" }, BUILDING_KIND1: { type: "STU", city: true }, BUILDING_KIND2: { type: "STU", city: true }, BUILDING_KIND3: { type: "STU", city: true },
    BUILDING_KIND1_OLD: { type: "STU", city: true }, BUILDING_KIND2_OLD: { type: "STU", city: true }, BUILDING_KIND3_OLD: { type: "STU", city: true },
    HOUSE_MEMO: { type: "USECOD" },
  },
  BMSLAN: {
    DIST: { type: "ZON", city: true }, SECTION: { type: "SEC", city: true, districtField: "DIST", value: "sub" },
    USE_CATEGORY_CODE1: { type: "KIN", city: true }, USE_CATEGORY_CODE2: { type: "KIN", city: true },
    DIST_OLD: { type: "ZON", city: true }, SECTION_OLD: { type: "SEC", city: true, districtField: "DIST_OLD", value: "sub" },
    USE_CATEGORY_CODE1_OLD: { type: "KIN", city: true }, USE_CATEGORY_CODE2_OLD: { type: "KIN", city: true },
  },
  BMSLANOWNER: {
    DIST: { type: "ZON", city: true }, SECTION: { type: "SEC", city: true, districtField: "DIST", value: "sub" },
  },
  BMSMEMO: { MEMO_SEQ: { type: "RMK", value: "subCode" } },
  BMSP01: {
    BLD_CODE1: { type: "USECOD" }, BLD_CODE2: { type: "USECOD" }, BLD_CODE3: { type: "USECOD" },
  },
  BMSP02: { COM_ZIP: { type: "ZON", city: true }, COM_ID_AREA: { type: "PAS", value: "sub" } },
  BMSP03: { COM_ZIP: { type: "ZON", city: true }, COM_ID_AREA: { type: "PAS", value: "sub" } },
  BMSP04: {
    COM_ZIP: { type: "ZON", city: true }, ARC_REG_WORD: { type: "PAS", value: "sub" }, ARC_REG_CLAS: { type: "ARCLS" }, FTENGTYPE: { type: "TECTYP" },
  },
  BMSPARK: {
    PARK_KIND: { type: "PARKTY" }, CAR_KIND: { type: "CARTYP" }, APPL_KIND: { type: "APPLTY" }, IN_OUT: { type: "INOUT" }, UP_DOWN: { type: "UPDN" },
  },
  BMSSTAIR: {
    STORY_CODE: { type: "STC", value: "codeSub" }, STORY_CODE_OLD: { type: "STC", value: "codeSub" },
    USAGE_CODE1: { type: "USECOD" }, USAGE_CODE2: { type: "USECOD" }, USAGE_CODE3: { type: "USECOD" },
    USAGE_CODE1_OLD: { type: "USECOD" }, USAGE_CODE2_OLD: { type: "USECOD" }, USAGE_CODE3_OLD: { type: "USECOD" },
  },
};

const BULK_FIELDS = {
  BM_TEC: ["TEC_ITEM", "TEC_NAME", "TEC_TYPE", "CAPACITY_NO", "REG_NO", "COM_NAME"],
  BMSLAN: ["SPOKESMAN", "DIST", "SECTION", "ROAD_NO1", "ROAD_NO2", "TOT_AREA", "USE_AREA", "USE_CATEGORY_CODE1"],
  BMSLANOWNER: ["DIST", "SECTION", "ROAD_NO1", "ROAD_NO2", "owner_id", "owner", "TOT_AREA_hold", "USE_AREA_hold"],
  BMSMEMO: ["MEMO_SEQ", "MEMO_SEQ_NAME", "DESE"],
  BMSP01: ["SPOKESMAN", "BUILDING_NO", "CNAME", "IDENTIFY_NO", "BLD_CODE1", "BLD_CODE1_DESC", "TEL_NO"],
  BMSP02: ["SPOKESMAN", "CNAME", "OFFICE_NAME", "COM_ID_AREA", "COM_ID_WORD", "COM_ID_NO", "TEL_NO"],
  BMSP03: ["SPOKESMAN", "CNAME", "OFFICE_NAME", "COM_ID_AREA", "COM_ID_WORD", "COM_ID_NO", "TEL_NO"],
  BMSP04: ["SPOKESMAN", "COMPANY_NAME", "COM_IDNO", "BOSS", "ARC_REG_WORD", "ARC_REG_CLAS", "ARC_REG_NO", "TECH_NAME"],
  BMSPARK: ["PARK_KIND", "CAR_KIND", "APPL_KIND", "IN_OUT", "UP_DOWN", "NUM", "AREA", "AIR_FLAG"],
  BMSSTAIR: ["BUILDING_NO", "STORY_CODE", "USAGE_CODE1", "USAGE_CODE1_DESC", "STORY_AREA", "STORY_HEIGHT", "VERANDA_AREA", "TERRACE_AREA"],
  BMSWORK: ["CONSNAME", "BUILDING_KIND", "LENGTH", "HEIGHT", "WIDE", "AREA", "CONNUM", "DESE"],
};

const COPY_CURRENT_TO_OLD = {
  BMSLAN: [
    ["DIST", "DIST_OLD"], ["SECTION", "SECTION_OLD"], ["ROAD_NO1", "ROAD_NO1_OLD"], ["ROAD_NO2", "ROAD_NO2_OLD"],
    ["TOT_AREA", "TOT_AREA_OLD"], ["USE_AREA", "USE_AREA_OLD"],
    ["USE_CATEGORY_CODE1", "USE_CATEGORY_CODE1_OLD"], ["USE_CATEGORY_CODE2", "USE_CATEGORY_CODE2_OLD"],
  ],
  BMSSTAIR: [
    ["BUILDING_NO", "BUILDING_NO_OLD"], ["STORY_CODE", "STORY_CODE_OLD"],
    ["USAGE_CODE1", "USAGE_CODE1_OLD"], ["USAGE_CODE1_DESC", "USAGE_CODE1_DESC_OLD"], ["USAGE_CODE1_T", "USAGE_CODE1_OLD_T"],
    ["USAGE_CODE2", "USAGE_CODE2_OLD"], ["USAGE_CODE2_DESC", "USAGE_CODE2_DESC_OLD"], ["USAGE_CODE2_T", "USAGE_CODE2_OLD_T"],
    ["USAGE_CODE3", "USAGE_CODE3_OLD"], ["USAGE_CODE3_DESC", "USAGE_CODE3_DESC_OLD"], ["USAGE_CODE3_T", "USAGE_CODE3_OLD_T"],
    ["STORY_AREA", "STORY_AREA_OLD"], ["STORY_HEIGHT", "STORY_HEIGHT_OLD"],
    ["VERANDA_AREA", "VERANDA_AREA_OLD"], ["TERRACE_AREA", "TERRACE_AREA_OLD"],
  ],
};

const state = {
  bootstrap: null,
  codebook: null,
  tables: {},
  activeTable: "BMSBASE",
  activeRecord: 0,
  sourceName: "內建 data.txt 範本",
  sourceRows: [],
  sourceHeaders: [],
  mappings: {},
  picker: { target: null, options: [], title: "", key: "", filteredIndexes: [], cursor: 0 },
  sectionOpen: {},
  showRawFields: false,
  bulkDirty: false,
  pendingClearTable: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function setStatus(text, kind = "ok") {
  $("#statusText").textContent = text;
  $("#statusDot").className = `status-dot ${kind}`;
  $("#sourceText").textContent = state.sourceName ? `來源：${state.sourceName}` : "";
}

function toast(message, kind = "") {
  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.textContent = message;
  $("#toastRegion").append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function isDialogBackdropClick(dialog, event) {
  if (event.target !== dialog) return false;
  const bounds = dialog.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
}

function closeDialogFromBackdrop(event) {
  const dialog = event.currentTarget;
  if (dialog.open && isDialogBackdropClick(dialog, event)) dialog.close();
}

function storageGet(key, fallback = "") {
  try { return typeof localStorage === "undefined" ? fallback : (localStorage.getItem(key) ?? fallback); }
  catch { return fallback; }
}

function storageSet(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); }
  catch { /* Browser privacy settings may disable local storage. */ }
}

function pickerRecentValues(key) {
  if (!key) return [];
  try {
    const saved = JSON.parse(storageGet("cpami-picker-recent", "{}"));
    return Array.isArray(saved[key]) ? saved[key] : [];
  } catch { return []; }
}

function rememberPickerValue(key, value) {
  if (!key || !value) return;
  let saved = {};
  try { saved = JSON.parse(storageGet("cpami-picker-recent", "{}")) || {}; }
  catch { saved = {}; }
  saved[key] = [value, ...(Array.isArray(saved[key]) ? saved[key] : []).filter((item) => item !== value)].slice(0, 5);
  storageSet("cpami-picker-recent", JSON.stringify(saved));
}

function allFields(table) {
  return TABLE_CONFIG[table].sections.flatMap((section) => section.fields);
}

function codeSpecFor(table, field) {
  const direct = FIELD_CODEBOOK[table]?.[field];
  if (direct) return direct;
  if (table === "BMSP01" && /^(?:O_ADDR|H_ADDR|ADDR)ADR$/.test(field)) return { type: "ZON", city: true };
  return null;
}

function optionValue(spec, row) {
  if (spec.value === "sub") return row.sub;
  if (spec.value === "codeSub") return `${row.code}${row.sub}`;
  if (spec.value === "subCode") return `${row.sub}${row.code}`;
  return row.code;
}

const strokeCollator = new Intl.Collator("zh-Hant-u-co-stroke", { numeric: true, sensitivity: "base" });
const chineseDigitValues = { 零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 兩: 2, 貳: 2, 三: 3, 參: 3, 四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9 };
const chineseUnitValues = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000, 萬: 10000 };

function chineseNumberValue(text) {
  if (!text) return null;
  if (text === "廿") return 20;
  if (text === "卅") return 30;
  let total = 0, section = 0, digit = null;
  for (const character of text) {
    if (Object.hasOwn(chineseDigitValues, character)) {
      digit = chineseDigitValues[character];
      continue;
    }
    const unit = chineseUnitValues[character];
    if (!unit) return null;
    if (unit === 10000) {
      section += (digit ?? 0);
      total += (section || 1) * unit;
      section = 0;
      digit = null;
    } else {
      section += (digit ?? 1) * unit;
      digit = null;
    }
  }
  return total + section + (digit ?? 0);
}

function leadingChineseNumber(label) {
  const match = String(label || "").trim().match(/^([零〇一壹二兩貳三參四肆五伍六陸七柒八捌九玖十拾百佰千仟萬廿卅]+)/);
  if (!match) return null;
  const value = chineseNumberValue(match[1]);
  return value === null ? null : { value, rest: String(label).trim().slice(match[1].length) };
}

function compareOptionsByName([codeA, labelA], [codeB, labelB]) {
  const numberA = leadingChineseNumber(labelA);
  const numberB = leadingChineseNumber(labelB);
  if (numberA && numberB && numberA.value !== numberB.value) return numberA.value - numberB.value;
  if (numberA && numberB) {
    const rest = strokeCollator.compare(numberA.rest, numberB.rest);
    if (rest) return rest;
  }
  const labelOrder = strokeCollator.compare(String(labelA), String(labelB));
  return labelOrder || strokeCollator.compare(String(codeA), String(codeB));
}

function sortOptionsByName(options) {
  return [...options].sort(compareOptionsByName);
}

function optionsFor(table, field, record = currentRecord()) {
  const fallback = CODE_OPTIONS[`${table}.${field}`]
    || ((/^(?:O_ADDR|H_ADDR|ADDR)ADR$/.test(field) || field === "COM_ZIP") ? genericDistrictOptions : []);
  const spec = codeSpecFor(table, field);
  if (!spec || !state.codebook) return sortOptionsByName(fallback);
  let rows = state.codebook.codeTypes?.[spec.type] || [];
  if (spec.type === "SEC") rows = [...(state.codebook.officialSections || []), ...rows];
  const city = state.tables.BMSBASE?.[0]?.BMPAS || "";
  if (spec.city && city) {
    rows = ["ZON", "SEC"].includes(spec.type)
      ? rows.filter((row) => row.parent === city)
      : rows.filter((row) => !row.parent || row.parent === city);
  }
  if (spec.city && !city && ["KIN", "STU", "SEC"].includes(spec.type)) rows = [];
  if (spec.type === "SEC") {
    const district = record?.[spec.districtField] || "";
    rows = district ? rows.filter((row) => row.code === district) : [];
  }
  const options = [];
  const seen = new Set();
  for (const row of rows) {
    const value = optionValue(spec, row);
    if (!value || value === "**") continue;
    const label = `${row.label || value}${row.mark ? `［${row.mark}］` : ""}`;
    const key = value;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push([value, label]);
  }
  for (const [value, label] of fallback) {
    if (!options.some(([existing]) => existing === value)) options.push([value, label]);
  }
  return sortOptionsByName(options);
}

function currentRows() {
  return state.tables[state.activeTable] || [];
}

function currentRecord() {
  return currentRows()[state.activeRecord] || null;
}

function recordCaption(table, record, index) {
  const candidates = {
    BM_TEC: "TEC_NAME", BMSLAN: "ROAD_NO1", BMSLANOWNER: "owner", BMSMEMO: "MEMO_SEQ_NAME",
    BMSP01: "BUILDING_NO", BMSP02: "CNAME", BMSP03: "CNAME", BMSP04: "COMPANY_NAME",
    BMSPARK: "NUM", BMSSTAIR: "STORY_CODE", BMSWORK: "CONSNAME",
  };
  const field = candidates[table];
  const value = field ? record[field] : "";
  const sequence = record.person_seq || record.Person_seq || record.PERSON_SEQ || index + 1;
  return `${sequence}. ${value || `第 ${index + 1} 筆`}`;
}

function renderNav() {
  $("#tableNav").innerHTML = Object.entries(TABLE_CONFIG).map(([table, config]) => {
    const count = (state.tables[table] || []).length;
    return `<button class="nav-item ${table === state.activeTable ? "active" : ""}" type="button" data-table="${table}">
      <span>${escapeHtml(config.label)}<small class="nav-raw">${table}</small></span>
      <span class="nav-count">${count}</span>
    </button>`;
  }).join("");
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => {
    state.activeTable = button.dataset.table;
    state.activeRecord = 0;
    $("#fieldSearch").value = "";
    renderAll();
  }));
}

function renderRecordControls() {
  const table = state.activeTable;
  const rows = currentRows();
  const repeatable = state.bootstrap.tableMeta[table]?.repeatable;
  if (state.activeRecord >= rows.length) state.activeRecord = Math.max(0, rows.length - 1);
  $("#recordSelect").innerHTML = rows.length
    ? rows.map((record, index) => `<option value="${index}" ${index === state.activeRecord ? "selected" : ""}>${escapeHtml(recordCaption(table, record, index))}</option>`).join("")
    : `<option value="">沒有記錄</option>`;
  $("#recordSelect").disabled = !rows.length;
  $("#addRecordButton").disabled = !repeatable;
  $("#copyRecordButton").disabled = !repeatable || !rows.length;
  $("#deleteRecordButton").disabled = !repeatable || !rows.length;
  $("#bulkEditButton").disabled = !repeatable || !BULK_FIELDS[table];
  $("#clearCurrentTableButton").disabled = !rows.length;
}

function pickerOptionsForField(table, field, record) {
  if (field.kind === "yn") return sortOptionsByName([["Y", "是"], ["N", "否"]]);
  return optionsFor(table, field.name, record);
}

function useModalForOptions(options) {
  return options.length > OPTION_MODAL_THRESHOLD;
}

function renderInlineOptionMarkup(options, value) {
  const sortedOptions = sortOptionsByName(options);
  const hasCurrentValue = sortedOptions.some(([code]) => code === value);
  const currentFallback = value && !hasCurrentValue
    ? `<option value="${escapeHtml(value)}" selected>目前值：${escapeHtml(value)}</option>`
    : "";
  return `<option value="" ${value ? "" : "selected"}>—</option>${currentFallback}${sortedOptions.map(([code, label]) =>
    `<option value="${escapeHtml(code)}" ${code === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("")}`;
}

function renderOptionPicker(resetCursor = true) {
  const keyword = $("#optionPickerSearch").value.trim().toLocaleLowerCase("zh-Hant");
  const tokens = keyword.split(/\s+/).filter(Boolean);
  const currentValue = state.picker.target?.value ?? "";
  const filtered = state.picker.options
    .map((option, index) => ({ option, index }))
    .filter(({ option: [value, label] }) => {
      const haystack = `${label} ${value}`.toLocaleLowerCase("zh-Hant");
      return tokens.every((token) => haystack.includes(token));
    });
  state.picker.filteredIndexes = filtered.map(({ index }) => index);
  if (resetCursor) {
    const currentIndex = filtered.findIndex(({ option: [value] }) => value === currentValue);
    state.picker.cursor = Math.max(0, currentIndex);
  } else if (state.picker.cursor >= filtered.length) {
    state.picker.cursor = Math.max(0, filtered.length - 1);
  }
  $("#optionPickerSummary").textContent = keyword
    ? `${filtered.length.toLocaleString()}／${state.picker.options.length.toLocaleString()} 筆`
    : `${state.picker.options.length.toLocaleString()} 筆`;
  const recentIndexes = pickerRecentValues(state.picker.key)
    .map((value) => state.picker.options.findIndex(([code]) => code === value))
    .filter((index) => index >= 0);
  const recent = $("#optionPickerRecent");
  recent.hidden = Boolean(keyword) || !recentIndexes.length;
  recent.innerHTML = recent.hidden ? "" : `<span class="recent-label">最近使用</span>${recentIndexes.map((index) => {
    const [value, label] = state.picker.options[index];
    return `<button class="recent-option" type="button" data-picker-recent="${index}" title="${escapeHtml(`${label}（${value}）`)}">${escapeHtml(label)}</button>`;
  }).join("")}`;
  $("#optionPickerList").innerHTML = filtered.length
    ? filtered.map(({ option: [value, label], index }, filteredIndex) => `<button class="picker-option ${value === currentValue ? "active" : ""} ${filteredIndex === state.picker.cursor ? "keyboard-focus" : ""}" type="button" role="option" aria-selected="${value === currentValue}" data-picker-option="${index}">
        <span>${escapeHtml(label)}</span><code>${escapeHtml(value)}</code>
      </button>`).join("")
    : `<div class="picker-empty">找不到符合的選項</div>`;
}

function openOptionPicker(target, title, options, key = "") {
  state.picker = { target, title, options: sortOptionsByName(options), key, filteredIndexes: [], cursor: 0 };
  $("#optionPickerTitle").textContent = title;
  $("#optionPickerSearch").value = "";
  renderOptionPicker();
  $("#optionPickerDialog").showModal();
  $("#optionPickerSearch").focus();
  window.requestAnimationFrame(() => {
    $("#optionPickerList").querySelector(".keyboard-focus")?.scrollIntoView({ block: "center" });
  });
}

function choosePickerValue(value, label = "") {
  const target = state.picker.target;
  rememberPickerValue(state.picker.key, value);
  $("#optionPickerDialog").close();
  if (!target?.isConnected) return;
  target.value = value;
  updatePickerDisplay(target, value, label);
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

function updatePickerDisplay(target, value, label = "") {
  const container = target.closest(".field, td");
  const labelElement = container?.querySelector("[data-picker-display-label]");
  const codeElement = container?.querySelector("[data-picker-display-code]");
  const bulkLabel = container?.querySelector("[data-picker-selected-label]");
  if (labelElement) labelElement.textContent = label || (value ? "自訂代碼" : "請選擇");
  if (codeElement) codeElement.textContent = value || "";
  if (bulkLabel) bulkLabel.textContent = label || (value ? "自訂代碼" : "");
}

function movePickerCursor(direction) {
  const count = state.picker.filteredIndexes.length;
  if (!count) return;
  state.picker.cursor = (state.picker.cursor + direction + count) % count;
  renderOptionPicker(false);
  $("#optionPickerList").querySelector(".keyboard-focus")?.scrollIntoView({ block: "nearest" });
}

function copyMappedValues(record, pairs) {
  for (const [source, target] of pairs) record[target] = record[source] ?? "";
  return record;
}

function copyCurrentValuesToOld(table) {
  const record = currentRecord();
  const pairs = COPY_CURRENT_TO_OLD[table];
  if (!record || !pairs || state.activeTable !== table) return;
  copyMappedValues(record, pairs);
  setStatus(`已將本次資料帶入 ${TABLE_CONFIG[table].label} 的原核准欄位`, "warn");
  toast(`已帶入 ${pairs.length} 個欄位；本次空白值也已同步為空白。`);
  renderEditor();
}

function renderField(field, record, table) {
  const value = record[field.name] ?? "";
  const classes = ["field", field.wide ? "wide" : "", field.full ? "full" : ""].filter(Boolean).join(" ");
  const fieldId = `f-${table}-${field.name}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const optionField = field.kind === "code" || field.kind === "yn";
  const options = optionField ? pickerOptionsForField(table, field, record) : [];
  const pickerField = optionField && useModalForOptions(options);
  const labelFor = pickerField ? `${fieldId}-picker` : fieldId;
  let control;
  if (field.multiline) {
    control = `<textarea id="${fieldId}" data-field="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea>`;
  } else if (optionField && !pickerField) {
    control = `<select class="compact-option-select" id="${fieldId}" data-field="${field.name}" aria-label="${escapeHtml(field.label)}">
      ${renderInlineOptionMarkup(options, value)}
    </select>`;
  } else if (pickerField) {
    const selectedLabel = options.find(([code]) => code === value)?.[1] || "";
    const displayLabel = selectedLabel || (value ? "自訂代碼" : (options.length ? "請選擇" : "請先選擇上層資料"));
    control = `<div class="picker-control">
      <button class="picker-open-button" id="${fieldId}-picker" type="button" data-open-picker="${field.name}" aria-label="選擇${escapeHtml(field.label)}">
        <span class="picker-display-label" data-picker-display-label>${escapeHtml(displayLabel)}</span>
        <code class="picker-display-code" data-picker-display-code>${escapeHtml(value)}</code>
        <span class="picker-chevron" aria-hidden="true">⌄</span>
      </button>
      <input class="picker-code-input" id="${fieldId}" data-field="${field.name}" value="${escapeHtml(value)}" autocomplete="off" aria-label="${escapeHtml(field.label)}原始代碼">
    </div>`;
  } else {
    control = `<input id="${fieldId}" data-field="${field.name}" value="${escapeHtml(value)}"
      ${field.kind === "number" ? 'inputmode="decimal"' : ""} placeholder="${escapeHtml(field.placeholder || "")}">`;
  }
  return `<div class="${classes}" data-search="${escapeHtml(`${field.label} ${field.name}`.toLowerCase())}">
    <div class="field-label"><label for="${labelFor}">${escapeHtml(field.label)}</label><code class="raw-field">${field.name}</code>${field.hint ? `<button class="field-info" type="button" title="${escapeHtml(field.hint)}" aria-label="${escapeHtml(`${field.label}：${field.hint}`)}">?</button>` : ""}</div>
    ${control}
  </div>`;
}

function sectionOpenKey(table, index) {
  return `${table}.${index}`;
}

function sectionStartsOpen(table, section, index) {
  const key = sectionOpenKey(table, index);
  return Object.hasOwn(state.sectionOpen, key) ? state.sectionOpen[key] : !section.old;
}

function renderEditor() {
  const config = TABLE_CONFIG[state.activeTable];
  const record = currentRecord();
  $("#tableRawName").textContent = state.activeTable;
  $("#tableTitle").textContent = config.label;
  $("#formChips").innerHTML = `<span class="form-usage" title="${escapeHtml(config.forms.join("、"))}">使用於 ${config.forms.length} 份書表</span>`;
  $("#tableNotice").hidden = !config.notice;
  $("#tableNotice").open = false;
  $("#tableNoticeText").textContent = config.notice || "";
  $("#emptyState").hidden = Boolean(record);
  $("#editorForm").hidden = !record;
  if (!record) {
    $("#fieldGroups").innerHTML = "";
    $("#fieldCount").textContent = "0 欄";
    syncSectionToggleButton();
    return;
  }
  $("#fieldGroups").innerHTML = config.sections.map((section, index) => `<details class="field-section ${section.old ? "old-section" : ""}" data-section-index="${index}" ${sectionStartsOpen(state.activeTable, section, index) ? "open" : ""}>
    <summary class="section-heading"><h3>${escapeHtml(section.title)}</h3></summary>
    <div class="section-body">
      ${section.copyCurrent ? `<div class="section-actions"><button class="button secondary compact section-copy-button" type="button" data-copy-current="${section.copyCurrent}">${escapeHtml(section.copyLabel)}</button></div>` : ""}
      ${section.note ? `<details class="section-help"><summary>填寫說明</summary><p>${escapeHtml(section.note)}</p></details>` : ""}
      <div class="field-grid">${section.fields.map((field) => renderField(field, record, state.activeTable)).join("")}</div>
    </div>
  </details>`).join("");
  $("#fieldCount").textContent = `${allFields(state.activeTable).length} 欄`;
  $$("[data-field]").forEach((control) => {
    control.addEventListener("input", handleFieldInput);
    control.addEventListener("change", handleFieldInput);
  });
  $$("[data-open-picker]").forEach((button) => button.addEventListener("click", () => {
    const field = fieldDefinition(state.activeTable, button.dataset.openPicker);
    const record = currentRecord();
    const target = button.closest(".field").querySelector("[data-field]");
    openOptionPicker(target, field.label, pickerOptionsForField(state.activeTable, field, record), `${state.activeTable}.${field.name}`);
  }));
  $$("[data-copy-current]").forEach((button) => button.addEventListener("click", () => copyCurrentValuesToOld(button.dataset.copyCurrent)));
  $$(".field-info").forEach((button) => button.addEventListener("click", () => toast(button.title)));
  $$(".field-section").forEach((section) => section.addEventListener("toggle", () => {
    state.sectionOpen[sectionOpenKey(state.activeTable, Number(section.dataset.sectionIndex))] = section.open;
    syncSectionToggleButton();
  }));
  applyFieldSearch();
  syncSectionToggleButton();
}

function renderAll() {
  renderNav();
  renderRecordControls();
  renderEditor();
  applyRawFieldVisibility();
}

function handleFieldInput(event) {
  const record = currentRecord();
  if (!record) return;
  const field = event.currentTarget.dataset.field;
  record[field] = event.currentTarget.value;
  if (state.activeTable === "BMSBASE" && field === "INDEX_KEY") {
    for (const rows of Object.values(state.tables)) {
      for (const row of rows) if (Object.hasOwn(row, "INDEX_KEY")) row.INDEX_KEY = record.INDEX_KEY;
    }
  }
  if (state.activeTable === "BMSBASE" && field === "BMPAS" && !record.GOV) record.GOV = record.BMPAS;
  hydrateDerived(state.activeTable, record, field);
  // When a code auto-fills a paired description/helper value, reflect it in
  // the visible form immediately without rebuilding the whole record view.
  $$("[data-field]").forEach((control) => {
    if (control !== event.currentTarget && control.value !== (record[control.dataset.field] ?? "")) {
      control.value = record[control.dataset.field] ?? "";
    }
    const definition = fieldDefinition(state.activeTable, control.dataset.field);
    if (["code", "yn"].includes(definition.kind)) {
      const pickerValue = record[control.dataset.field] ?? "";
      const label = pickerOptionsForField(state.activeTable, definition, record).find(([code]) => code === pickerValue)?.[1] || "";
      updatePickerDisplay(control, pickerValue, label);
    }
  });
  setStatus("資料已修改，尚未匯出", "warn");
  if (event.type === "change" && ["BMPAS", "DIST", "DIST_OLD"].includes(field)) renderEditor();
}

function selectedCodeLabel(table, field, value, record) {
  return optionsFor(table, field, record).find(([code]) => code === value)?.[1] || "";
}

function hydrateDerived(table, record, changedField = "") {
  const codeMap = {
    "BMSBASE.USAGE_CODE": ["USAGE_CODE_DESC", { "01": "住宅" }],
    "BMSMEMO.MEMO_SEQ": ["MEMO_SEQ_NAME", { M591: "火災警報器", M2Q1: "污水用戶", M161: "地質敏感" }],
  };
  const direct = codeMap[`${table}.${changedField}`];
  if (direct && !record[direct[0]]) {
    record[direct[0]] = selectedCodeLabel(table, changedField, record[changedField], record) || direct[1][record[changedField]] || "";
  }

  if (table === "BMSP01" && /^BLD_CODE[123]$/.test(changedField)) {
    const number = changedField.slice(-1);
    const code = record[changedField];
    const desc = `BLD_CODE${number}_DESC`;
    const helper = `BLD_CODE${number}_T`;
    if (!record[desc]) record[desc] = selectedCodeLabel(table, changedField, code, record).replace(/[【】]/g, "") || (code === "H2" ? "住宅" : code === "00" ? "其他" : "");
    if (!record[helper]) record[helper] = code === "00" ? "其他" : code;
  }
  if (table === "BMSSTAIR" && /^USAGE_CODE[123](?:_OLD)?$/.test(changedField)) {
    const old = changedField.endsWith("_OLD");
    const base = old ? changedField.slice(0, -4) : changedField;
    const number = base.match(/\d/)[0];
    const code = record[changedField];
    const desc = `USAGE_CODE${number}_DESC${old ? "_OLD" : ""}`;
    const helper = `USAGE_CODE${number}${old ? "_OLD" : ""}_T`;
    if (!record[desc]) record[desc] = selectedCodeLabel(table, changedField, code, record).replace(/[【】]/g, "") || (code === "H2" ? "住宅" : code === "00" ? "其他" : "");
    if (!record[helper]) record[helper] = code === "00" ? "其他" : code;
  }
}

function blankRecord(table) {
  const record = {};
  for (const field of state.bootstrap.fieldOrder[table]) record[field] = "";
  const baseKey = state.tables.BMSBASE?.[0]?.INDEX_KEY || "";
  if (Object.hasOwn(record, "INDEX_KEY")) record.INDEX_KEY = baseKey;
  return record;
}

function addRecord(copyCurrent = false) {
  const rows = currentRows();
  let record = copyCurrent && currentRecord() ? deepClone(currentRecord()) : blankRecord(state.activeTable);
  for (const key of ["識別碼", "CR_DATE", "UP_DATE", "OP_USER"]) if (Object.hasOwn(record, key)) record[key] = "";
  for (const key of ["person_seq", "Person_seq", "PERSON_SEQ"]) if (Object.hasOwn(record, key)) record[key] = String(rows.length + 1);
  if (Object.hasOwn(record, "SPOKESMAN")) record.SPOKESMAN = rows.length ? "N" : "Y";
  rows.push(record);
  state.activeRecord = rows.length - 1;
  setStatus(copyCurrent ? "已複製一筆記錄" : "已新增一筆空白記錄", "warn");
  renderAll();
}

function deleteRecord() {
  const rows = currentRows();
  if (!rows.length || !state.bootstrap.tableMeta[state.activeTable]?.repeatable) return;
  const caption = recordCaption(state.activeTable, rows[state.activeRecord], state.activeRecord);
  if (!window.confirm(`確定刪除「${caption}」？`)) return;
  rows.splice(state.activeRecord, 1);
  state.activeRecord = Math.max(0, state.activeRecord - 1);
  setStatus("已刪除一筆記錄", "warn");
  renderAll();
}

function clearTableData(table) {
  const repeatable = Boolean(state.bootstrap.tableMeta[table]?.repeatable);
  state.tables[table] = repeatable ? [] : [blankRecord(table)];
  return state.tables[table];
}

function openClearCurrentTableDialog() {
  const table = state.activeTable;
  const rows = state.tables[table] || [];
  if (!rows.length) return;
  const label = TABLE_CONFIG[table].label;
  const repeatable = Boolean(state.bootstrap.tableMeta[table]?.repeatable);
  state.pendingClearTable = table;
  $("#clearTableDialogTitle").textContent = `清空「${label}」`;
  $("#clearTableMessage").textContent = repeatable
    ? `確定要清除這一頁目前的 ${rows.length} 筆資料嗎？`
    : "確定要清除這一頁所有已填內容嗎？案件的系統連結主鍵會保留。";
  $("#clearTableDialog").showModal();
}

function confirmClearCurrentTable() {
  const table = state.pendingClearTable;
  if (!table || !TABLE_CONFIG[table]) return;
  const label = TABLE_CONFIG[table].label;
  clearTableData(table);
  state.activeTable = table;
  state.activeRecord = 0;
  $("#clearTableDialog").close();
  renderAll();
  setStatus(`已清空「${label}」，尚未匯出`, "warn");
  toast(`已清空「${label}」`);
}

function fieldDefinition(table, fieldName) {
  return allFields(table).find((field) => field.name === fieldName) || F(fieldName, fieldName);
}

function normalizeRowMetadata(table) {
  const rows = state.tables[table] || [];
  rows.forEach((record, index) => {
    for (const field of ["person_seq", "Person_seq", "PERSON_SEQ"]) {
      if (Object.hasOwn(record, field)) record[field] = String(index + 1);
    }
    if (Object.hasOwn(record, "SPOKESMAN")) record.SPOKESMAN = index === 0 ? "Y" : "N";
  });
}

function addBulkRows(count) {
  const table = state.activeTable;
  const rows = state.tables[table];
  for (let index = 0; index < count; index += 1) rows.push(blankRecord(table));
  state.bulkDirty = true;
  normalizeRowMetadata(table);
  renderBulkTable();
  setStatus(`已在 ${table} 新增 ${count} 列`, "warn");
}

function renderBulkControl(table, field, record, rowIndex, columnIndex) {
  const value = record[field.name] ?? "";
  const controlId = `bulk-${table}-${rowIndex}-${field.name}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const common = `data-bulk-row="${rowIndex}" data-bulk-col="${columnIndex}" data-bulk-field="${field.name}"`;
  if (field.multiline || field.name === "DESE") {
    return `<textarea ${common}>${escapeHtml(value)}</textarea>`;
  }
  const optionField = field.kind === "code" || field.kind === "yn";
  const options = optionField ? pickerOptionsForField(table, field, record) : [];
  const pickerField = optionField && useModalForOptions(options);
  if (optionField && !pickerField) {
    return `<select class="compact-option-select" id="${controlId}" ${common} aria-label="${escapeHtml(field.label)}">
      ${renderInlineOptionMarkup(options, value)}
    </select>`;
  }
  if (pickerField) {
    const label = options.find(([code]) => code === value)?.[1] || "";
    return `<div class="bulk-picker-input-row">
      <input id="${controlId}" ${common} value="${escapeHtml(value)}" autocomplete="off">
      <button class="bulk-picker-button" type="button" data-open-bulk-picker="${field.name}" data-bulk-picker-row="${rowIndex}" aria-label="選擇${escapeHtml(field.label)}" title="選擇${escapeHtml(field.label)}">⌄</button>
    </div>
    <small class="bulk-code-label" data-picker-selected-label title="${escapeHtml(label)}">${escapeHtml(label || (value ? "自訂代碼" : ""))}</small>`;
  }
  return `<input id="${controlId}" ${common} value="${escapeHtml(value)}" ${field.kind === "number" ? 'inputmode="decimal"' : ""}>`;
}

function bulkColumnClass(field) {
  if (field.multiline || field.name === "DESE") return "bulk-col-long";
  if (field.kind === "code" || field.kind === "yn") return "bulk-col-code";
  if (field.kind === "number") return "bulk-col-number";
  return "bulk-col-text";
}

function renderBulkTable() {
  const table = state.activeTable;
  const fieldNames = BULK_FIELDS[table] || [];
  const fields = fieldNames.map((name) => fieldDefinition(table, name));
  const rows = state.tables[table] || [];
  $("#bulkDialogTitle").textContent = `${TABLE_CONFIG[table].label} — 批次表格`;
  $("#bulkTableArea").innerHTML = `<table class="bulk-table">
    <thead><tr><th>選取</th><th>#</th>${fields.map((field) => `<th class="${bulkColumnClass(field)}" title="${field.name}">${escapeHtml(field.label)}<small class="nav-raw">${field.name}</small></th>`).join("")}</tr></thead>
    <tbody>${rows.map((record, rowIndex) => `<tr>
      <td><input type="checkbox" data-bulk-select="${rowIndex}" aria-label="選取第 ${rowIndex + 1} 列"></td>
      <td>${rowIndex + 1}</td>
      ${fields.map((field, columnIndex) => `<td class="${bulkColumnClass(field)}">${renderBulkControl(table, field, record, rowIndex, columnIndex)}</td>`).join("")}
    </tr>`).join("")}</tbody>
  </table>`;

  $$('[data-bulk-field]').forEach((control) => {
    const update = (event) => {
      const row = state.tables[table][Number(control.dataset.bulkRow)];
      row[control.dataset.bulkField] = control.value;
      hydrateDerived(table, row, control.dataset.bulkField);
      state.bulkDirty = true;
      setStatus("批次表格已修改，尚未匯出", "warn");
      if (event.type === "change" && (codeSpecFor(table, control.dataset.bulkField) || ["DIST", "DIST_OLD"].includes(control.dataset.bulkField))) {
        const area = $("#bulkTableArea");
        const top = area.scrollTop, left = area.scrollLeft;
        renderBulkTable();
        $("#bulkTableArea").scrollTop = top;
        $("#bulkTableArea").scrollLeft = left;
      }
    };
    control.addEventListener("input", update);
    control.addEventListener("change", update);
    control.addEventListener("paste", handleBulkPaste);
  });
  $$('[data-open-bulk-picker]').forEach((button) => button.addEventListener("click", () => {
    const row = state.tables[table][Number(button.dataset.bulkPickerRow)];
    const field = fieldDefinition(table, button.dataset.openBulkPicker);
    const target = button.parentElement.querySelector("[data-bulk-field]");
    openOptionPicker(target, field.label, pickerOptionsForField(table, field, row), `${table}.${field.name}`);
  }));
  $$('[data-bulk-select]').forEach((checkbox) => checkbox.addEventListener("change", syncBulkSelectAllButton));
  syncBulkSelectAllButton();
}

function parseClipboardMatrix(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = text.includes("\t") ? "\t" : (firstLine.includes(",") ? "," : "\t");
  const matrix = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); matrix.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); matrix.push(row); }
  return matrix.filter((cells) => cells.some((value) => value !== ""));
}

function handleBulkPaste(event) {
  const text = event.clipboardData?.getData("text/plain") || "";
  if (!text.includes("\t") && !text.includes("\n") && !text.includes(",")) return;
  event.preventDefault();
  const table = state.activeTable;
  const fieldNames = BULK_FIELDS[table];
  const fields = fieldNames.map((name) => fieldDefinition(table, name));
  const matrix = parseClipboardMatrix(text);
  if (!matrix.length) return;
  const headerTargets = matrix[0].map((heading) => fields.find((field) => [normalizeName(field.name), normalizeName(field.label)].includes(normalizeName(heading)))?.name || "");
  const hasHeader = headerTargets.some(Boolean);
  const sourceRows = hasHeader ? matrix.slice(1) : matrix;
  const startRow = Number(event.currentTarget.dataset.bulkRow);
  const startColumn = Number(event.currentTarget.dataset.bulkCol);
  while (state.tables[table].length < startRow + sourceRows.length) state.tables[table].push(blankRecord(table));
  sourceRows.forEach((sourceRow, rowOffset) => {
    const target = state.tables[table][startRow + rowOffset];
    sourceRow.forEach((value, sourceColumn) => {
      const targetField = hasHeader ? headerTargets[sourceColumn] : fieldNames[startColumn + sourceColumn];
      if (!targetField) return;
      target[targetField] = value.trim();
      hydrateDerived(table, target, targetField);
    });
  });
  state.bulkDirty = true;
  normalizeRowMetadata(table);
  renderBulkTable();
  setStatus(`已從剪貼簿貼上 ${sourceRows.length} 列到 ${table}`, "warn");
  toast(`已貼上 ${sourceRows.length} 列；可繼續在表格內修正。`);
}

function selectedBulkIndexes() {
  return $$('[data-bulk-select]:checked').map((checkbox) => Number(checkbox.dataset.bulkSelect));
}

function syncBulkSelectAllButton() {
  const checkboxes = $$('[data-bulk-select]');
  const allSelected = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
  const button = $("#bulkToggleAllButton");
  button.disabled = !checkboxes.length;
  button.textContent = allSelected ? "取消全選" : "全選";
  button.setAttribute("aria-pressed", String(allSelected));
}

function toggleAllBulkRows() {
  const checkboxes = $$('[data-bulk-select]');
  if (!checkboxes.length) return;
  const selectAll = !checkboxes.every((checkbox) => checkbox.checked);
  for (const checkbox of checkboxes) checkbox.checked = selectAll;
  syncBulkSelectAllButton();
}

function duplicateBulkRows() {
  const selected = selectedBulkIndexes();
  if (!selected.length) { toast("請先勾選要複製的列。", "error"); return; }
  const table = state.activeTable;
  for (const index of selected) {
    const record = deepClone(state.tables[table][index]);
    for (const field of ["識別碼", "CR_DATE", "UP_DATE", "OP_USER"]) if (Object.hasOwn(record, field)) record[field] = "";
    state.tables[table].push(record);
  }
  state.bulkDirty = true;
  normalizeRowMetadata(table);
  renderBulkTable();
  setStatus(`已複製 ${selected.length} 列`, "warn");
}

function deleteBulkRows() {
  const selected = selectedBulkIndexes();
  if (!selected.length) { toast("請先勾選要刪除的列。", "error"); return; }
  if (!window.confirm(`確定刪除勾選的 ${selected.length} 列？`)) return;
  const table = state.activeTable;
  for (const index of selected.sort((a, b) => b - a)) state.tables[table].splice(index, 1);
  state.bulkDirty = true;
  normalizeRowMetadata(table);
  renderBulkTable();
  setStatus(`已刪除 ${selected.length} 列`, "warn");
}

function openBulkEditor() {
  if (!BULK_FIELDS[state.activeTable]) return;
  state.bulkDirty = false;
  if (!currentRows().length) addBulkRows(1);
  renderBulkTable();
  $("#bulkDialog").showModal();
}

function applyRawFieldVisibility() {
  document.body.classList.toggle("show-raw", state.showRawFields);
  const button = $("#toggleRawFieldsButton");
  button.textContent = state.showRawFields ? "隱藏原始欄名" : "顯示原始欄名";
  button.setAttribute("aria-pressed", String(state.showRawFields));
}

function toggleRawFieldVisibility() {
  state.showRawFields = !state.showRawFields;
  storageSet("cpami-show-raw-fields", state.showRawFields ? "1" : "0");
  applyRawFieldVisibility();
}

function syncSectionToggleButton() {
  const sections = $$(".field-section").filter((section) => !section.hidden);
  const button = $("#toggleSectionsButton");
  button.disabled = !sections.length;
  button.textContent = sections.some((section) => section.open) ? "全部收合" : "全部展開";
}

function toggleAllSections() {
  const sections = $$(".field-section").filter((section) => !section.hidden);
  if (!sections.length) return;
  const open = !sections.some((section) => section.open);
  for (const section of sections) {
    section.open = open;
    state.sectionOpen[sectionOpenKey(state.activeTable, Number(section.dataset.sectionIndex))] = open;
  }
  syncSectionToggleButton();
}

function applyFieldSearch() {
  const query = $("#fieldSearch").value.trim().toLowerCase();
  let visible = 0;
  $$(".field[data-search]").forEach((field) => {
    const show = !query || field.dataset.search.includes(query);
    field.hidden = !show;
    if (show) visible += 1;
  });
  $$(".field-section").forEach((section) => {
    const hasVisible = section.querySelector(".field[data-search]:not([hidden])");
    section.hidden = !hasVisible;
    if (query && hasVisible) section.open = true;
  });
  if (currentRecord()) {
    const total = allFields(state.activeTable).length;
    $("#fieldCount").textContent = query ? `${visible}／${total} 欄` : `${total} 欄`;
  }
  syncSectionToggleButton();
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || (data.errors || []).join("\n") || "操作失敗");
  return data;
}

async function loadDataTxt(file) {
  setStatus("正在解析 CP950 data.txt…", "warn");
  try {
    const data = await apiJson("/api/import-data-txt", { method: "POST", body: await file.arrayBuffer() });
    state.tables = data.tables;
    state.sourceName = file.name;
    state.activeTable = "BMSBASE";
    state.activeRecord = 0;
    renderAll();
    setStatus(`已載入 ${file.name}，13 表結構正確`, data.validation.ok ? "ok" : "warn");
    toast("data.txt 已載入；原始欄位與未顯示欄位也會完整保留。 ");
  } catch (error) {
    setStatus("data.txt 載入失敗", "error");
    toast(error.message, "error");
  } finally {
    $("#dataFileInput").value = "";
  }
}

function newBlankCase() {
  if (!window.confirm("建立新空白案件會清除目前畫面中的所有案件資料；尚未匯出的修改不會保留。確定繼續？")) return;
  const emptyTables = {};
  for (const table of state.bootstrap.tableOrder) emptyTables[table] = [];
  state.tables = emptyTables;
  const base = blankRecord("BMSBASE");
  base.SEQ_NO = "1";
  base.LAST_MODIFY = "00001";
  base.PUBLIC_CODE = "N";
  base.LINK_TYPE = "N";
  base.TempBuild = "N";
  state.tables.BMSBASE = [base];
  state.activeTable = "BMSBASE";
  state.activeRecord = 0;
  state.sourceName = "新空白案件";
  renderAll();
  setStatus("已建立空白案件；BM_TEC、BMSSC 與所有子表均已清空", "warn");
  toast("請先填案件主檔，再新增地號、人員、樓層等資料。 ");
}

function validationHtml(result) {
  const errorBlock = result.errors?.length ? `<div class="result-block errors"><h3>錯誤（必須修正）</h3><ul>${result.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
  const warningBlock = result.warnings?.length ? `<div class="result-block warnings"><h3>提醒（建議確認）</h3><ul>${result.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
  return errorBlock + warningBlock + (!errorBlock && !warningBlock ? `<div class="muted-box">沒有發現格式或欄位一致性問題。</div>` : "");
}

function showValidation(result) {
  const summary = $("#validationSummary");
  summary.className = `validation-summary ${result.ok ? "ok" : "error"}`;
  summary.textContent = result.ok
    ? `格式可匯出：0 個錯誤，${result.warnings.length} 個提醒。`
    : `目前不能匯出：${result.errors.length} 個錯誤，${result.warnings.length} 個提醒。`;
  $("#validationResults").innerHTML = validationHtml(result);
  $("#validationDialog").showModal();
}

async function validateData(showDialog = true) {
  try {
    const result = await apiJson("/api/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tables: state.tables }),
    });
    if (showDialog) showValidation(result);
    setStatus(result.ok ? `資料格式可匯出（${result.warnings.length} 個提醒）` : `資料有 ${result.errors.length} 個錯誤`, result.ok ? (result.warnings.length ? "warn" : "ok") : "error");
    return result;
  } catch (error) {
    toast(error.message, "error");
    return null;
  }
}

async function exportDataTxt() {
  setStatus("正在驗證並產生 CP950 data.txt…", "warn");
  try {
    const response = await fetch("/api/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tables: state.tables }),
    });
    if (!response.ok) {
      const result = await response.json();
      if (result.errors) showValidation(result);
      else throw new Error(result.error || "匯出失敗");
      setStatus("匯出前檢查未通過", "error");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "data.txt";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus(`已匯出 data.txt（CP950，${blob.size.toLocaleString()} bytes）`, "ok");
    toast("data.txt 已產生：13 表、固定欄序、CRLF、CP950。 ");
  } catch (error) {
    setStatus("匯出失敗", "error");
    toast(error.message, "error");
  }
}

function decodeSource(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    try {
      return new TextDecoder("big5", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("來源檔既不是有效 UTF-8，也不是有效 Big5/CP950。 ");
    }
  }
}

function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const candidates = [",", "\t", ";"];
  const delimiter = candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const useful = rows.filter((cells) => cells.some((value) => value.trim() !== ""));
  if (useful.length < 2) throw new Error("CSV／TSV 至少需要標題列與一筆資料。 ");
  const headers = useful[0].map((value, index) => value.trim() || `欄位${index + 1}`);
  const records = useful.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  return { headers, records, description: `${delimiter === "\t" ? "TSV" : "CSV"}：${records.length} 筆、${headers.length} 欄` };
}

function flattenElement(element) {
  const output = {};
  const leaves = [...element.querySelectorAll("*")].filter((node) => !node.children.length);
  if (!leaves.length) output[element.localName] = element.textContent.trim();
  for (const leaf of leaves) {
    let key = leaf.localName;
    if (Object.hasOwn(output, key)) {
      const parent = leaf.parentElement && leaf.parentElement !== element ? leaf.parentElement.localName : "欄位";
      key = `${parent}.${leaf.localName}`;
    }
    output[key] = leaf.textContent.trim();
  }
  for (const attribute of element.attributes) output[`@${attribute.name}`] = attribute.value;
  return output;
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error(`XML 無法解析：${parserError.textContent.trim().slice(0, 160)}`);
  const root = doc.documentElement;
  const groups = new Map();
  for (const element of root.querySelectorAll("*")) {
    if (!groups.has(element.localName)) groups.set(element.localName, []);
    groups.get(element.localName).push(element);
  }
  const candidates = [...groups.values()].filter((items) => items.length > 1 && items.some((item) => item.children.length));
  let elements;
  if (candidates.length) elements = candidates.sort((a, b) => b.length - a.length)[0];
  else if (root.children.length) elements = [...root.children];
  else elements = [root];
  const records = elements.map(flattenElement);
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return { headers, records, description: `XML：以 <${elements[0].localName}> 為一筆，共 ${records.length} 筆、${headers.length} 欄` };
}

function normalizeName(value) {
  return String(value).toUpperCase().replace(/[\s_.\-\/（）()：:]/g, "");
}

const SOURCE_ALIASES = {
  工程名稱: "BUILDING_NAME", 縣市代碼: "BMPAS", 主管機關代碼: "GOV", 申請類型: "APPLY_TYPE",
  行政區: "DIST", 行政區代碼: "DIST", 地段: "SECTION", 地段代碼: "SECTION", 地號母號: "ROAD_NO1", 地號子號: "ROAD_NO2",
  土地總面積: "TOT_AREA", 使用面積: "USE_AREA", 所有權人: "owner", 所有權人姓名: "owner", 所有權人統編: "owner_id",
  起造人: "CNAME", 起造人姓名: "CNAME", 姓名: "CNAME", 統一編號: "IDENTIFY_NO", 身分證號: "IDENTIFY_NO",
  樓層代碼: "STORY_CODE", 樓層面積: "STORY_AREA", 層高: "STORY_HEIGHT", 工作物名稱: "CONSNAME",
};

function targetFieldOptions(table) {
  return TABLE_CONFIG[table].sections.flatMap((section) => section.fields.map((field) => ({ ...field, section: section.title })));
}

function guessTarget(table, sourceHeader) {
  const fields = targetFieldOptions(table);
  const normalized = normalizeName(sourceHeader);
  const alias = SOURCE_ALIASES[sourceHeader.trim()];
  if (alias && fields.some((field) => field.name === alias)) return alias;
  return fields.find((field) => normalizeName(field.name) === normalized)?.name
    || fields.find((field) => normalizeName(field.label) === normalized)?.name
    || "";
}

async function readSourceFile(file) {
  const text = decodeSource(await file.arrayBuffer());
  const parsed = file.name.toLowerCase().endsWith(".xml") || text.trimStart().startsWith("<") ? parseXml(text) : parseDelimited(text);
  state.sourceRows = parsed.records;
  state.sourceHeaders = parsed.headers;
  state.mappings = {};
  const table = $("#targetTableSelect").value;
  for (const header of parsed.headers) state.mappings[header] = guessTarget(table, header);
  $("#sourcePreview").textContent = `${file.name}｜${parsed.description}。文字已以 UTF-8 優先、Big5 備援解碼。`;
  renderMappingTable();
}

function renderMappingTable() {
  const table = $("#targetTableSelect").value;
  const fields = targetFieldOptions(table);
  if (!state.sourceHeaders.length) {
    $("#mappingArea").innerHTML = "";
    $("#applyMappingButton").disabled = true;
    return;
  }
  const options = [`<option value="">（略過此來源欄）</option>`];
  let lastSection = "";
  for (const field of fields) {
    if (field.section !== lastSection) {
      if (lastSection) options.push("</optgroup>");
      options.push(`<optgroup label="${escapeHtml(field.section)}">`);
      lastSection = field.section;
    }
    options.push(`<option value="${field.name}">${escapeHtml(field.label)} — ${field.name}</option>`);
  }
  if (lastSection) options.push("</optgroup>");
  $("#mappingArea").innerHTML = `<table class="mapping-table">
    <thead><tr><th>來源欄位</th><th>第一筆樣本</th><th>data.txt 目標欄位</th></tr></thead>
    <tbody>${state.sourceHeaders.map((header) => `<tr>
      <td><strong>${escapeHtml(header)}</strong></td>
      <td class="sample-cell" title="${escapeHtml(state.sourceRows[0]?.[header] || "")}">${escapeHtml(state.sourceRows[0]?.[header] || "（空）")}</td>
      <td><select data-map-header="${escapeHtml(header)}">${options.join("")}</select></td>
    </tr>`).join("")}</tbody>
  </table>`;
  $$('[data-map-header]').forEach((select) => {
    select.value = state.mappings[select.dataset.mapHeader] || "";
    select.addEventListener("change", () => { state.mappings[select.dataset.mapHeader] = select.value; });
  });
  $("#applyMappingButton").disabled = false;
}

function applyMapping() {
  const table = $("#targetTableSelect").value;
  const mappings = Object.entries(state.mappings).filter(([, target]) => target);
  if (!mappings.length) { toast("至少要對應一個來源欄位。", "error"); return; }
  let rows = state.sourceRows.map((source, index) => {
    const record = blankRecord(table);
    for (const [sourceField, targetField] of mappings) record[targetField] = String(source[sourceField] ?? "").trim();
    for (const sequenceField of ["person_seq", "Person_seq", "PERSON_SEQ"]) if (Object.hasOwn(record, sequenceField) && !record[sequenceField]) record[sequenceField] = String(index + 1);
    if (Object.hasOwn(record, "SPOKESMAN") && !record.SPOKESMAN) record.SPOKESMAN = index ? "N" : "Y";
    for (const targetField of mappings.map(([, target]) => target)) hydrateDerived(table, record, targetField);
    return record;
  });
  if (!state.bootstrap.tableMeta[table]?.repeatable) rows = rows.slice(0, 1);
  if ($("#importModeSelect").value === "append" && state.bootstrap.tableMeta[table]?.repeatable) state.tables[table].push(...rows);
  else state.tables[table] = rows;
  state.activeTable = table;
  state.activeRecord = 0;
  state.sourceName = $("#sourceFileInput").files[0]?.name || "CSV／XML";
  $("#convertDialog").close();
  renderAll();
  setStatus(`已將 ${rows.length} 筆來源資料轉入 ${table}`, "warn");
  toast(`已套用 ${mappings.length} 個欄位對應；請檢查代碼與顯示文字。`);
}

const SAMPLE_PATCHES = {
  BMSBASE: [{
    BMPAS: "I80", GOV: "I80", BUILDING_CATEGORY: "01", APPLY_TYPE: "A11-1", BUILDING_NAME: "範例集合住宅新建工程",
    PUBLIC_CODE: "N", LINK_TYPE: "N", TempBuild: "N", BUILDING_LINE_WORD: "範例都測", BUILDING_LINE_NO: "1150000001", BUILDING_DATE: "1150101",
    LAW_COVER_RATE: "60", LAW_SPACE_RATE: "200", BASE_AREA_TOTAL: "1000", STATUTORY_OPEN_SPACE: "400", USE_CATEGORY_CODE1: "0140",
    BUILDING_AREA: "500", TOTAL_CONSTRU_AREA: "1800", BUILD_COVER_RATE: "50", SPACE_RATE: "180", USAGE_CODE: "01", USAGE_CODE_DESC: "住宅",
    BUILDING_KIND1: "10", BUILD_HIHIGHT: "14", CHWANG_NO: "1", BUILDING_NO: "2", UP_FLOOR_NO: "4", DN_FLOOR_NO: "0", TOT_HOUSE_NO: "8", PRICE: "15000000",
    LAW_01: "41", LAW_03: "05", SEQ_NO: "1", LAST_MODIFY: "00001",
  }],
  BMSLAN: [
    { SPOKESMAN: "Y", DIST: "436", ROAD_NO1: "100", ROAD_NO2: "1", TOT_AREA: "600.5", USE_AREA: "600.5", USE_CATEGORY_CODE1: "0140", LOCATED: "N" },
    { SPOKESMAN: "N", DIST: "436", ROAD_NO1: "100", ROAD_NO2: "2", TOT_AREA: "399.5", USE_AREA: "399.5", USE_CATEGORY_CODE1: "0140", LOCATED: "N" },
  ],
  BMSLANOWNER: [
    { DIST: "436", ROAD_NO1: "100", ROAD_NO2: "1", owner_id: "A123456789", owner: "範例所有權人", TOT_AREA_hold: "600.5", USE_AREA_hold: "600.5", owner_birth: "0700101", owner_add: "臺中市範例區範例路1號", owner_tel: "04-12345678" },
    { DIST: "436", ROAD_NO1: "100", ROAD_NO2: "2", owner_id: "12345678", owner: "範例建設股份有限公司", TOT_AREA_hold: "399.5", USE_AREA_hold: "399.5", owner_add: "臺中市範例區範例路2號", owner_tel: "04-23456789" },
  ],
  BMSMEMO: [{ MEMO_SEQ: "M591", MEMO_SEQ_NAME: "火災警報器", DESE: "這是一則可自行替換的範例備註。" }],
  BMSP01: [
    { SPOKESMAN: "Y", BUILDING_NO: "A1", CHWANG: "1", DONG: "1", FLOOR: "1", HOUSE: "1", CNAME: "範例建設股份有限公司", IDENTIFY_NO: "12345678", TEL_NO: "04-12345678", BLD_CODE1: "H2", BLD_CODE1_DESC: "住宅", BLD_CODE1_T: "H2", O_ADDRADR: "400", O_ADDRAD2: "範例路", O_ADDRAD5: "1", H_ADDRADR: "400", H_ADDRAD2: "範例路", H_ADDRAD5: "1", ADDRADR: "436", ADDRAD2: "範例路", ADDRAD5: "10" },
    { SPOKESMAN: "N", BUILDING_NO: "A2", CHWANG: "1", DONG: "2", FLOOR: "1", HOUSE: "1", CNAME: "範例建設股份有限公司", IDENTIFY_NO: "12345678", TEL_NO: "04-12345678", BLD_CODE1: "H2", BLD_CODE1_DESC: "住宅", BLD_CODE1_T: "H2", ADDRADR: "436", ADDRAD2: "範例路", ADDRAD5: "12" },
  ],
  BMSP02: [{ SPOKESMAN: "Y", CNAME: "王範例", COM_ID_AREA: "M", COM_ID_WORD: "115", COM_ID_NO: "000001", OFFICE_NAME: "範例建築師事務所", COM_ZIP: "400", COM_ADDRESS: "範例路1號", TEL_NO: "04-12345678", eMail: "architect@example.com" }],
  BMSP03: [{ SPOKESMAN: "Y", CNAME: "李範例", COM_ID_AREA: "M", COM_ID_WORD: "115", COM_ID_NO: "000002", OFFICE_NAME: "範例監造建築師事務所", COM_ZIP: "400", COM_ADDRESS: "範例路2號", TEL_NO: "04-23456789" }],
  BMSP04: [{ SPOKESMAN: "Y", COMPANY_NAME: "範例營造股份有限公司", COM_IDNO: "87654321", BOSS: "陳範例", COM_ZIP: "400", COM_ADDRESS: "範例路3號", ARC_REG_WORD: "M", ARC_REG_CLAS: "1", ARC_REG_PRI: "001", ARC_REG_NO: "N00001", TECH_NAME: "林範例", TECH_LIC: "技證字第000001號", SCTNAME: "張範例", SCTNO: "40H0000001" }],
  BMSPARK: [
    { PARK_KIND: "1", CAR_KIND: "1", APPL_KIND: "1", IN_OUT: "1", UP_DOWN: "1", NUM: "8", AREA: "110", AIR_FLAG: "N" },
    { PARK_KIND: "1", CAR_KIND: "2", APPL_KIND: "2", IN_OUT: "2", UP_DOWN: "1", NUM: "12", AREA: "30", AIR_FLAG: "N" },
  ],
  BMSSTAIR: [
    { STORY_CODE: "U0010", USAGE_CODE1: "H2", USAGE_CODE1_DESC: "住宅", USAGE_CODE1_T: "H2", STORY_AREA: "500", STORY_HEIGHT: "3.6", VERANDA_AREA: "20", TERRACE_AREA: "0" },
    { STORY_CODE: "U0020", USAGE_CODE1: "H2", USAGE_CODE1_DESC: "住宅", USAGE_CODE1_T: "H2", STORY_AREA: "480", STORY_HEIGHT: "3.2", VERANDA_AREA: "18", TERRACE_AREA: "0" },
  ],
  BMSWORK: [{ CONSNAME: "圍牆", BUILDING_KIND: "RC造", LENGTH: "50", HEIGHT: "2", WIDE: "0.15", AREA: "100", CONNUM: "1式", DESE: "範例雜項工作物" }],
};

function sampleRowsFor(table) {
  const fields = allFields(table).map((field) => field.name);
  const patches = deepClone(SAMPLE_PATCHES[table] || [{}]);
  if (["BMSLAN", "BMSLANOWNER"].includes(table)) {
    const section = optionsFor(table, "SECTION", { DIST: "436" })[0]?.[0] || "0001";
    patches.forEach((row) => { if (!row.SECTION) row.SECTION = section; });
  }
  return patches.map((patch) => {
    const record = Object.fromEntries(fields.map((field) => [field, ""]));
    Object.assign(record, patch);
    for (const field of Object.keys(patch)) hydrateDerived(table, record, field);
    return record;
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function xmlText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function buildSampleCsv(table) {
  const fields = allFields(table).map((field) => field.name);
  const rows = sampleRowsFor(table);
  const csv = [fields, ...rows.map((row) => fields.map((field) => row[field] ?? ""))]
    .map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return `\uFEFF${csv}`;
}

function buildSampleXml(table) {
  const fields = allFields(table).map((field) => field.name);
  const rows = sampleRowsFor(table);
  const body = rows.map((row) => `  <${table}>\n${fields.map((field) => `    <${field}>${xmlText(row[field])}</${field}>`).join("\n")}\n  </${table}>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CPAMIImport table="${table}">\n${body}\n</CPAMIImport>\n`;
}

function downloadSample(format) {
  const table = $("#sampleTableSelect").value;
  if (format === "csv") {
    downloadTextFile(`CPAMI_${table}_example.csv`, buildSampleCsv(table), "text/csv");
  } else {
    downloadTextFile(`CPAMI_${table}_example.xml`, buildSampleXml(table), "application/xml");
  }
  toast(`已下載 ${table} 的 ${format.toUpperCase()} 範例。`);
}

function updateSampleDescription() {
  const table = $("#sampleTableSelect").value;
  const rows = sampleRowsFor(table);
  $("#sampleDescription").textContent = `${TABLE_CONFIG[table].label}（${table}）：${allFields(table).length} 個可匯入欄位、${rows.length} 筆虛構範例資料。`;
}

function openSampleDialog() {
  $("#sampleTableSelect").value = state.activeTable;
  updateSampleDescription();
  $("#sampleDialog").showModal();
}

async function bootstrap() {
  try {
    const [data, codebook] = await Promise.all([apiJson("/api/bootstrap"), apiJson("/codebook.json")]);
    state.bootstrap = data;
    state.codebook = codebook;
    state.tables = deepClone(data.tables);
    state.showRawFields = storageGet("cpami-show-raw-fields") === "1";
    const tableOptions = Object.entries(TABLE_CONFIG).map(([table, config]) => `<option value="${table}">${escapeHtml(config.label)} — ${table}</option>`).join("");
    $("#targetTableSelect").innerHTML = tableOptions;
    $("#sampleTableSelect").innerHTML = tableOptions;
    renderAll();
    setStatus("資料已就緒，可以開始編輯", "ok");
  } catch (error) {
    setStatus("無法連接本機格式服務", "error");
    toast(error.message, "error");
  }
}

$("#loadDataButton").addEventListener("click", () => $("#dataFileInput").click());
$("#newCaseButton").addEventListener("click", newBlankCase);
$("#dataFileInput").addEventListener("change", (event) => { if (event.target.files[0]) loadDataTxt(event.target.files[0]); });
$("#recordSelect").addEventListener("change", (event) => { state.activeRecord = Number(event.target.value); renderEditor(); });
$("#addRecordButton").addEventListener("click", () => addRecord(false));
$("#copyRecordButton").addEventListener("click", () => addRecord(true));
$("#deleteRecordButton").addEventListener("click", deleteRecord);
$("#bulkEditButton").addEventListener("click", openBulkEditor);
$("#clearCurrentTableButton").addEventListener("click", openClearCurrentTableDialog);
$("#confirmClearTableButton").addEventListener("click", confirmClearCurrentTable);
$("#bulkToggleAllButton").addEventListener("click", toggleAllBulkRows);
$("#bulkAddOneButton").addEventListener("click", () => addBulkRows(1));
$("#bulkAddTenButton").addEventListener("click", () => addBulkRows(10));
$("#bulkDuplicateButton").addEventListener("click", duplicateBulkRows);
$("#bulkDeleteButton").addEventListener("click", deleteBulkRows);
$("#fieldSearch").addEventListener("input", applyFieldSearch);
$("#toggleSectionsButton").addEventListener("click", toggleAllSections);
$("#toggleRawFieldsButton").addEventListener("click", toggleRawFieldVisibility);
$("#validateButton").addEventListener("click", () => validateData(true));
$("#exportButton").addEventListener("click", exportDataTxt);
$("#openConvertButton").addEventListener("click", () => {
  state.sourceRows = []; state.sourceHeaders = []; state.mappings = {};
  $("#sourceFileInput").value = "";
  $("#sourcePreview").textContent = "選擇 CSV、TSV 或 XML 後，這裡會列出來源欄位並自動猜測 data.txt 目標欄位。";
  $("#mappingArea").innerHTML = "";
  $("#applyMappingButton").disabled = true;
  $("#targetTableSelect").value = state.activeTable;
  $("#convertDialog").showModal();
});
$("#openSamplesButton").addEventListener("click", openSampleDialog);
$("#sampleTableSelect").addEventListener("change", updateSampleDescription);
$("#downloadSampleCsvButton").addEventListener("click", () => downloadSample("csv"));
$("#downloadSampleXmlButton").addEventListener("click", () => downloadSample("xml"));
$("#sourceFileInput").addEventListener("change", (event) => {
  if (event.target.files[0]) readSourceFile(event.target.files[0]).catch((error) => toast(error.message, "error"));
});
$("#targetTableSelect").addEventListener("change", () => {
  for (const header of state.sourceHeaders) state.mappings[header] = guessTarget($("#targetTableSelect").value, header);
  renderMappingTable();
});
$("#applyMappingButton").addEventListener("click", applyMapping);
$("#optionPickerSearch").addEventListener("input", () => renderOptionPicker(true));
$("#optionPickerSearch").addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    movePickerCursor(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const optionIndex = state.picker.filteredIndexes[state.picker.cursor];
    const option = state.picker.options[optionIndex];
    if (option) choosePickerValue(option[0], option[1]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    $("#optionPickerDialog").close();
  }
});
$("#optionPickerRecent").addEventListener("click", (event) => {
  const button = event.target.closest("[data-picker-recent]");
  if (!button) return;
  const option = state.picker.options[Number(button.dataset.pickerRecent)];
  if (option) choosePickerValue(option[0], option[1]);
});
$("#optionPickerList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-picker-option]");
  if (!button) return;
  const option = state.picker.options[Number(button.dataset.pickerOption)];
  if (option) choosePickerValue(option[0], option[1]);
});
$("#clearPickerButton").addEventListener("click", () => choosePickerValue("", ""));
$("#optionPickerDialog").addEventListener("close", () => { state.picker.target = null; });
$("#clearTableDialog").addEventListener("close", () => { state.pendingClearTable = ""; });
$$("dialog.dialog").forEach((dialog) => dialog.addEventListener("click", closeDialogFromBackdrop));
$$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.closeDialog}`).close()));
$("#bulkDialog").addEventListener("close", () => {
  const savedChanges = state.bulkDirty;
  normalizeRowMetadata(state.activeTable);
  state.activeRecord = Math.min(state.activeRecord, Math.max(0, currentRows().length - 1));
  renderAll();
  state.bulkDirty = false;
  if (savedChanges) toast("批次修改已自動保留");
});
for (const id of ["newCaseButton", "openSamplesButton", "validateButton"]) {
  $(`#${id}`).addEventListener("click", () => { $("#actionMenu").open = false; });
}
document.addEventListener("click", (event) => {
  const menu = $("#actionMenu");
  if (menu.open && !event.target.closest("#actionMenu")) menu.open = false;
});

bootstrap();
