"use strict";

const F = (name, label, extra = {}) => ({ name, label, ...extra });
const N = (name, label, extra = {}) => F(name, label, { kind: "number", ...extra });
const D = (name, label, extra = {}) => F(name, label, { kind: "date", placeholder: "民國 yyyMMdd，例如 1150713", ...extra });
const C = (name, label, extra = {}) => F(name, label, { kind: "code", ...extra });
const Y = (name, label, extra = {}) => F(name, label, { kind: "yn", ...extra });
const M = (name, label, extra = {}) => F(name, label, { multiline: true, ...extra });
const S = (title, fields, extra = {}) => ({ title, fields, ...extra });
const OPTION_MODAL_THRESHOLD = 5;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

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

const oldAddressFields = (prefix, title) => addressFields(prefix, title).map((field) => ({
  ...field,
  name: `${field.name}_OLD`,
}));

const TABLE_CONFIG = {
  BMSBASE: {
    label: "案件主檔／申請書總表",
    forms: ["A11-1", "A11-2", "A11-2-2", "A11-3", "A11-4", "A11-5", "A11-6", "A12-2", "A12-4", "A12-4-2", "A12-5", "A13-1", "A13-2", "A13-3", "A13-10", "A21-1", "A21-4", "A23-1", "A31-1", "A31-4", "A31-5", "A32-2", "B11-1", "B11-2", "B11-3", "B11-4", "B12-1", "B13-1", "B13-2", "B13-2-2", "B13-3", "B13-4", "B13-5", "B13-6", "B21-1", "B21-2", "B14-1", "B14-3", "B14-4", "B14-5", "C11-1", "C11-2", "C11-2-2", "C12-1", "C21-1", "C21-2", "C21-3", "C21-4", "C22-1", "C22-2", "C22-3", "C22-4", "C22-5", "D11-1", "D11-2", "D13-1", "F 專業技師簽證", "H 農舍管制"],
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
      S("建築線與法定比率", [
        F("BUILDING_LINE_WORD", "建築線文號字別"), F("BUILDING_LINE_NO", "建築線文號號碼"), D("BUILDING_DATE", "建築線指定日期"),
        N("LAW_COVER_RATE", "法定建蔽率（%）"), N("LAW_SPACE_RATE", "法定容積率（%）"),
      ]),
      S("適用法令概要", [
        C("LAW_01", "防火及防火避難適用版本", { hint: "取自舊二維系統 BMLAW1；畫面顯示版本名稱，匯出保留原始代碼。" }),
        D("LAW_02", "防火避難性能設計認可日期", { hint: "僅有性能設計認可通知書時填寫，格式為民國 yyyMMdd。" }),
        F("LAW_02_DOC", "性能設計認可通知書文號", { wide: true }),
        C("LAW_03", "耐震設計規範適用版本", { hint: "取自舊二維系統 BMLAW2；畫面顯示規範版本，匯出保留原始代碼。" }),
      ], { note: "LAW_01 是防火及防火避難版本；LAW_03 是耐震設計規範版本。LAW_02／LAW_02_DOC 不是版本代碼，而是性能設計認可日期與通知書文號。" }),
      S("施工管理與展期", [
        D("RECEIVE_LICE_DATE", "領照日期"), D("Start_work_pre_date", "預定開工日期"), D("Start_work_permit_date", "核准開工日期"),
        D("COMPLETE_DATE", "預定竣工日期"), D("Complete_permit_date", "核准竣工日期"), D("IDENTIFY_LICE_DATE", "執照核發日期"),
        M("PS_DESC", "開工／竣工展期說明", { full: true }),
        Y("B13_3TYPE", "起造人單獨申請變更承造人"), Y("B13_5TYPE", "起造人單獨申請變更監造人"),
      ], { formSets: ["B"], note: "B11、B13、B21 系列使用。日期維持民國 yyyMMdd；展期的逐條理由也可填在案件備註。" }),
      S("變更審查連結文字", [
        M("LICENSE_LINK", "執照連結文字", { full: true }), M("P01_LINK", "起造人連結文字", { full: true }),
        M("LAN_LINK", "地號連結文字", { full: true }), M("ADDR_LINK", "地址連結文字", { full: true }),
      ], { formSets: ["B"], note: "B12-1 直接顯示的組合文字；只在需要沿用舊系統已組好的文字時填寫。" }),
      S("使用執照與變更使用", [
        F("LICENSE_USE", "使用執照字號", { wide: true }), D("IDENTIFY_LICE_DATE_USE", "使用執照核發日期"), D("RECEIVE_LICE_DATE_USE", "使用執照領照日期"),
        C("CHG_EXP", "變更使用範圍"), C("CHG_PRIN", "變更使用檢討原則"), F("CHG_PRIN_DESC", "檢討原則顯示文字", { wide: true }),
        Y("DOC1", "檢附檢討項目簽證表"), Y("DOC2", "檢附室內裝修圖說"), Y("DOC3", "檢附結構計算書"), Y("DOC4", "檢附設備圖說"),
        M("OTHERS_MEMO", "其他變更使用說明", { full: true }),
      ], { formSets: ["C"], note: "C21、C22 系列使用；代碼欄選取後會保留舊系統原始代碼。" }),
      S("農舍管制", [
        D("IDENTIFY_LICE_OLD_DATE", "原執照核發日期"), C("LAND_GET_TIME", "農地取得時點"), C("FARM_BUILD", "農舍興建方式"), M("FARM_MEMO", "農舍管制備註", { full: true }),
      ], { formSets: ["D"], note: "H 系列農舍管制註記清冊使用；基地是否為農舍坐落地請在地號頁填 LOCATED。" }),
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
      ], { templateAction: true, note: "SQLite 範本模式可將這兩個長文字欄位儲存成共用範本；套用時預設只填空白欄位。" }),
      S("變更前／原核准值", [
        C("BUILDING_KIND1_OLD", "原構造種類代碼 1"), C("BUILDING_KIND2_OLD", "原構造種類代碼 2"), C("BUILDING_KIND3_OLD", "原構造種類代碼 3"),
        N("BUILDING_HEIGHT_OLD", "原建築高度分類值"), N("PRICE_OLD", "原工程造價（元）"), N("OTHERS_PRICE_OLD", "原雜項工作物造價（元）"),
      ], { old: true, note: "A11-6、A31 系列會同時顯示本次值與原核准值；新申請可留白。" }),
    ],
  },
  BMSLAN: {
    label: "基地地號",
    forms: ["A11-1", "A12-2", "A12-4", "A12-5", "A21-1", "A31-1", "A32-2", "B11-1", "B11-2", "B13-1", "B13-3", "B13-5", "B21-1", "B14-1", "C11-1", "C21-1", "C22-1", "C22-2", "C22-3", "C22-4", "D11-1", "D13-1", "F 專業技師簽證", "H 農舍管制"],
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
    forms: ["A12-4", "H 農舍管制註記清冊（異動書）"],
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
    forms: ["A11-1", "A21-1", "A31-1", "B11-2", "B13-1", "B13-3", "B13-5", "B21-1", "C11-1", "C21-1", "C21-2", "C22-3", "D11-1"],
    notice: "舊系統規定備註請使用上方快速帶入；程序、屬性代碼／名稱與備註內容會一起寫入。自由備註可讓代碼與名稱留白，只填內容。",
    sections: [S("目前備註內容", [
      F("MEMO_SEQ", "程序、屬性代碼", { maxLength: 4, hint: "舊系統 RMK 範本代碼最長 4 碼；自由備註可以留白。" }),
      F("MEMO_SEQ_NAME", "程序、屬性名稱", { maxLength: 100 }),
      M("DESE", "備註內容", { full: true, maxLength: 230 }),
    ])],
  },
  BMSP01: {
    label: "起造人／棟戶門牌",
    forms: ["A11-1", "A11-2", "A11-2-2", "A11-5", "A12-5", "A13-3", "A21-1", "A31-1", "B11-1", "B11-2", "B12-1", "B13-1", "B13-2", "B13-2-2", "B13-3", "B13-5", "B21-1", "B14-1", "C11-1", "C11-2", "C11-2-2", "C21-1", "C21-4", "C22-1", "C22-2", "C22-3", "C22-4", "C22-5", "D11-1", "D11-2", "D13-1", "F 專業技師簽證", "H 農舍管制"],
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
      S("變更前起造人", [
        F("CNAME_OLD", "原姓名／公司名稱", { wide: true }), D("BIRTH_DATE_OLD", "原出生日期"),
        F("IDENTIFY_NO_OLD", "原身分證號／統一編號"), F("TEL_NO_OLD", "原電話"), F("FAX_NO_OLD", "原傳真"), F("EMAIL_OLD", "原電子郵件", { wide: true }),
        F("BUILDING_NO_OLD", "原棟別／單元代號"), F("CHWANG_OLD", "原幢序號"), F("DONG_OLD", "原棟序號"), F("FLOOR_OLD", "原層序號"), F("HOUSE_OLD", "原戶序號"),
      ], { old: true, formSets: ["B"], note: "B13-2／B13-2-2 變更起造人名冊使用；未變更者可留白。" }),
      S("變更前戶籍／公司地址", oldAddressFields("O_ADDR", "原戶籍／公司－"), { old: true, formSets: ["B"] }),
      S("變更前通訊地址", oldAddressFields("H_ADDR", "原通訊－"), { old: true, formSets: ["B"] }),
      S("變更前建築物門牌", oldAddressFields("ADDR", "原門牌－"), { old: true, formSets: ["B"] }),
    ],
  },
  BMSP02: {
    label: "設計人",
    forms: ["A11-1", "A11-3", "A11-5", "A21-1", "A31-1", "C21-1", "C22-4"],
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
    forms: ["A31-1", "B11-1", "B11-4", "B13-1", "B13-3", "B13-5", "B13-6", "B21-1", "B14-1", "C11-1", "C21-1", "D11-1"],
    sections: [
      S("監造建築師", [
        Y("SPOKESMAN", "主要監造人"), F("CNAME", "建築師姓名"), F("IDENTIFY_NO", "身分證號"),
        C("COM_ID_AREA", "開業證書縣市字母"), F("COM_ID_WORD", "開業證書字別／年度"), F("COM_ID_NO", "開業證書號碼"), F("COM_ID_NO1", "開業證書附加號碼"),
        F("OFFICE_NAME", "事務所名稱", { wide: true }), C("COM_ZIP", "郵遞區號／行政區代碼"), F("COM_ADDRESS", "事務所地址", { full: true }),
        F("TEL_NO", "電話"), F("FAX_NO", "傳真"), F("eMail", "電子郵件", { wide: true }),
      ]),
      S("變更前監造建築師", [
        F("CNAME_OLD", "原建築師姓名"), F("IDENTIFY_NO_OLD", "原身分證號"),
        C("COM_ID_AREA_OLD", "原開業證書縣市字母"), F("COM_ID_WORD_OLD", "原開業證書字別／年度"), F("COM_ID_NO_OLD", "原開業證書號碼"), F("COM_ID_NO1_OLD", "原開業證書附加號碼"),
        F("OFFICE_NAME_OLD", "原事務所名稱", { wide: true }), C("COM_ZIP_OLD", "原郵遞區號／行政區代碼"), F("COM_ADDRESS_OLD", "原事務所地址", { full: true }),
        F("TEL_NO_OLD", "原電話"), F("FAX_NO_OLD", "原傳真"), F("EMAIL_OLD", "原電子郵件", { wide: true }),
      ], { old: true, formSets: ["B"], note: "B13-5、B13-6 變更監造資料使用。" }),
    ],
  },
  BMSP04: {
    label: "承造人",
    forms: ["A11-5", "A31-1", "B11-1", "B11-3", "B13-1", "B13-3", "B13-4", "B13-5", "B21-1", "B14-1", "B14-3", "C11-1", "C21-1", "C22-4", "D11-1"],
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
      S("施工管理工程人員補充", [F("TECH_IDNO", "專任工程人員身分證號"), F("GUILDNO1", "公會字號 1"), F("GUILDNO2", "公會字號 2")], { formSets: ["B"] }),
      S("變更前承造人與工程人員", [
        F("COMPANY_NAME_OLD", "原營造業公司名稱", { wide: true }), F("COM_IDNO_OLD", "原公司統一編號"), F("BOSS_OLD", "原負責人"),
        C("COM_ZIP_OLD", "原郵遞區號／行政區代碼"), F("COM_ADDRESS_OLD", "原公司地址", { full: true }),
        C("ARC_REG_WORD_OLD", "原營造業登記縣市字母"), C("ARC_REG_CLAS_OLD", "原營造業登記等級"), F("ARC_REG_PRI_OLD", "原登記字號前置／序號"), F("ARC_REG_NO_OLD", "原登記字號主體"),
        F("TECH_NAME_OLD", "原專任工程人員姓名"), F("TECH_LIC_OLD", "原專任工程人員證書字號", { wide: true }), C("FTENGTYPE_OLD", "原專任工程人員種類代碼"),
        F("SCTNAME_OLD", "原工地主任姓名"), F("SCTNO_OLD", "原工地主任執業證號"), F("GUILDNO1_OLD", "原公會字號 1"), F("GUILDNO2_OLD", "原公會字號 2"),
        F("TEL_NO_OLD", "原電話"), F("FAX_NO_OLD", "原傳真"), F("EMAIL_OLD", "原電子郵件", { wide: true }),
      ], { old: true, formSets: ["B"], note: "B13-3、B13-4 變更承造資料使用。" }),
    ],
  },
  BMSPARK: {
    label: "停車空間",
    forms: ["A11-1", "A31-1", "C11-1", "C21-1"],
    notice: "每種「停車方式 × 車種 × 法定／自設 × 室內外 × 地上下」組合各一列。",
    sections: [S("停車分類與數量", [
      C("PARK_KIND", "停車方式代碼"), C("CAR_KIND", "車種代碼"), C("APPL_KIND", "設立類別代碼"), C("IN_OUT", "室內外別代碼"), C("UP_DOWN", "地上地下別代碼"),
      N("NUM", "車位數"), N("AREA", "停車面積（㎡）"), Y("AIR_FLAG", "兼作防空避難"),
    ])],
  },
  BMSSTAIR: {
    label: "樓層／用途／面積",
    forms: ["A11-4", "A11-6", "A31-4", "C21-2", "C22-3"],
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
      ], { old: true, note: "A31-5 使用；非變更案可留白。按鈕會以本次工作物逐欄覆蓋原值，空白也會照樣帶入。", copyCurrent: "BMSWORK", copyLabel: "一鍵帶入本次工作物" }),
    ],
  },
  BM_TEC: {
    label: "專業技師簽證",
    forms: ["F 建築物結構與設計專業技師簽證報告"],
    notice: "每位技師／每個簽證項目各一列。這是原 data.txt 13 表之一，匯出時會完整寫回。",
    sections: [
      S("簽證分類", [C("TEC_ITEM", "簽證項目"), C("TEC_TYPE", "技師科別")]),
      S("技師資格", [
        F("TEC_NAME", "技師姓名"), F("CAPACITY_GET", "資格取得字別"), F("CAPACITY_NO", "技師證書字號"),
        F("TRX_NO", "核准／換發文號", { wide: true }), F("REG_NO", "執業登記號"), D("REG_DATE", "執業登記日期"),
      ]),
      S("事務所", [
        F("COM_NAME", "事務所名稱", { wide: true }), C("COM_ZIP", "郵遞區號／行政區代碼"), F("COM_ADDR", "事務所地址", { full: true }),
        F("COM_TEL", "電話"), F("COM_FAX", "傳真"),
      ]),
      S("簽證內容", [F("PROGRAM", "結構計算程式", { wide: true }), M("MEMO", "備註", { full: true }), M("TEC_DATA", "簽證內容", { full: true })]),
    ],
  },
  BMSSC: {
    label: "開／竣工查報概要",
    forms: ["B21-2"],
    notice: "B21-2 的工程主要材料與人力資源概要主檔。PRSTYLE 決定開工或竣工查報；逐月材料請在「逐月材料與人力」填寫。",
    sections: [
      S("報表與角色", [
        C("PRSTYLE", "查報類型"), F("LICENSE_OLD", "建造執照字號", { wide: true }),
        F("P01_NAME", "起造人／工程名稱", { wide: true }), F("P04_NAME", "承造營造業", { wide: true }), F("P04_NO", "營造業編號"),
      ]),
      S("工程金額與地點", [
        N("COST_PUB", "公有工程總價（元）"), N("COST_PUB_MAKING", "公有工程建造費（元）"), C("COST_PRI_SELECT", "民間工程類型"), N("COST_PRI", "民間工程總價（元）"),
        F("ZON_WORKING", "工程地點", { full: true }), C("ZON_ZIP", "工程地點行政區／郵遞碼"),
      ]),
      S("工期與使用執照", [D("DATE_WORK_START", "開工日期"), D("DATE_WORK_END", "竣工日期"), D("DATE_USELIC", "使用執照日期")]),
      S("面積、造價與停車", [
        N("AREA_FLOOR", "地上樓地板面積（㎡）"), N("AREA_UNDER_FLOOR", "地下樓地板面積（㎡）"),
        F("FLOOR_COST", "每㎡平均造價"), F("FLOOR_NUMBER", "樓層數文字"), N("PARK_INSIDE", "室內停車位數"), N("PARK_OUTSIDE", "室外停車位數"),
      ]),
      S("土地使用分區", [
        Y("BUC1", "住宅區"), Y("BUC2", "商業區"), Y("BUC3", "工業區"), Y("BUC4", "行政區"), Y("BUC5", "文教區"),
        Y("BUC6", "風景區"), Y("BUC7", "保護區"), Y("BUC8", "農業區"), Y("BUC9", "其他分區"),
      ]),
      S("使用性質", [
        Y("BUP1", "純住宅"), Y("BUP2", "混合住宅"), Y("BUP3", "商店"), Y("BUP4", "工廠"), Y("BUP5", "辦公室"), Y("BUP6", "旅館"),
        Y("BUP7", "倉庫"), Y("BUP8", "學校"), Y("BUP9", "醫院"), Y("BUP10", "遊樂場"), Y("BUP11", "其他用途"),
      ]),
      S("構造與住宅型態", [
        Y("BUK1", "鋼骨鋼筋混凝土"), Y("BUK2", "鋼筋混凝土"), Y("BUK3", "鋼架"), Y("BUK4", "加強磚造"), Y("BUK5", "磚石"), Y("BUK6", "其他構造"),
        Y("BUS1", "傳統式農村住宅"), Y("BUS2", "獨棟或雙併式住宅"), Y("BUS3", "連棟式住宅"), Y("BUS4", "集合住宅"),
      ]),
      S("總工日", [N("PEO_TECH_DATE", "技術工總工日"), N("PEO_PLAIN_DATE", "普通工總工日")], { note: "原始欄名雖含 DATE，但舊報表標示為總工日，請填純數字。" }),
    ],
  },
  BMSROAD: {
    label: "使用道路",
    forms: ["B11-1", "D11-1"],
    notice: "舊系統 Build.mdb 的道路使用資料，不屬於 data.txt 13 表；會保存在完整案件 JSON。",
    sections: [
      S("道路位置", [
        Y("SPOKESMAN", "代表道路"), C("DIST", "行政區代碼"), F("ROAD_SEC", "路／街／段"), F("ALLEY", "巷"), F("LANE", "弄"), F("DOOR_NO", "號"),
      ]),
      S("使用內容", [N("LENGTH", "使用長度（m）"), N("WIDE", "使用寬度（m）"), D("USE_LIMITE_DAY", "使用期限"), M("USE_ANSER", "道路使用答覆／說明", { full: true }), M("MEMO", "道路備註", { full: true })]),
    ],
  },
  BMSCHK: {
    label: "施工勘驗",
    forms: ["B14-1", "B14-2", "B14-3"],
    notice: "B14 勘驗資料完整保留 Build.mdb 的原始欄位。B14-2 報表模板在本機缺漏，因此本頁不自行猜測報表版面。",
    sections: [
      S("勘驗項目", [C("CHK_Item_code", "勘驗項目代碼"), F("CHK_Item", "勘驗項目名稱", { wide: true })]),
      S("第一次申報", [F("CHK_Reg_Number1", "第一次申報／掛號字號"), D("CHK_Date1", "第一次申報日期"), D("CHK_Over_Date1", "第一次完成日期"), Y("CHK_OK1", "第一次勘驗通過")]),
      S("第二次申報", [F("CHK_Reg_Number2", "第二次申報／掛號字號"), D("CHK_Date2", "第二次申報日期"), D("CHK_Over_Date2", "第二次完成日期"), Y("CHK_OK2", "第二次勘驗通過")]),
      S("建築師與技師", [Y("Struct_Tech", "需要結構技師"), F("ARCH_NAME", "建築師姓名"), F("TECH_NAME", "技師姓名"), F("TECH_LIC", "技師證照")]),
      S("網路申報", [Y("NET_CHECK", "已完成網路查核"), D("NET_CR_DATE", "網路建立日期"), D("NET_REG_DATE", "網路掛號日期"), F("NET_REG_NO", "網路掛號號碼"), N("NET_SEQ", "網路申報序號")]),
      S("現場查驗", [
        Y("PECT_FLAG", "需要現場查驗"), F("PECT_RES_ITEM", "查驗結果項目", { wide: true }), F("PECT_RES", "查驗結果"), D("PECT_DATE", "查驗日期"),
        F("BOSS_MAN", "現場負責人"), F("PECT_ITEM", "查驗項目"), M("PECT_DESC", "查驗說明", { full: true }),
      ]),
      S("複驗與備註", [Y("PECT_RVLFLAG", "需要複驗"), D("PECT_RVLDATE", "複驗日期"), F("UREMARK", "其他註記")]),
    ],
  },
  BMSSCRP: {
    label: "逐月材料與人力",
    forms: ["B21-2"],
    notice: "每個月份一列；B21-2 會加總鋼骨、鋼筋、級配、預拌混凝土與瀝青混凝土。",
    sections: [
      S("月份與頁次", [N("PAGE_NO", "頁次"), F("MONTHS", "月份／月次")]),
      S("主要材料數量", [
        N("ITEM01", "鋼骨／型鋼（噸）"), N("ITEM02", "鋼筋（噸）"), N("ITEM03", "材料項目 03"), N("ITEM04", "級配／石料及碎石（m³）"),
        N("ITEM05", "材料項目 05"), N("ITEM06", "材料項目 06"), N("ITEM07", "預拌混凝土（m³）"), N("ITEM08", "瀝青混凝土（m³）"),
      ]),
      S("逐月人力", [N("PEO_TECH_DATE", "技術工工日"), N("PEO_PLAIN_DATE", "普通工工日")]),
    ],
  },
  RPTPHOTO: {
    label: "施工照片／附件",
    forms: ["B14-4", "B14-5"],
    notice: "檔案內容只保存在完整案件 JSON，不會寫入 data.txt。單檔上限 12 MB；匯入案件 JSON 後仍可下載原檔。",
    sections: [
      S("附件資料", [C("FORM_CODE", "對應書表"), D("CR_DATE", "拍照／建立日期"), M("MEMO", "照片／附件說明", { full: true })]),
      S("檔案", [F("barcode", "照片／附件檔案", { kind: "file", full: true })]),
    ],
  },
  C21_3: {
    label: "變更使用檢討項目",
    forms: ["C21-3"],
    notice: "每個檢討項目一列。選擇項目代碼後會帶入舊系統的項目名稱；檢討結果與簽證說明填在結果欄。",
    sections: [
      S("檢討內容", [
        F("Rpt_FmName", "書表代號"), C("Rpt_Seq", "檢討項目"), F("Rpt_Item", "檢討項目名稱", { full: true }), M("Rpt_Data", "檢討結果／簽證說明", { full: true }),
      ]),
    ],
  },
  BMELVTR: {
    label: "昇降與機械停車設備",
    forms: ["C22-5"],
    notice: "每部昇降設備或機械停車設備一列，保存在完整案件 JSON／資料庫，不會增減 data.txt 的 13 表結構。",
    sections: [
      S("設備識別", [
        C("CMEPAS", "主管機關代碼"), F("CMENUM", "設備列管編號"), F("PAKENO", "設備／停車設備編號"), N("CHECK_YEAR", "檢查年度"),
        F("CMENAM", "設備名稱", { wide: true }), C("ELEV_USE", "設備種類"), F("FACILITY_NO", "設備數量／編號"), F("FACILITY_SCALE", "設備規模", { wide: true }),
      ]),
      S("建築物與執照", [
        F("BUILD_NAME", "建築物名稱", { wide: true }), F("BUILD_ADDR", "建築物地址", { full: true }), F("USE_LICENSE", "使用執照字號", { wide: true }), F("LIC_NUM", "設備許可／執照號碼", { wide: true }),
      ]),
      S("檢查與效期", [
        F("CHECK_RESULT", "檢查結果"), D("CHECK_DATE", "檢查日期"), D("VALID_DATE", "有效期限"), F("CHECK_MAN_NO", "檢查員證號"), F("CHECK_MAN_NAME", "檢查員姓名"),
      ]),
      S("製造廠商", [F("MFT_NAME", "製造廠商名稱", { wide: true }), F("MFT_NO", "製造廠商編號")]),
    ],
  },
};

const FORM_SETS = {
  A: {
    label: "建照申請",
    codes: ["A"],
    tables: ["BMSBASE", "BMSLAN", "BMSLANOWNER", "BMSMEMO", "BMSP01", "BMSP02", "BMSP03", "BMSP04", "BMSPARK", "BMSSTAIR", "BMSWORK"],
  },
  B: {
    label: "施工管理",
    codes: ["B", "G"],
    tables: ["BMSBASE", "BMSLAN", "BMSMEMO", "BMSP01", "BMSP03", "BMSP04", "BMSSC", "BMSSCRP", "BMSROAD", "BMSCHK", "RPTPHOTO", "BM_TEC"],
  },
  C: {
    label: "使用管理",
    codes: ["C"],
    tables: ["BMSBASE", "BMSLAN", "BMSMEMO", "BMSP01", "BMSP02", "BMSP03", "BMSP04", "BMSPARK", "BMSSTAIR", "C21_3", "BMELVTR"],
  },
  D: {
    label: "拆除與其他",
    codes: ["D", "F", "H"],
    tables: ["BMSBASE", "BMSLAN", "BMSLANOWNER", "BMSMEMO", "BMSP01", "BMSP03", "BMSP04", "BMSROAD", "BM_TEC"],
  },
};

const RECOMMENDED_FORM_PREFIXES_BY_APPLY_TYPE = {
  "E11-1": [],
  "A11-1": ["A11", "A12", "A13"],
  "A11-2": ["A11", "A12", "A13"],
  "A21-1": ["A21", "A23"],
  "A31-1": ["A31", "A32"],
  "A31-2": ["A31", "A32"],
  "B11-1": ["B11-1"],
  "B11-2": ["B11-2"],
  "B13-1": ["B13-1"],
  "B13-3": ["B13-3"],
  "B13-5": ["B13-5"],
  "B14-1": ["B14-1"],
  "B21-1": ["B21-1"],
  "C11-1": ["C11", "C12"],
  "C21-1": ["C21", "C22"],
  "D11-1": ["D11", "D13"],
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
  "BMSBASE.CHG_EXP": [["1", "非供公眾使用變更為非供公眾使用"], ["2", "非供公眾使用變更為供公眾使用"], ["3", "供公眾使用變更為他種供公眾使用"], ["4", "供公眾使用變更為非供公眾使用"]],
  "BMSBASE.CHG_PRIN": [["1", "全部檢討"], ["2", "僅規定項目檢討"], ["3", "全部免檢討"]],
  "BMSBASE.LAND_GET_TIME": [["1", "農業發展條例修正前取得"], ["2", "農業發展條例修正後取得"]],
  "BMSBASE.FARM_BUILD": [["1", "個別興建"], ["2", "集村興建"]],
  "BM_TEC.TEC_ITEM": [["2", "地基調查"]],
  "BM_TEC.TEC_TYPE": [["04", "大地技師"]],
  "BMSSC.PRSTYLE": [["1", "開工查報"], ["2", "竣工查報"]],
  "BMSSC.COST_PRI_SELECT": [["1", "建設公司"], ["2", "自建"]],
  "BMSP04.FTENGTYPE": [["1", "主任技師"], ["2", "主任建築師"], ["3", "主任技師及主任建築師"]],
  "BMSP04.FTENGTYPE_OLD": [["1", "主任技師"], ["2", "主任建築師"], ["3", "主任技師及主任建築師"]],
  "RPTPHOTO.FORM_CODE": [["B14-4", "施工日誌／現況照片"], ["B14-5", "督察紀錄／檢附附件"]],
  "BMELVTR.ELEV_USE": [["A", "緊急用升降機"], ["B", "一般升降機"], ["C", "自動樓梯"], ["D", "其他升降機"], ["E", "垂直循環型機械停車設備"], ["F", "多層循環型機械停車設備"], ["G", "水平循環型機械停車設備"], ["H", "平面往復型機械停車設備"], ["I", "簡易升降型機械停車設備"], ["J", "升降機型機械停車設備"], ["K", "多段型機械停車設備"], ["L", "升降滑動型機械停車設備"], ["M", "機械停車設備旋轉台"], ["N", "汽（機）車用升降機"], ["O", "個人住宅用升降機"]],
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
  BMSP01: {
    BLD_CODE1: { type: "USECOD" }, BLD_CODE2: { type: "USECOD" }, BLD_CODE3: { type: "USECOD" },
  },
  BMSP02: { COM_ZIP: { type: "ZON", city: true }, COM_ID_AREA: { type: "PAS", value: "sub" } },
  BMSP03: {
    COM_ZIP: { type: "ZON", city: true }, COM_ID_AREA: { type: "PAS", value: "sub" },
    COM_ZIP_OLD: { type: "ZON", city: true }, COM_ID_AREA_OLD: { type: "PAS", value: "sub" },
  },
  BMSP04: {
    COM_ZIP: { type: "ZON", city: true }, ARC_REG_WORD: { type: "PAS", value: "sub" }, ARC_REG_CLAS: { type: "ARCLS" }, FTENGTYPE: { type: "TECTYP" },
    COM_ZIP_OLD: { type: "ZON", city: true }, ARC_REG_WORD_OLD: { type: "PAS", value: "sub" }, ARC_REG_CLAS_OLD: { type: "ARCLS" }, FTENGTYPE_OLD: { type: "TECTYP" },
  },
  BMSPARK: {
    PARK_KIND: { type: "PARKTY" }, CAR_KIND: { type: "CARTYP" }, APPL_KIND: { type: "APPLTY" }, IN_OUT: { type: "INOUT" }, UP_DOWN: { type: "UPDN" },
  },
  BMSSTAIR: {
    STORY_CODE: { type: "STC", value: "codeSub" }, STORY_CODE_OLD: { type: "STC", value: "codeSub" },
    USAGE_CODE1: { type: "USECOD" }, USAGE_CODE2: { type: "USECOD" }, USAGE_CODE3: { type: "USECOD" },
    USAGE_CODE1_OLD: { type: "USECOD" }, USAGE_CODE2_OLD: { type: "USECOD" }, USAGE_CODE3_OLD: { type: "USECOD" },
  },
  BM_TEC: { TEC_ITEM: { type: "BMTEC" }, TEC_TYPE: { type: "TEC" }, COM_ZIP: { type: "ZON", city: true } },
  BMSSC: { ZON_ZIP: { type: "ZON", city: true } },
  BMSROAD: { DIST: { type: "ZON", city: true } },
  BMSCHK: { CHK_Item_code: { type: "BMPECT" } },
  C21_3: { Rpt_Seq: { type: "C21_3" } },
  BMELVTR: { CMEPAS: { type: "PAS" } },
};

const BULK_FIELDS = {
  BM_TEC: ["TEC_ITEM", "TEC_NAME", "TEC_TYPE", "CAPACITY_NO", "REG_NO", "COM_NAME"],
  BMSSC: ["PRSTYLE", "LICENSE_OLD", "P01_NAME", "P04_NAME", "DATE_WORK_START", "DATE_WORK_END", "AREA_FLOOR", "AREA_UNDER_FLOOR"],
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
  BMSROAD: ["SPOKESMAN", "DIST", "ROAD_SEC", "ALLEY", "LANE", "DOOR_NO", "LENGTH", "WIDE", "USE_LIMITE_DAY"],
  BMSCHK: ["CHK_Item_code", "CHK_Item", "CHK_Reg_Number1", "CHK_Date1", "CHK_OK1", "PECT_DATE", "PECT_RES", "PECT_RVLFLAG"],
  BMSSCRP: ["PAGE_NO", "MONTHS", "ITEM01", "ITEM02", "ITEM04", "ITEM07", "ITEM08", "PEO_TECH_DATE", "PEO_PLAIN_DATE"],
  C21_3: ["Rpt_Seq", "Rpt_Item", "Rpt_Data"],
  BMELVTR: ["PAKENO", "ELEV_USE", "VALID_DATE", "USE_LICENSE", "MFT_NAME", "CMENAM"],
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
  BMSWORK: [
    ["CONSNAME", "CONSNAME_OLD"], ["BUILDING_KIND", "BUILDING_KIND_OLD"],
    ["LENGTH", "LENGTH_OLD"], ["HEIGHT", "HEIGHT_OLD"], ["WIDE", "WIDE_OLD"], ["AREA", "AREA_OLD"],
    ["DESE", "DESE_OLD"],
  ],
};

const BULK_COMPARISON_CONFIG = {
  BMSLAN: { currentLabel: "本次地號", oldLabel: "變更前地號" },
  BMSSTAIR: { currentLabel: "本次樓層概要", oldLabel: "變更前／原核准樓層概要" },
  BMSWORK: { currentLabel: "本次雜項工作物", oldLabel: "變更前／原核准雜項工作物" },
};

const state = {
  bootstrap: null,
  schemaVersion: null,
  codebook: null,
  formSet: "A",
  tables: {},
  activeTableByFormSet: { A: "BMSBASE", B: "BMSSC", C: "C21_3", D: "BMSBASE" },
  activeTable: "BMSBASE",
  activeRecord: 0,
  sourceName: "空白案件",
  sourceZipFile: null,
  sourceZipDataTxtPath: "",
  sourceRows: [],
  sourceHeaders: [],
  mappings: {},
  picker: { target: null, onChoose: null, currentValue: "", options: [], title: "", key: "", filteredIndexes: [], cursor: 0 },
  memoPreset: { categoryCode: "", procedureId: "", templateCode: "" },
  sectionOpen: {},
  showRawFields: false,
  bulkDirty: false,
  bulkComparisonSide: "current",
  pendingClearTable: "",
  templates: [],
  activeTemplateKind: "",
  selectedTemplateId: "",
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

function visibleSections(table) {
  return TABLE_CONFIG[table].sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => !section.formSets || section.formSets.includes(state.formSet));
}

function visibleFields(table) {
  return visibleSections(table).flatMap(({ section }) => section.fields);
}

function codeSpecFor(table, field) {
  const direct = FIELD_CODEBOOK[table]?.[field];
  if (direct) return direct;
  if (table === "BMSP01" && /^(?:O_ADDR|H_ADDR|ADDR)ADR(?:_OLD)?$/.test(field)) return { type: "ZON", city: true };
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
    || ((/^(?:O_ADDR|H_ADDR|ADDR)ADR(?:_OLD)?$/.test(field) || field === "COM_ZIP") ? genericDistrictOptions : []);
  const spec = codeSpecFor(table, field);
  if (!spec || !state.codebook) return sortOptionsByName(fallback);
  const currentLegacyRows = state.codebook.legacyPresets?.laws?.[spec.type];
  let rows = Array.isArray(currentLegacyRows) && currentLegacyRows.length
    ? currentLegacyRows.filter((row) => row.code !== "**")
    : (state.codebook.codeTypes?.[spec.type] || []);
  if (spec.type === "SEC") rows = [...(state.codebook.officialSections || []), ...rows];
  const city = activeTables().BMSBASE?.[0]?.BMPAS || "";
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
  return activeTables()[state.activeTable] || [];
}

function formCatalogForSet(formSet) {
  const codes = new Set(FORM_SETS[formSet]?.codes || []);
  return (state.codebook?.codeTypes?.ALLRPT || []).filter((row) => codes.has(row.code));
}

function currentRecord() {
  return currentRows()[state.activeRecord] || null;
}

function currentApplyType() {
  return activeTables().BMSBASE?.[0]?.APPLY_TYPE || "";
}

function currentApplyTypeLabel() {
  const applyType = currentApplyType();
  return state.codebook?.codeTypes?.APP?.find((row) => row.code === applyType)?.label || applyType;
}

function recommendedTablesForApplyType(applyType = currentApplyType()) {
  const recommended = new Set(["BMSBASE"]);
  const prefixes = RECOMMENDED_FORM_PREFIXES_BY_APPLY_TYPE[applyType] || [];
  for (const [table, config] of Object.entries(TABLE_CONFIG)) {
    if (config.forms.some((form) => prefixes.some((prefix) => form === prefix || form.startsWith(`${prefix}-`)))) {
      recommended.add(table);
    }
  }
  return recommended;
}

function recordCaption(table, record, index) {
  const candidates = {
    BM_TEC: "TEC_NAME", BMSLAN: "ROAD_NO1", BMSLANOWNER: "owner", BMSMEMO: "MEMO_SEQ_NAME",
    BMSP01: "BUILDING_NO", BMSP02: "CNAME", BMSP03: "CNAME", BMSP04: "COMPANY_NAME",
    BMSPARK: "NUM", BMSSTAIR: "STORY_CODE", BMSWORK: "CONSNAME", BMSSC: "PRSTYLE",
    BMSROAD: "ROAD_SEC", BMSCHK: "CHK_Item", BMSSCRP: "MONTHS", RPTPHOTO: "FILE_NAME",
    C21_3: "Rpt_Item", BMELVTR: "CMENAM",
  };
  const field = candidates[table];
  const value = field ? record[field] : "";
  const sequence = record.person_seq || record.Person_seq || record.PERSON_SEQ || index + 1;
  return `${sequence}. ${value || `第 ${index + 1} 筆`}`;
}

function switchFormSet(formSet) {
  if (!Object.hasOwn(FORM_SETS, formSet) || state.formSet === formSet) return;
  state.activeTableByFormSet[state.formSet] = state.activeTable;
  state.formSet = formSet;
  const tables = FORM_SETS[formSet].tables;
  const remembered = state.activeTableByFormSet[formSet];
  state.activeTable = tables.includes(remembered) ? remembered : (tables[0] || state.activeTable);
  state.activeTableByFormSet[formSet] = state.activeTable;
  state.activeRecord = 0;
  $("#fieldSearch").value = "";
  renderAll();
}

function renderFormSetSwitcher() {
  $("#formSetSwitcher").innerHTML = Object.entries(FORM_SETS).map(([formSet, config]) => {
    const count = formCatalogForSet(formSet).length;
    const selected = formSet === state.formSet;
    const label = `${formSet} ${config.label}`;
    return `<button class="form-set-button ${selected ? "active" : ""}" type="button" data-form-set="${formSet}" aria-label="${escapeHtml(`${label}，${count} 份書表`)}" aria-pressed="${selected}">
      <span>${escapeHtml(label)}</span><strong>${count}</strong>
    </button>`;
  }).join("");
  $$("[data-form-set]").forEach((button) => button.addEventListener("click", () => switchFormSet(button.dataset.formSet)));
}

function renderNav() {
  const recommended = recommendedTablesForApplyType();
  $("#tableNav").innerHTML = FORM_SETS[state.formSet].tables.map((table) => {
    const config = TABLE_CONFIG[table];
    const count = (activeTables()[table] || []).length;
    const isRecommended = recommended.has(table);
    const ariaLabel = `${config.label}${isRecommended ? "，依目前申請類型建議優先填寫" : ""}，${count} 筆`;
    return `<button class="nav-item ${table === state.activeTable ? "active" : ""} ${isRecommended ? "recommended" : ""}" type="button" data-table="${table}" aria-label="${escapeHtml(ariaLabel)}">
      <span>${isRecommended ? '<span class="nav-recommended-mark" aria-hidden="true">*</span>' : ""}${escapeHtml(config.label)}<small class="nav-raw">${table}</small></span>
      <span class="nav-count">${count}</span>
    </button>`;
  }).join("");
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => {
    state.activeTable = button.dataset.table;
    state.activeTableByFormSet[state.formSet] = state.activeTable;
    state.activeRecord = 0;
    $("#fieldSearch").value = "";
    renderAll();
  }));
}

function renderFormSetPlaceholder() {
  const config = FORM_SETS[state.formSet];
  const forms = formCatalogForSet(state.formSet);
  $("#formSetPlaceholderTitle").textContent = `${state.formSet} ${config.label}`;
  $("#formSetCatalogBody").innerHTML = forms.length
    ? forms.map((form) => `<tr><td><code>${escapeHtml(form.mark || "—")}</code></td><td>${escapeHtml(form.label)}</td></tr>`).join("")
    : `<tr><td colspan="2">目前代碼庫沒有這一組的書表目錄。</td></tr>`;
}

function renderRecordControls() {
  const table = state.activeTable;
  const rows = currentRows();
  const repeatable = tableMetaFor(table)?.repeatable;
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

function regulatedNoteCategories() {
  const categories = state.codebook?.legacyPresets?.regulatedNotes?.categories;
  return Array.isArray(categories) ? categories : [];
}

function memoPresetContext() {
  const categories = regulatedNoteCategories();
  const category = categories.find((item) => item.code === state.memoPreset.categoryCode) || null;
  if (!category && state.memoPreset.categoryCode) {
    state.memoPreset = { categoryCode: "", procedureId: "", templateCode: "" };
  }
  const procedure = category?.procedures?.find((item) => item.id === state.memoPreset.procedureId) || null;
  if (!procedure && state.memoPreset.procedureId) {
    state.memoPreset.procedureId = "";
    state.memoPreset.templateCode = "";
  }
  const template = procedure?.templates?.find((item) => item.code === state.memoPreset.templateCode) || null;
  if (!template && state.memoPreset.templateCode) state.memoPreset.templateCode = "";
  return { categories, category, procedure, template };
}

function memoTemplateExcerpt(body, maximum = 68) {
  const compact = String(body || "").replace(/\s+/g, " ").trim();
  return compact.length > maximum ? `${compact.slice(0, maximum)}…` : compact;
}

function memoPresetOptions(kind, context = memoPresetContext()) {
  if (kind === "category") return context.categories.map((item) => [item.code, item.label]);
  if (kind === "procedure") return (context.category?.procedures || []).map((item) => [item.id, item.label]);
  return (context.procedure?.templates || []).map((item) => [item.code, `${item.code}｜${memoTemplateExcerpt(item.body)}`]);
}

function memoChoiceMarkup(kind, label, options, value, emptyText) {
  const id = `memo-preset-${kind}`;
  if (!options.length) {
    return `<label class="memo-step" for="${id}"><span>${escapeHtml(label)}</span><select id="${id}" disabled><option>${escapeHtml(emptyText)}</option></select></label>`;
  }
  if (!useModalForOptions(options)) {
    return `<label class="memo-step" for="${id}"><span>${escapeHtml(label)}</span><select id="${id}" data-memo-choice="${kind}">${renderInlineOptionMarkup(options, value)}</select></label>`;
  }
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || "";
  return `<div class="memo-step"><span>${escapeHtml(label)}</span><button class="memo-choice-button" id="${id}" type="button" data-open-memo-picker="${kind}" aria-label="選擇${escapeHtml(label)}">
    <span>${escapeHtml(selectedLabel || emptyText)}</span><code>${escapeHtml(value)}</code><span aria-hidden="true">⌄</span>
  </button></div>`;
}

function setMemoPresetChoice(kind, value) {
  if (kind === "category") {
    state.memoPreset = { categoryCode: value, procedureId: "", templateCode: "" };
  } else if (kind === "procedure") {
    state.memoPreset.procedureId = value;
    const context = memoPresetContext();
    state.memoPreset.templateCode = context.procedure?.templates?.length === 1 ? context.procedure.templates[0].code : "";
  } else {
    state.memoPreset.templateCode = value;
  }
  renderTableAssistant();
}

function openMemoPresetPicker(kind) {
  const context = memoPresetContext();
  const options = memoPresetOptions(kind, context);
  const titles = { category: "選擇規定備註分類", procedure: "選擇程序、屬性", template: "選擇預設備註內容" };
  const currentValues = {
    category: state.memoPreset.categoryCode,
    procedure: state.memoPreset.procedureId,
    template: state.memoPreset.templateCode,
  };
  openOptionPicker(null, titles[kind], options, `BMSMEMO.preset.${kind}`, (value) => setMemoPresetChoice(kind, value), currentValues[kind]);
}

function memoRecordIsBlank(record) {
  return ["MEMO_SEQ", "MEMO_SEQ_NAME", "DESE"].every((field) => !(record?.[field] || ""));
}

function memoTargetRecord() {
  const rows = activeTables().BMSMEMO || (activeTables().BMSMEMO = []);
  let targetIndex = rows.findIndex(memoRecordIsBlank);
  if (targetIndex < 0) {
    rows.push(blankRecord("BMSMEMO"));
    targetIndex = rows.length - 1;
  }
  return { rows, targetIndex, record: rows[targetIndex] };
}

function addRegulatedMemoPreset() {
  const { procedure, template } = memoPresetContext();
  if (!procedure || !template) {
    toast("請先選擇分類、程序／屬性與備註內容。", "error");
    return;
  }
  const { targetIndex, record } = memoTargetRecord();
  record.MEMO_SEQ = template.code;
  record.MEMO_SEQ_NAME = procedure.label;
  record.DESE = template.body;
  normalizeRowMetadata("BMSMEMO");
  state.activeRecord = targetIndex;
  renderAll();
  setStatus(`已新增「${procedure.label}」規定備註，尚未匯出`, "warn");
  toast("已帶入代碼、程序／屬性名稱與備註內容，仍可在下方修改。 ");
  window.requestAnimationFrame(() => document.querySelector('[data-field="DESE"]')?.focus());
}

function addManualMemoRecord() {
  const { targetIndex } = memoTargetRecord();
  normalizeRowMetadata("BMSMEMO");
  state.activeRecord = targetIndex;
  renderAll();
  setStatus("已準備一筆自由備註，尚未匯出", "warn");
  window.requestAnimationFrame(() => document.querySelector('[data-field="DESE"]')?.focus());
}

function renderTableAssistant() {
  const container = $("#tableAssistant");
  if (!container) return;
  if (state.activeTable !== "BMSMEMO") {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const context = memoPresetContext();
  const categoryOptions = memoPresetOptions("category", context);
  const procedureOptions = memoPresetOptions("procedure", context);
  const templateOptions = memoPresetOptions("template", context);
  const hasLegacyPresets = categoryOptions.length > 0;
  const canManageTemplates = templateStorageEnabled() && Boolean(templateCatalogForTable("BMSMEMO"));
  container.hidden = false;
  container.innerHTML = `<div class="memo-assistant-card">
    <div class="memo-assistant-head">
      <div><p class="eyebrow">舊二維系統內建資料</p><h3>快速新增規定備註</h3></div>
      <span class="memo-source-badge">臺中市 I80</span>
    </div>
    <p class="memo-assistant-intro">依分類縮小範圍，再選程序、屬性與預設備註內容；新增後仍可逐字修改。</p>
    ${hasLegacyPresets ? `<div class="memo-step-grid">
      ${memoChoiceMarkup("category", "1. 分類項目", categoryOptions, state.memoPreset.categoryCode, "請選擇分類")}
      ${memoChoiceMarkup("procedure", "2. 程序、屬性", procedureOptions, state.memoPreset.procedureId, context.category ? "請選擇程序、屬性" : "請先選分類")}
      ${memoChoiceMarkup("template", "3. 備註內容範本", templateOptions, state.memoPreset.templateCode, context.procedure ? "請選擇內容範本" : "請先選程序、屬性")}
    </div>` : `<div class="memo-preset-empty">目前 codebook 沒有舊系統規定備註資料；仍可新增自由備註。</div>`}
    <div class="memo-preview" aria-live="polite">
      ${context.template ? `<div><strong>${escapeHtml(context.procedure.label)}</strong><code>${escapeHtml(context.template.code)}</code></div><p>${escapeHtml(context.template.body)}</p>` : `<p>選好備註內容後，這裡會先顯示完整文字供確認。</p>`}
    </div>
    <div class="memo-assistant-actions">
      <button class="button secondary" type="button" data-add-manual-memo>新增自由備註</button>
      ${canManageTemplates ? `<button class="button secondary" type="button" data-open-memo-templates>自訂備註範本</button>` : ""}
      <span></span>
      <button class="button primary" type="button" data-add-regulated-memo ${context.template ? "" : "disabled"}>新增這則備註</button>
    </div>
  </div>`;
  $$('[data-memo-choice]').forEach((select) => select.addEventListener("change", () => setMemoPresetChoice(select.dataset.memoChoice, select.value)));
  $$('[data-open-memo-picker]').forEach((button) => button.addEventListener("click", () => openMemoPresetPicker(button.dataset.openMemoPicker)));
  container.querySelector('[data-add-regulated-memo]')?.addEventListener("click", addRegulatedMemoPreset);
  container.querySelector('[data-add-manual-memo]')?.addEventListener("click", addManualMemoRecord);
  container.querySelector('[data-open-memo-templates]')?.addEventListener("click", openTemplateDialog);
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
  const currentValue = state.picker.target?.value ?? state.picker.currentValue ?? "";
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

function openOptionPicker(target, title, options, key = "", onChoose = null, currentValue = "") {
  state.picker = { target, onChoose, currentValue, title, options: sortOptionsByName(options), key, filteredIndexes: [], cursor: 0 };
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
  const onChoose = state.picker.onChoose;
  rememberPickerValue(state.picker.key, value);
  $("#optionPickerDialog").close();
  if (typeof onChoose === "function") {
    onChoose(value, label);
    return;
  }
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
  const maxLength = field.maxLength ? ` maxlength="${field.maxLength}"` : "";
  let control;
  if (field.kind === "file") {
    const fileName = record.FILE_NAME || (value ? "已保存的附件" : "尚未選擇檔案");
    const fileSize = Number(record.FILE_SIZE || 0);
    const sizeLabel = fileSize ? `，${(fileSize / 1024).toLocaleString("zh-Hant", { maximumFractionDigits: 1 })} KB` : "";
    control = `<div class="attachment-control">
      <input id="${fieldId}" type="file" accept="image/*,.pdf,application/pdf" multiple data-attachment-input="${field.name}" hidden>
      <button class="button secondary compact" type="button" data-select-attachment="${field.name}">選擇檔案（可多選）</button>
      <button class="quiet-button" type="button" data-download-attachment="${field.name}" ${value ? "" : "disabled"}>下載目前檔案</button>
      <button class="quiet-button danger" type="button" data-clear-attachment="${field.name}" ${value ? "" : "disabled"}>清除檔案</button>
      <small class="attachment-summary">${escapeHtml(`${fileName}${sizeLabel}`)}</small>
    </div>`;
  } else if (field.multiline) {
    control = `<textarea id="${fieldId}" data-field="${field.name}"${maxLength} placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea>`;
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
    control = `<input id="${fieldId}" data-field="${field.name}" value="${escapeHtml(value)}"${maxLength}
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

function recommendedNoticeLine() {
  const applyType = currentApplyType();
  if (!applyType) return "* 請先在「案件主檔」設定申請類型；設定後，左側會標示建議優先填寫的資料群組。";
  const label = currentApplyTypeLabel();
  return `* 表示依申請類型「${applyType}${label && label !== applyType ? ` ${label}` : ""}」及已確認的書表資料關聯，建議優先填寫；未標示的群組仍可照案件需要使用。`;
}

function renderTableNotice() {
  const config = TABLE_CONFIG[state.activeTable];
  const text = [config.notice || "", recommendedNoticeLine()].filter(Boolean).join("\n");
  $("#tableNotice").hidden = !text;
  $("#tableNotice").open = false;
  $("#tableNoticeText").textContent = text;
}

function renderEditor() {
  const config = TABLE_CONFIG[state.activeTable];
  const sections = visibleSections(state.activeTable);
  const record = currentRecord();
  $("#tableRawName").textContent = state.activeTable;
  $("#tableTitle").textContent = config.label;
  $("#formChips").innerHTML = `<span class="form-usage" title="${escapeHtml(config.forms.join("、"))}">使用於 ${config.forms.length} 份書表</span>`;
  renderTableNotice();
  renderTableAssistant();
  $("#emptyState").hidden = Boolean(record);
  $("#editorForm").hidden = !record;
  if (!record) {
    $("#fieldGroups").innerHTML = "";
    $("#fieldCount").textContent = "0 欄";
    syncSectionToggleButton();
    return;
  }
  $("#fieldGroups").innerHTML = sections.map(({ section, index }) => `<details class="field-section ${section.old ? "old-section" : ""}" data-section-index="${index}" ${sectionStartsOpen(state.activeTable, section, index) ? "open" : ""}>
    <summary class="section-heading"><h3>${escapeHtml(section.title)}</h3></summary>
    <div class="section-body">
      ${section.copyCurrent || (section.templateAction && templateStorageEnabled() && templateCatalogForTable(state.activeTable)) ? `<div class="section-actions">
        ${section.copyCurrent ? `<button class="button secondary compact section-copy-button" type="button" data-copy-current="${section.copyCurrent}">${escapeHtml(section.copyLabel)}</button>` : ""}
        ${section.templateAction && templateStorageEnabled() && templateCatalogForTable(state.activeTable) ? `<button class="button secondary compact" type="button" data-open-section-template>管理書表長文字範本</button>` : ""}
      </div>` : ""}
      ${section.note ? `<details class="section-help"><summary>填寫說明</summary><p>${escapeHtml(section.note)}</p></details>` : ""}
      <div class="field-grid">${section.fields.map((field) => renderField(field, record, state.activeTable)).join("")}</div>
    </div>
  </details>`).join("");
  $("#fieldCount").textContent = `${visibleFields(state.activeTable).length} 欄`;
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
  $$("[data-open-section-template]").forEach((button) => button.addEventListener("click", openTemplateDialog));
  $$("[data-select-attachment]").forEach((button) => button.addEventListener("click", () => {
    button.closest(".field").querySelector("[data-attachment-input]").click();
  }));
  $$("[data-attachment-input]").forEach((input) => input.addEventListener("change", (event) => {
    handleAttachmentFiles([...event.currentTarget.files]).catch((error) => toast(error.message, "error"));
  }));
  $$("[data-download-attachment]").forEach((button) => button.addEventListener("click", downloadCurrentAttachment));
  $$("[data-clear-attachment]").forEach((button) => button.addEventListener("click", clearCurrentAttachment));
  $$(".field-info").forEach((button) => button.addEventListener("click", () => toast(button.title)));
  $$(".field-section").forEach((section) => section.addEventListener("toggle", () => {
    state.sectionOpen[sectionOpenKey(state.activeTable, Number(section.dataset.sectionIndex))] = section.open;
    syncSectionToggleButton();
  }));
  applyFieldSearch();
  syncSectionToggleButton();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function applyAttachmentFile(record, file) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} 超過單檔 12 MB 上限。`);
  record.barcode = arrayBufferToBase64(await file.arrayBuffer());
  record.FILE_NAME = file.name;
  record.MIME_TYPE = file.type || "application/octet-stream";
  record.FILE_SIZE = String(file.size);
}

async function handleAttachmentFiles(files) {
  if (state.activeTable !== "RPTPHOTO" || !files.length) return;
  const rows = activeTables().RPTPHOTO;
  const current = currentRecord();
  if (!current) return;
  const inheritedFormCode = current.FORM_CODE || "B14-4";
  for (let index = 0; index < files.length; index += 1) {
    const record = index === 0 ? current : blankRecord("RPTPHOTO");
    if (!record.FORM_CODE) record.FORM_CODE = inheritedFormCode;
    await applyAttachmentFile(record, files[index]);
    if (index > 0) rows.push(record);
  }
  normalizeRowMetadata("RPTPHOTO");
  state.activeRecord = Math.max(0, rows.length - 1);
  renderAll();
  setStatus(`已加入 ${files.length} 個附件，尚未匯出完整案件 JSON`, "warn");
  toast(`已保存 ${files.length} 個檔案；請匯出完整案件 JSON 留存。`);
}

function downloadCurrentAttachment() {
  const record = currentRecord();
  if (!record?.barcode) return;
  try {
    const binary = atob(record.barcode);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: record.MIME_TYPE || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = record.FILE_NAME || "CPAMI_attachment";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    toast("目前附件內容不是有效的 Base64，無法下載。", "error");
  }
}

function clearCurrentAttachment() {
  const record = currentRecord();
  if (!record) return;
  for (const field of ["barcode", "FILE_NAME", "MIME_TYPE", "FILE_SIZE"]) record[field] = "";
  renderEditor();
  setStatus("已清除目前附件檔案，尚未匯出完整案件 JSON", "warn");
}

function renderAll() {
  syncZipExportAvailability();
  syncTemplateButton();
  renderFormSetSwitcher();
  renderNav();
  const editable = FORM_SETS[state.formSet].tables.length > 0;
  $("#formSetPlaceholder").hidden = editable;
  $("#editorWorkspaceHead").hidden = !editable;
  $("#tableNotice").hidden = !editable;
  $("#editorFieldPanel").hidden = !editable;
  if (!editable) {
    renderFormSetPlaceholder();
    applyRawFieldVisibility();
    return;
  }
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
    for (const rows of Object.values(activeTables())) {
      for (const row of rows) {
        for (const keyField of ["INDEX_KEY", "Index_key", "index_key"]) {
          if (Object.hasOwn(row, keyField)) row[keyField] = record.INDEX_KEY;
        }
      }
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
  if (state.activeTable === "BMSBASE" && field === "APPLY_TYPE") {
    renderNav();
    renderTableNotice();
  }
  if (event.type === "change" && ["BMPAS", "DIST", "DIST_OLD"].includes(field)) renderEditor();
}

function selectedCodeLabel(table, field, value, record) {
  return optionsFor(table, field, record).find(([code]) => code === value)?.[1] || "";
}

function hydrateDerived(table, record, changedField = "") {
  const codeMap = {
    "BMSBASE.USAGE_CODE": ["USAGE_CODE_DESC", { "01": "住宅" }],
    "BMSBASE.CHG_PRIN": ["CHG_PRIN_DESC", { "1": "全部檢討", "2": "僅規定項目檢討", "3": "全部免檢討" }],
    "BMSMEMO.MEMO_SEQ": ["MEMO_SEQ_NAME", { M591: "火災警報器", M2Q1: "污水用戶", M161: "地質敏感" }],
    "C21_3.Rpt_Seq": ["Rpt_Item", {}],
  };
  const direct = codeMap[`${table}.${changedField}`];
  if (direct && !record[direct[0]]) {
    record[direct[0]] = selectedCodeLabel(table, changedField, record[changedField], record) || direct[1][record[changedField]] || "";
  }
  if (table === "BMSCHK" && changedField === "CHK_Item_code" && !record.CHK_Item) {
    record.CHK_Item = selectedCodeLabel(table, changedField, record[changedField], record);
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
  for (const field of fieldOrderFor(table)) record[field] = "";
  const baseKey = activeTables().BMSBASE?.[0]?.INDEX_KEY || "";
  for (const keyField of ["INDEX_KEY", "Index_key", "index_key"]) {
    if (Object.hasOwn(record, keyField)) record[keyField] = baseKey;
  }
  if (table === "C21_3") record.Rpt_FmName = "C21-3";
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
  if (!rows.length || !tableMetaFor(state.activeTable)?.repeatable) return;
  const caption = recordCaption(state.activeTable, rows[state.activeRecord], state.activeRecord);
  if (!window.confirm(`確定刪除「${caption}」？`)) return;
  rows.splice(state.activeRecord, 1);
  state.activeRecord = Math.max(0, state.activeRecord - 1);
  setStatus("已刪除一筆記錄", "warn");
  renderAll();
}

function clearTableData(table) {
  const repeatable = Boolean(tableMetaFor(table)?.repeatable);
  activeTables()[table] = repeatable ? [] : [blankRecord(table)];
  return activeTables()[table];
}

function openClearCurrentTableDialog() {
  const table = state.activeTable;
  const rows = activeTables()[table] || [];
  if (!rows.length) return;
  const label = TABLE_CONFIG[table].label;
  const repeatable = Boolean(tableMetaFor(table)?.repeatable);
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

function bulkComparisonConfig(table = state.activeTable) {
  return BULK_COMPARISON_CONFIG[table] || null;
}

function bulkComparisonPairs(table = state.activeTable) {
  return bulkComparisonConfig(table) ? (COPY_CURRENT_TO_OLD[table] || []) : [];
}

function bulkFieldNamesForTable(table = state.activeTable) {
  const baseFields = BULK_FIELDS[table] || [];
  const pairs = bulkComparisonPairs(table);
  if (!pairs.length) return baseFields;
  const pairedNames = new Set(pairs.flat());
  const commonFields = baseFields.filter((name) => !pairedNames.has(name));
  const sideIndex = state.bulkComparisonSide === "old" ? 1 : 0;
  return [...commonFields, ...pairs.map((pair) => pair[sideIndex])];
}

function bulkValuesDiffer(record, sourceField, oldField) {
  return String(record[sourceField] ?? "") !== String(record[oldField] ?? "");
}

function bulkFieldDiffers(table, record, fieldName) {
  const pair = bulkComparisonPairs(table).find(([sourceField, oldField]) => sourceField === fieldName || oldField === fieldName);
  return pair ? bulkValuesDiffer(record, pair[0], pair[1]) : false;
}

function bulkRowHasDifferences(table, record) {
  return bulkComparisonPairs(table).some(([sourceField, oldField]) => bulkValuesDiffer(record, sourceField, oldField));
}

function refreshBulkDifferenceIndicators(rowIndex) {
  const table = state.activeTable;
  if (!bulkComparisonConfig(table)) return;
  const record = activeTables()[table]?.[rowIndex];
  const row = document.querySelector(`[data-bulk-row-index="${rowIndex}"]`);
  if (!record || !row) return;
  const rowDiffers = bulkRowHasDifferences(table, record);
  const selectWrap = row.querySelector(".bulk-select-wrap");
  selectWrap?.classList.toggle("has-difference", rowDiffers);
  const checkbox = row.querySelector("[data-bulk-select]");
  if (checkbox) checkbox.setAttribute("aria-label", `選取第 ${rowIndex + 1} 列${rowDiffers ? "，本次與變更前資料有差異" : ""}`);
  row.querySelectorAll("[data-bulk-cell]").forEach((cell) => {
    const differs = bulkFieldDiffers(table, record, cell.dataset.bulkCell);
    cell.classList.toggle("bulk-cell-different", differs);
    cell.title = differs ? "此欄位的本次與變更前資料不同" : "";
  });
}

function renderBulkComparisonControls(table) {
  const config = bulkComparisonConfig(table);
  const bar = $("#bulkComparisonBar");
  bar.hidden = !config;
  if (!config) return;
  const showingOld = state.bulkComparisonSide === "old";
  $("#bulkComparisonViewLabel").textContent = showingOld ? config.oldLabel : config.currentLabel;
  $("#bulkComparisonToggleButton").textContent = showingOld ? `切換至${config.currentLabel}` : `切換至${config.oldLabel}`;
  $("#bulkCopyAllToOldButton").textContent = `全部帶入${config.oldLabel}`;
  $("#bulkCopyAllToOldButton").disabled = !(activeTables()[table] || []).length;
}

function toggleBulkComparisonSide() {
  if (!bulkComparisonConfig()) return;
  const selected = selectedBulkIndexes();
  state.bulkComparisonSide = state.bulkComparisonSide === "old" ? "current" : "old";
  renderBulkTable(selected);
}

function copyAllBulkCurrentValuesToOld() {
  const table = state.activeTable;
  const rows = activeTables()[table] || [];
  const pairs = bulkComparisonPairs(table);
  if (!rows.length || !pairs.length) return;
  const selected = selectedBulkIndexes();
  for (const record of rows) copyMappedValues(record, pairs);
  state.bulkDirty = true;
  renderBulkTable(selected);
  setStatus(`已將 ${rows.length} 筆本次資料全部帶入變更前／原核准欄位，尚未匯出`, "warn");
  toast(`已同步 ${rows.length} 筆、每筆 ${pairs.length} 個欄位；本次空白值也已覆蓋原值。`);
}

function normalizeRowMetadata(table) {
  const rows = activeTables()[table] || [];
  rows.forEach((record, index) => {
    for (const field of ["person_seq", "Person_seq", "PERSON_SEQ"]) {
      if (Object.hasOwn(record, field)) record[field] = String(index + 1);
    }
    if (Object.hasOwn(record, "SPOKESMAN")) record.SPOKESMAN = index === 0 ? "Y" : "N";
  });
}

function addBulkRows(count) {
  const table = state.activeTable;
  const rows = activeTables()[table];
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

function renderBulkTable(selectedIndexes = []) {
  const table = state.activeTable;
  const fieldNames = bulkFieldNamesForTable(table);
  const fields = fieldNames.map((name) => fieldDefinition(table, name));
  const rows = activeTables()[table] || [];
  const selected = new Set(selectedIndexes);
  const comparison = bulkComparisonConfig(table);
  const viewLabel = comparison ? (state.bulkComparisonSide === "old" ? comparison.oldLabel : comparison.currentLabel) : "";
  $("#bulkDialogTitle").textContent = `${TABLE_CONFIG[table].label} — ${viewLabel ? `${viewLabel} ` : ""}批次表格`;
  renderBulkComparisonControls(table);
  $("#bulkTableArea").innerHTML = `<table class="bulk-table">
    <thead><tr><th>選取</th><th>#</th>${fields.map((field) => `<th class="${bulkColumnClass(field)}" title="${field.name}">${escapeHtml(field.label)}<small class="nav-raw">${field.name}</small></th>`).join("")}</tr></thead>
    <tbody>${rows.map((record, rowIndex) => {
      const rowDiffers = bulkRowHasDifferences(table, record);
      return `<tr data-bulk-row-index="${rowIndex}">
      <td><span class="bulk-select-wrap ${rowDiffers ? "has-difference" : ""}"><input type="checkbox" data-bulk-select="${rowIndex}" ${selected.has(rowIndex) ? "checked" : ""} aria-label="選取第 ${rowIndex + 1} 列${rowDiffers ? "，本次與變更前資料有差異" : ""}"></span></td>
      <td>${rowIndex + 1}</td>
      ${fields.map((field, columnIndex) => {
        const differs = bulkFieldDiffers(table, record, field.name);
        return `<td class="${bulkColumnClass(field)} ${differs ? "bulk-cell-different" : ""}" data-bulk-cell="${field.name}" ${differs ? 'title="此欄位的本次與變更前資料不同"' : ""}>${renderBulkControl(table, field, record, rowIndex, columnIndex)}</td>`;
      }).join("")}
    </tr>`;
    }).join("")}</tbody>
  </table>`;

  $$('[data-bulk-field]').forEach((control) => {
    const update = (event) => {
      const row = activeTables()[table][Number(control.dataset.bulkRow)];
      row[control.dataset.bulkField] = control.value;
      hydrateDerived(table, row, control.dataset.bulkField);
      state.bulkDirty = true;
      setStatus("批次表格已修改，尚未匯出", "warn");
      refreshBulkDifferenceIndicators(Number(control.dataset.bulkRow));
      if (event.type === "change" && (codeSpecFor(table, control.dataset.bulkField) || ["DIST", "DIST_OLD"].includes(control.dataset.bulkField))) {
        const area = $("#bulkTableArea");
        const top = area.scrollTop, left = area.scrollLeft;
        const selected = selectedBulkIndexes();
        renderBulkTable(selected);
        $("#bulkTableArea").scrollTop = top;
        $("#bulkTableArea").scrollLeft = left;
      }
    };
    control.addEventListener("input", update);
    control.addEventListener("change", update);
    control.addEventListener("paste", handleBulkPaste);
  });
  $$('[data-open-bulk-picker]').forEach((button) => button.addEventListener("click", () => {
    const row = activeTables()[table][Number(button.dataset.bulkPickerRow)];
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
  const fieldNames = bulkFieldNamesForTable(table);
  const fields = fieldNames.map((name) => fieldDefinition(table, name));
  const matrix = parseClipboardMatrix(text);
  if (!matrix.length) return;
  const headerTargets = matrix[0].map((heading) => fields.find((field) => [normalizeName(field.name), normalizeName(field.label)].includes(normalizeName(heading)))?.name || "");
  const hasHeader = headerTargets.some(Boolean);
  const sourceRows = hasHeader ? matrix.slice(1) : matrix;
  const startRow = Number(event.currentTarget.dataset.bulkRow);
  const startColumn = Number(event.currentTarget.dataset.bulkCol);
  while (activeTables()[table].length < startRow + sourceRows.length) activeTables()[table].push(blankRecord(table));
  sourceRows.forEach((sourceRow, rowOffset) => {
    const target = activeTables()[table][startRow + rowOffset];
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
    const record = deepClone(activeTables()[table][index]);
    for (const field of ["識別碼", "CR_DATE", "UP_DATE", "OP_USER"]) if (Object.hasOwn(record, field)) record[field] = "";
    activeTables()[table].push(record);
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
  for (const index of selected.sort((a, b) => b - a)) activeTables()[table].splice(index, 1);
  state.bulkDirty = true;
  normalizeRowMetadata(table);
  renderBulkTable();
  setStatus(`已刪除 ${selected.length} 列`, "warn");
}

function openBulkEditor() {
  if (!BULK_FIELDS[state.activeTable]) return;
  state.bulkDirty = false;
  state.bulkComparisonSide = "current";
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
    const total = visibleFields(state.activeTable).length;
    $("#fieldCount").textContent = query ? `${visible}／${total} 欄` : `${total} 欄`;
  }
  syncSectionToggleButton();
}

// -----------------------------------------------------------------------------
// caseStore — server interaction and case lifecycle
// -----------------------------------------------------------------------------

function activeTables() {
  return state.tables;
}

function fieldOrderFor(table) {
  return state.bootstrap?.fieldOrder?.[table] || state.bootstrap?.extraFieldOrder?.[table] || [];
}

function tableMetaFor(table) {
  return state.bootstrap?.tableMeta?.[table] || state.bootstrap?.extraTableMeta?.[table] || null;
}

function standardTablesPayload() {
  return Object.fromEntries((state.bootstrap?.tableOrder || []).map((table) => [table, activeTables()[table] || []]));
}

function extraTablesPayload() {
  return Object.fromEntries((state.bootstrap?.extraTableOrder || []).map((table) => [table, activeTables()[table] || []]));
}

function mergeCaseTables(tables, extraTables = {}) {
  return { ...deepClone(tables || {}), ...deepClone(extraTables || {}) };
}

function hasExtraData() {
  return (state.bootstrap?.extraTableOrder || []).some((table) => (activeTables()[table] || []).length > 0);
}

function caseEnvelope() {
  return {
    schemaVersion: state.schemaVersion,
    formSet: state.formSet,
    tables: standardTablesPayload(),
    extraTables: extraTablesPayload(),
  };
}

function sourceIsZip(file) {
  return Boolean(file) && (file.name.toLowerCase().endsWith(".zip") || /zip/i.test(file.type));
}

function clearSourceZip() {
  state.sourceZipFile = null;
  state.sourceZipDataTxtPath = "";
  syncZipExportAvailability();
}

function syncZipExportAvailability() {
  const button = $("#exportZipButton");
  if (!button) return;
  button.disabled = !state.sourceZipFile;
  button.title = state.sourceZipFile
    ? `使用 ${state.sourceZipFile.name}，僅替換 ${state.sourceZipDataTxtPath || "data.txt"}`
    : "請先載入含有 data.txt 的 ZIP";
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || (data.errors || []).join("\n") || "操作失敗");
  return data;
}

function templateStorageEnabled() {
  return Boolean(state.bootstrap?.templateStorage?.enabled);
}

function templateCatalogForTable(table) {
  return (state.bootstrap?.templateStorage?.kinds || []).find((item) => item.sourceTable === table) || null;
}

function templateCatalogForKind(templateKind) {
  return (state.bootstrap?.templateStorage?.kinds || []).find((item) => item.templateKind === templateKind) || null;
}

function templatesForKind(templateKind = state.activeTemplateKind) {
  return state.templates.filter((item) => item.templateKind === templateKind);
}

function selectedTemplate() {
  return state.templates.find((item) => item.templateId === state.selectedTemplateId) || null;
}

function syncTemplateButton() {
  const button = $("#templateButton");
  if (!button) return;
  const catalog = templateCatalogForTable(state.activeTable);
  button.hidden = !templateStorageEnabled() || !catalog;
  button.title = catalog ? `管理${catalog.label}共用範本` : "目前資料群組不支援共用範本";
  button.textContent = catalog ? `${catalog.label}範本` : "共用範本";
}

async function refreshTemplates(selectedId = "") {
  if (!templateStorageEnabled()) {
    state.templates = [];
    state.selectedTemplateId = "";
    return [];
  }
  const data = await apiJson("/api/templates");
  state.templates = Array.isArray(data.templates) ? data.templates : [];
  state.selectedTemplateId = selectedId && state.templates.some((item) => item.templateId === selectedId)
    ? selectedId
    : "";
  return state.templates;
}

function nonEmptyTemplateEntries(template) {
  const catalog = templateCatalogForKind(template?.templateKind);
  if (!catalog || catalog.sourceTable !== template?.sourceTable || !template?.fields) return [];
  const allowedFields = new Set(catalog.fields || []);
  return Object.entries(template.fields).filter(([field, value]) => allowedFields.has(field) && typeof value === "string" && value !== "");
}

function applyTemplateFields(template, overwrite = false) {
  const catalog = templateCatalogForKind(template?.templateKind);
  const entries = nonEmptyTemplateEntries(template);
  if (!catalog || !entries.length) return 0;
  const table = catalog.sourceTable;
  const rows = activeTables()[table] || (activeTables()[table] = []);
  let targetIndex = state.activeTable === table ? Math.min(state.activeRecord, Math.max(0, rows.length - 1)) : 0;
  if (catalog.applyMode === "new-or-blank" && !overwrite) {
    targetIndex = rows.findIndex((record) => (catalog.fields || []).every((field) => !(record[field] || "")));
    if (targetIndex < 0) {
      rows.push(blankRecord(table));
      targetIndex = rows.length - 1;
    }
  } else if (!rows.length) {
    rows.push(blankRecord(table));
    targetIndex = 0;
  }
  const record = rows[targetIndex] || rows[0];
  let changed = 0;
  for (const [field, value] of entries) {
    if (overwrite || (record[field] ?? "") === "") {
      if (record[field] !== value) changed += 1;
      record[field] = value;
    }
  }
  normalizeRowMetadata(table);
  return changed;
}

function applyDefaultTemplates() {
  let templateCount = 0;
  let fieldCount = 0;
  for (const template of state.templates.filter((item) => item.isDefault)) {
    if (!nonEmptyTemplateEntries(template).length) continue;
    const changed = applyTemplateFields(template, false);
    templateCount += 1;
    fieldCount += changed;
  }
  return { templateCount, fieldCount };
}

function renderTemplateDialog() {
  const catalog = templateCatalogForKind(state.activeTemplateKind);
  if (!catalog) return;
  const templates = templatesForKind();
  if (!templates.some((item) => item.templateId === state.selectedTemplateId)) {
    state.selectedTemplateId = templates.find((item) => item.isDefault)?.templateId || templates[0]?.templateId || "";
  }
  $("#templateDialogTitle").textContent = `${catalog.label}共用範本`;
  $("#templateScopeMessage").textContent = `只會保存 ${catalog.label}（${catalog.sourceTable}）白名單內的非空白欄位${catalog.fieldSelection ? "；可在下方選擇要收進範本的長文字" : ""}。案件編號、系統欄位與完整案件不會寫入 SQLite。`;
  $("#templateSelect").innerHTML = templates.length
    ? templates.map((item) => `<option value="${escapeHtml(item.templateId)}">${escapeHtml(item.name)}${item.isDefault ? "（預設）" : ""}</option>`).join("")
    : `<option value="">尚無範本</option>`;
  $("#templateSelect").value = state.selectedTemplateId;
  syncTemplateSelection();
}

function renderTemplateFieldChoices(catalog, template) {
  const container = $("#templateFieldChoices");
  if (!catalog?.fieldSelection) {
    container.hidden = true;
    container.innerHTML = "<legend>這個範本要保存哪些長文字</legend>";
    return;
  }
  const selectedFields = new Set(template ? Object.keys(template.fields || {}) : (catalog.fields || []));
  container.hidden = false;
  container.innerHTML = `<legend>這個範本要保存哪些長文字</legend>${(catalog.fields || []).map((field) => {
    const definition = fieldDefinition(catalog.sourceTable, field);
    return `<label><input type="checkbox" data-template-field-choice="${escapeHtml(field)}" ${selectedFields.has(field) ? "checked" : ""}> ${escapeHtml(definition?.label || field)}</label>`;
  }).join("")}`;
}

function syncTemplateSelection() {
  const template = selectedTemplate();
  const catalog = templateCatalogForKind(state.activeTemplateKind);
  $("#templateNameInput").value = template?.name || "";
  $("#templateDefaultCheckbox").checked = Boolean(template?.isDefault);
  $("#templateOverwriteCheckbox").checked = false;
  renderTemplateFieldChoices(catalog, template);
  $("#templateSummary").textContent = template
    ? `「${template.name}」包含 ${nonEmptyTemplateEntries(template).length} 個非空白欄位${template.isDefault ? "，目前是此類別預設範本" : ""}。${catalog?.applyMode === "new-or-blank" ? "未勾選覆蓋時，會新增一筆備註或使用既有空白列。" : "未勾選覆蓋時，只會填入目前空白欄位。"}`
    : "尚未儲存範本。請先在本頁填入資料，再輸入名稱並新增。";
  for (const id of ["applyTemplateButton", "updateTemplateButton", "deleteTemplateButton"]) {
    $(`#${id}`).disabled = !template;
  }
}

async function openTemplateDialog() {
  const catalog = templateCatalogForTable(state.activeTable);
  if (!templateStorageEnabled() || !catalog) return;
  state.activeTemplateKind = catalog.templateKind;
  try {
    await refreshTemplates();
  } catch (error) {
    toast(`無法更新共用範本清單：${error.message}`, "error");
    return;
  }
  state.selectedTemplateId = templatesForKind(catalog.templateKind).find((item) => item.isDefault)?.templateId
    || templatesForKind(catalog.templateKind)[0]?.templateId
    || "";
  renderTemplateDialog();
  $("#templateDialog").showModal();
}

function currentTemplatePayload() {
  const catalog = templateCatalogForKind(state.activeTemplateKind);
  const record = currentRecord();
  if (!catalog || catalog.sourceTable !== state.activeTable || !record) {
    throw new Error("請先在目前資料群組新增並填寫一筆資料。 ");
  }
  let fields = deepClone(record);
  if (catalog.fieldSelection) {
    const selectedFields = new Set($$("[data-template-field-choice]:checked").map((input) => input.dataset.templateFieldChoice));
    fields = Object.fromEntries(Object.entries(fields).filter(([field]) => selectedFields.has(field)));
  }
  return {
    schemaVersion: state.schemaVersion,
    templateKind: catalog.templateKind,
    name: $("#templateNameInput").value.trim(),
    fields,
    isDefault: $("#templateDefaultCheckbox").checked,
  };
}

async function saveCurrentAsTemplate() {
  try {
    const data = await apiJson("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentTemplatePayload()),
    });
    await refreshTemplates(data.template.templateId);
    renderTemplateDialog();
    setStatus(`已新增共用範本「${data.template.name}」`, "ok");
    toast("範本已寫入 SQLite；完整案件仍只存在目前瀏覽器。 ");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function updateSelectedTemplate() {
  const template = selectedTemplate();
  if (!template) return;
  try {
    const data = await apiJson(`/api/templates/${encodeURIComponent(template.templateId)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentTemplatePayload()),
    });
    await refreshTemplates(data.template.templateId);
    renderTemplateDialog();
    setStatus(`已更新共用範本「${data.template.name}」`, "ok");
    toast("範本已用目前這一筆資料更新。 ");
  } catch (error) {
    toast(error.message, "error");
  }
}

function applySelectedTemplate() {
  const template = selectedTemplate();
  if (!template) return;
  const overwrite = $("#templateOverwriteCheckbox").checked;
  const changed = applyTemplateFields(template, overwrite);
  renderAll();
  setStatus(`已套用範本「${template.name}」，更新 ${changed} 個欄位`, "warn");
  toast(changed ? `已${overwrite ? "覆蓋或填入" : "填入"} ${changed} 個欄位。` : "沒有需要更新的欄位。 ");
}

async function deleteSelectedTemplate() {
  const template = selectedTemplate();
  if (!template || !window.confirm(`確定刪除共用範本「${template.name}」？`)) return;
  try {
    await apiJson(`/api/templates/${encodeURIComponent(template.templateId)}`, { method: "DELETE" });
    await refreshTemplates();
    renderTemplateDialog();
    setStatus(`已刪除共用範本「${template.name}」`, "warn");
    toast("共用範本已刪除。 ");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function caseBootstrap() {
  const [data, codebook] = await Promise.all([apiJson("/api/bootstrap"), apiJson("/codebook.json")]);
  state.bootstrap = data;
  state.schemaVersion = data.schemaVersion;
  state.codebook = codebook;
  state.tables = mergeCaseTables(data.tables, data.extraTables);
  await refreshTemplates();
  data.defaultApplication = data.initialCase === "blank"
    ? caseNewBlank("空白案件", true)
    : { templateCount: 0, fieldCount: 0 };
  return data;
}

async function caseImportDataTxt(file) {
  const importingZip = sourceIsZip(file);
  const data = await apiJson(importingZip ? "/api/import-zip" : "/api/import-data-txt", {
    method: "POST", body: await file.arrayBuffer(),
  });
  state.tables = mergeCaseTables(data.tables, data.extraTables);
  state.sourceName = file.name;
  state.sourceZipFile = importingZip ? file : null;
  state.sourceZipDataTxtPath = data.package?.dataTxtPath || "";
  state.formSet = "A";
  state.activeTable = "BMSBASE";
  state.activeTableByFormSet.A = "BMSBASE";
  state.activeRecord = 0;
  syncZipExportAvailability();
  return data;
}

async function caseImportJson(file) {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error("案件 JSON 格式錯誤。"); }
  const data = await apiJson("/api/import-case-json", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  state.tables = mergeCaseTables(data.tables, data.extraTables);
  state.formSet = Object.hasOwn(FORM_SETS, data.formSet) ? data.formSet : "A";
  const tables = FORM_SETS[state.formSet].tables;
  state.activeTable = tables[0] || "BMSBASE";
  state.activeTableByFormSet[state.formSet] = state.activeTable;
  state.activeRecord = 0;
  state.sourceName = file.name;
  clearSourceZip();
  return data;
}

function caseNewBlank(sourceName = "新空白案件", withDefaults = false) {
  const emptyTables = {};
  for (const table of [...state.bootstrap.tableOrder, ...state.bootstrap.extraTableOrder]) emptyTables[table] = [];
  state.tables = emptyTables;
  const base = blankRecord("BMSBASE");
  base.SEQ_NO = "1";
  base.LAST_MODIFY = "00001";
  base.PUBLIC_CODE = "N";
  base.LINK_TYPE = "N";
  base.TempBuild = "N";
  state.tables.BMSBASE = [base];
  state.formSet = "A";
  state.activeTable = "BMSBASE";
  state.activeTableByFormSet = { A: "BMSBASE", B: "BMSSC", C: "C21_3", D: "BMSBASE" };
  state.activeRecord = 0;
  state.sourceName = sourceName;
  clearSourceZip();
  return withDefaults ? applyDefaultTemplates() : { templateCount: 0, fieldCount: 0 };
}

function caseValidate() {
  return apiJson("/api/validate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(caseEnvelope()),
  });
}

function caseExport() {
  return fetch("/api/export", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(caseEnvelope()),
  });
}

function caseExportZip() {
  if (!state.sourceZipFile) throw new Error("請先載入含有 data.txt 的 ZIP。 ");
  const form = new FormData();
  form.append("case", new Blob([JSON.stringify(caseEnvelope())], { type: "application/json" }), "case.json");
  form.append("archive", state.sourceZipFile, state.sourceZipFile.name);
  return fetch("/api/export-zip", { method: "POST", body: form });
}

function caseExportJson() {
  for (const table of [...state.bootstrap.tableOrder, ...state.bootstrap.extraTableOrder]) normalizeRowMetadata(table);
  const json = `\uFEFF${JSON.stringify(caseEnvelope(), null, 2)}\n`;
  downloadTextFile("CPAMI_complete_case.json", json, "application/json");
}

async function loadDataTxt(file) {
  if (hasExtraData() && !window.confirm("載入另一份 data.txt／ZIP 會清除目前完整案件 JSON 中的道路、勘驗、逐月材料與附件資料。確定繼續？")) {
    $("#dataFileInput").value = "";
    return;
  }
  const importingZip = sourceIsZip(file);
  setStatus(importingZip ? "正在讀取 ZIP 內的 data.txt…" : "正在解析 CP950 data.txt…", "warn");
  try {
    const data = await caseImportDataTxt(file);
    renderAll();
    const packageText = importingZip
      ? `；已保留原 ZIP 的 ${data.package.entryCount} 個項目，匯出時可只替換 ${data.package.dataTxtPath}`
      : "";
    setStatus(`已載入 ${file.name}，13 表結構正確${packageText}`, data.validation.ok ? "ok" : "warn");
    toast(importingZip
      ? "ZIP 內的 data.txt 已載入；原 ZIP 會保留到本次頁面關閉為止。 "
      : "data.txt 已載入；原始欄位與未顯示欄位也會完整保留。 ");
  } catch (error) {
    setStatus(importingZip ? "ZIP 載入失敗" : "data.txt 載入失敗", "error");
    toast(error.message, "error");
  } finally {
    $("#dataFileInput").value = "";
  }
}

async function loadCaseJson(file) {
  if (!window.confirm("載入完整案件 JSON 會取代目前畫面中的 13 表與所有擴充資料。確定繼續？")) {
    $("#caseJsonFileInput").value = "";
    return;
  }
  setStatus("正在載入完整案件 JSON…", "warn");
  try {
    const data = await caseImportJson(file);
    renderAll();
    const extraCount = Object.values(data.extraTables || {}).reduce((sum, rows) => sum + rows.length, 0);
    setStatus(`已載入 ${file.name}，含 ${extraCount} 筆擴充資料`, data.validation.ok ? "ok" : "warn");
    toast("完整案件 JSON 已載入；data.txt 13 表與擴充資料都已還原。 ");
  } catch (error) {
    setStatus("案件 JSON 載入失敗", "error");
    toast(error.message, "error");
  } finally {
    $("#caseJsonFileInput").value = "";
  }
}

function newBlankCase() {
  $("#clearCaseDialog").showModal();
}

function confirmClearCase() {
  const applied = caseNewBlank("全案清空後的新案件", true);
  $("#clearCaseDialog").close();
  renderAll();
  const defaultText = applied.templateCount
    ? `；已帶入 ${applied.templateCount} 個預設範本、${applied.fieldCount} 個欄位`
    : "；沒有非空白預設範本需要帶入";
  setStatus(`已全案清空${defaultText}`, "warn");
  toast(applied.templateCount
    ? "案件已清空並帶入共用預設範本。 "
    : "案件已清空；請先填案件主檔，再新增其他資料。 ");
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
    const result = await caseValidate();
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
    const response = await caseExport();
    if (!response.ok) {
      const result = await response.json();
      if (result.errors) showValidation(result);
      else throw new Error(result.error || "匯出失敗");
      setStatus("匯出前檢查未通過", "error");
      return;
    }
    const blob = await response.blob();
    downloadBlob("data.txt", blob);
    $("#exportMenu").open = false;
    setStatus(`已匯出 data.txt（CP950，${blob.size.toLocaleString()} bytes）`, "ok");
    toast("data.txt 已完整產生：13 表、596 欄、固定欄序、CRLF、CP950。擴充資料請另存完整案件 JSON。 ");
  } catch (error) {
    setStatus("匯出失敗", "error");
    toast(error.message, "error");
  }
}

async function exportZipPackage() {
  setStatus("正在驗證並重新封裝 ZIP…", "warn");
  try {
    const response = await caseExportZip();
    if (!response.ok) {
      const result = await response.json();
      if (result.errors) showValidation(result);
      else throw new Error(result.error || "ZIP 匯出失敗");
      setStatus("匯出前檢查未通過", "error");
      return;
    }
    const blob = await response.blob();
    const originalName = state.sourceZipFile.name;
    const filename = `${originalName.replace(/\.zip$/i, "")}_updated.zip`;
    downloadBlob(filename, blob);
    $("#exportMenu").open = false;
    setStatus(`已匯出 ${filename}；僅替換 ${state.sourceZipDataTxtPath || "data.txt"}`, "ok");
    toast("ZIP 已重新封裝；其他檔案的內容與路徑均保持不變。 ");
  } catch (error) {
    setStatus("ZIP 匯出失敗", "error");
    toast(error.message, "error");
  }
}

function exportCaseJson() {
  caseExportJson();
  setStatus("已匯出完整案件 JSON（含 data.txt 13 表與擴充資料）", "ok");
  toast("完整案件 JSON 已產生，可保存道路、勘驗、逐月材料與附件。 ");
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
  if (!tableMetaFor(table)?.repeatable) rows = rows.slice(0, 1);
  if ($("#importModeSelect").value === "append" && tableMetaFor(table)?.repeatable) activeTables()[table].push(...rows);
  else activeTables()[table] = rows;
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
    LAW_01: "41", LAW_02: "03", LAW_03: "05", SEQ_NO: "1", LAST_MODIFY: "00001", LICENSE_USE: "範例使照字第00001號",
    IDENTIFY_LICE_DATE_USE: "1150601", RECEIVE_LICE_DATE_USE: "1150605", CHG_EXP: "2", CHG_PRIN: "2", DOC1: "Y", DOC2: "Y", DOC3: "N", DOC4: "N",
    LAND_GET_TIME: "2", FARM_BUILD: "1", FARM_MEMO: "虛構農舍管制範例",
  }],
  BMSLAN: [
    { SPOKESMAN: "Y", DIST: "436", ROAD_NO1: "100", ROAD_NO2: "1", TOT_AREA: "600.5", USE_AREA: "600.5", USE_CATEGORY_CODE1: "0140", LOCATED: "Y" },
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
  BM_TEC: [{ TEC_ITEM: "2", TEC_NAME: "王範例", TEC_TYPE: "04", CAPACITY_NO: "技證字第000001號", REG_NO: "技執字第000001號", COM_NAME: "範例技師事務所", COM_ZIP: "400", COM_ADDR: "臺中市範例區範例路4號", REG_DATE: "1150101", MEMO: "範例簽證內容" }],
  BMSPARK: [
    { PARK_KIND: "1", CAR_KIND: "1", APPL_KIND: "1", IN_OUT: "1", UP_DOWN: "1", NUM: "8", AREA: "110", AIR_FLAG: "N" },
    { PARK_KIND: "1", CAR_KIND: "2", APPL_KIND: "2", IN_OUT: "2", UP_DOWN: "1", NUM: "12", AREA: "30", AIR_FLAG: "N" },
  ],
  BMSSTAIR: [
    { STORY_CODE: "U0010", USAGE_CODE1: "H2", USAGE_CODE1_DESC: "住宅", USAGE_CODE1_T: "H2", STORY_AREA: "500", STORY_HEIGHT: "3.6", VERANDA_AREA: "20", TERRACE_AREA: "0" },
    { STORY_CODE: "U0020", USAGE_CODE1: "H2", USAGE_CODE1_DESC: "住宅", USAGE_CODE1_T: "H2", STORY_AREA: "480", STORY_HEIGHT: "3.2", VERANDA_AREA: "18", TERRACE_AREA: "0" },
  ],
  BMSWORK: [{ CONSNAME: "圍牆", BUILDING_KIND: "RC造", LENGTH: "50", HEIGHT: "2", WIDE: "0.15", AREA: "100", CONNUM: "1式", DESE: "範例雜項工作物" }],
  BMSSC: [{ PRSTYLE: "1", LICENSE_OLD: "範例建照字第00001號", P01_NAME: "範例建設股份有限公司", P04_NAME: "範例營造股份有限公司", COST_PRI_SELECT: "1", COST_PRI: "15000000", ZON_WORKING: "臺中市範例區範例路", ZON_ZIP: "400", DATE_WORK_START: "1150201", AREA_FLOOR: "1800", AREA_UNDER_FLOOR: "0", PARK_INSIDE: "8", PARK_OUTSIDE: "0", BUC1: "Y", BUP1: "Y", BUK2: "Y", BUS4: "Y", PEO_TECH_DATE: "120", PEO_PLAIN_DATE: "360" }],
  BMSROAD: [{ SPOKESMAN: "Y", DIST: "400", ROAD_SEC: "範例路", ALLEY: "", LANE: "", DOOR_NO: "1", LENGTH: "20", WIDE: "8", USE_LIMITE_DAY: "1151231", MEMO: "範例使用道路" }],
  BMSCHK: [{ CHK_Item_code: "000001", CHK_Item: "範例施工勘驗項目", CHK_Reg_Number1: "範例掛號0001", CHK_Date1: "1150301", CHK_OK1: "Y", ARCH_NAME: "李範例", TECH_NAME: "王範例", NET_CHECK: "N", PECT_FLAG: "Y", PECT_DATE: "1150302", PECT_RES: "合格" }],
  BMSSCRP: [
    { PAGE_NO: "1", MONTHS: "115年2月", ITEM01: "10", ITEM02: "20", ITEM04: "30", ITEM07: "40", ITEM08: "5", PEO_TECH_DATE: "12", PEO_PLAIN_DATE: "36" },
    { PAGE_NO: "1", MONTHS: "115年3月", ITEM01: "8", ITEM02: "16", ITEM04: "24", ITEM07: "32", ITEM08: "4", PEO_TECH_DATE: "10", PEO_PLAIN_DATE: "30" },
  ],
  RPTPHOTO: [{ FORM_CODE: "B14-4", CR_DATE: "1150302", MEMO: "請在前端選擇範例照片或附件；CSV／XML 中 barcode 可留空。" }],
  C21_3: [
    { Rpt_FmName: "C21-3", Rpt_Seq: "001", Rpt_Item: "【1.防火區劃】", Rpt_Data: "符合規定" },
    { Rpt_FmName: "C21-3", Rpt_Seq: "002", Rpt_Item: "【2.分間牆】", Rpt_Data: "依圖說檢討" },
  ],
  BMELVTR: [{ CMEPAS: "I80", CMENUM: "範例列管0001", PAKENO: "E01", CHECK_YEAR: "115", CMENAM: "範例昇降機", BUILD_NAME: "範例集合住宅", BUILD_ADDR: "臺中市範例區範例路1號", CHECK_RESULT: "合格", USE_LICENSE: "範例使照字第00001號", CHECK_DATE: "1150601", VALID_DATE: "1160531", FACILITY_NO: "1", FACILITY_SCALE: "載重1000公斤", ELEV_USE: "B", MFT_NAME: "範例電梯股份有限公司", MFT_NO: "M0001", CHECK_MAN_NO: "C0001", CHECK_MAN_NAME: "王範例", LIC_NUM: "L0001" }],
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
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
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

let fileDragDepth = 0;

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function hideFileDropOverlay() {
  fileDragDepth = 0;
  document.body.classList.remove("file-drag-active");
  $("#fileDropOverlay").setAttribute("aria-hidden", "true");
}

function showFileDropOverlay() {
  document.body.classList.add("file-drag-active");
  $("#fileDropOverlay").setAttribute("aria-hidden", "false");
}

function loadDroppedCaseFile(file) {
  if (!file || !/\.(?:txt|zip)$/i.test(file.name)) {
    toast("只支援 data.txt 或 ZIP 檔案。", "error");
    return;
  }
  loadDataTxt(file);
}

async function bootstrap() {
  try {
    const data = await caseBootstrap();
    state.showRawFields = storageGet("cpami-show-raw-fields") === "1";
    const tableOptions = Object.entries(TABLE_CONFIG).map(([table, config]) => `<option value="${table}">${escapeHtml(config.label)} — ${table}</option>`).join("");
    $("#targetTableSelect").innerHTML = tableOptions;
    $("#sampleTableSelect").innerHTML = tableOptions;
    renderAll();
    const defaults = data.defaultApplication || { templateCount: 0, fieldCount: 0 };
    setStatus(defaults.templateCount
      ? `已建立空白案件並帶入 ${defaults.templateCount} 個預設範本、${defaults.fieldCount} 個欄位`
      : "已建立空白案件，可以開始填寫或主動載入既有資料", "ok");
  } catch (error) {
    setStatus("無法連接本機格式服務", "error");
    toast(error.message, "error");
  }
}

$("#loadDataButton").addEventListener("click", () => $("#dataFileInput").click());
$("#loadCaseJsonButton").addEventListener("click", () => $("#caseJsonFileInput").click());
$("#exportCaseJsonButton").addEventListener("click", exportCaseJson);
$("#newCaseButton").addEventListener("click", newBlankCase);
$("#confirmClearCaseButton").addEventListener("click", confirmClearCase);
$("#templateButton").addEventListener("click", openTemplateDialog);
$("#templateSelect").addEventListener("change", (event) => {
  state.selectedTemplateId = event.target.value;
  syncTemplateSelection();
});
$("#saveTemplateButton").addEventListener("click", saveCurrentAsTemplate);
$("#updateTemplateButton").addEventListener("click", updateSelectedTemplate);
$("#applyTemplateButton").addEventListener("click", applySelectedTemplate);
$("#deleteTemplateButton").addEventListener("click", deleteSelectedTemplate);
$("#dataFileInput").addEventListener("change", (event) => { if (event.target.files[0]) loadDataTxt(event.target.files[0]); });
$("#caseJsonFileInput").addEventListener("change", (event) => { if (event.target.files[0]) loadCaseJson(event.target.files[0]); });
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
$("#bulkComparisonToggleButton").addEventListener("click", toggleBulkComparisonSide);
$("#bulkCopyAllToOldButton").addEventListener("click", copyAllBulkCurrentValuesToOld);
$("#fieldSearch").addEventListener("input", applyFieldSearch);
$("#toggleSectionsButton").addEventListener("click", toggleAllSections);
$("#toggleRawFieldsButton").addEventListener("click", toggleRawFieldVisibility);
$("#validateButton").addEventListener("click", () => validateData(true));
$("#exportDataTxtButton").addEventListener("click", exportDataTxt);
$("#exportZipButton").addEventListener("click", exportZipPackage);
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
window.addEventListener("dragenter", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  fileDragDepth += 1;
  showFileDropOverlay();
});
window.addEventListener("dragover", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});
window.addEventListener("dragleave", (event) => {
  if (!fileDragDepth) return;
  fileDragDepth = Math.max(0, fileDragDepth - 1);
  if (!fileDragDepth) hideFileDropOverlay();
});
window.addEventListener("dragend", hideFileDropOverlay);
window.addEventListener("drop", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  hideFileDropOverlay();
  loadDroppedCaseFile(file);
});
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
$("#optionPickerDialog").addEventListener("close", () => {
  state.picker.target = null;
  state.picker.onChoose = null;
  state.picker.currentValue = "";
});
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
for (const id of ["newCaseButton", "loadCaseJsonButton", "exportCaseJsonButton", "openSamplesButton", "validateButton"]) {
  $(`#${id}`).addEventListener("click", () => { $("#actionMenu").open = false; });
}
document.addEventListener("click", (event) => {
  const menu = $("#actionMenu");
  if (menu.open && !event.target.closest("#actionMenu")) menu.open = false;
});

bootstrap();
