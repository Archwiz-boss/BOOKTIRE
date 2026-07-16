# CPAMI 指定書表實用數據對應表

> 範圍：使用者指定的 22 份 A11／A12／A13／A21／A23／A31／A32 書表。
> 分析依據：`cpami/Arch2016C/fsrp/frx*.fr3` 實際資料綁定、`Build.mdb` 欄位，以及原始 `data.txt`。
> 本檔使用 UTF-8 with BOM，原始與輸出的 `data.txt` 則必須維持 CP950／Big5、CRLF。
> 隱私說明：文件中的案件範例值均已去識別化，僅用於說明格式與欄位用途。

## 結論

這 22 份書表實際會從 `data.txt` 的 11 個資料表取值：

`BMSBASE`、`BMSLAN`、`BMSLANOWNER`、`BMSMEMO`、`BMSP01`、`BMSP02`、`BMSP03`、`BMSP04`、`BMSPARK`、`BMSSTAIR`、`BMSWORK`。

`data.txt` 另外還有 `BM_TEC`、`BMSSC`，但這 22 份 `.fr3` 沒有直接或間接綁定它們。編輯器不把它們列為主要輸入群組，但輸出時仍保留完整欄位與原值，確保 13 表格式不變。

最重要的資料規則：

1. 報表顯示的完整地址、完整地號、主管機關、用途、構造、執照字號，多數是程式計算欄位，不是 `data.txt` 的單一欄位。
2. 來源 XML／CSV 要先拆成案件、地號、所有權人、起造人－棟戶關係、專業人員、停車、樓層用途、工作物等列，再填入真實欄名。
3. `*_DESC`、`*_T`、`MEMO_SEQ_NAME` 不是可省略的裝飾資料；報表會直接使用它們，代碼與顯示文字應一起填。
4. 變更設計書表需要同時填本次值與 `*_OLD` 原核准值。

## 前端已匯入的代碼範圍

前端不是只把目前 `data.txt` 出現過的值做成下拉。它已匯入原程式 `bldcode.mdb` 實際存在的 22,383 筆、43 種代碼，並依 `BMPAS`、`DIST` 做連動篩選。由於這份 MDB 日期為 2019-08-23，縣市合併後的臺中市地段並不完整，因此另外合併臺中市政府地政局 2026-05-12 更新的「臺中市土地段代碼對照表」1,626 筆資料。

| 下拉層級／類型 | 目前內容 |
|---|---|
| 縣市 `BMPAS` | 原程式 `PAS` 25 筆 |
| 行政區 `DIST`／地址行政區 | 原程式 `ZON`；選臺中市時為 29 個正式行政區 |
| 地段 `SECTION` | 依縣市＋行政區篩選；臺中市使用官方 1,626 筆並與舊 `SEC` 去重 |
| 土地使用分區／構造 | 原程式 `KIN` 6,618 筆、`STU` 791 筆，依縣市篩選 |
| 用途／樓層 | `BLU` 35 筆、`USECOD` 265 筆、`STC` 179 筆 |

官方來源：[政府資料開放平臺](https://data.gov.tw/dataset/84391)、[臺中市政府資料開放平臺](https://opendata.taichung.gov.tw/search/0229777b-4ea4-45ad-92cf-ff7b42a6755a)。其他縣市仍以舊程式代碼庫為準；若要作全臺最新地段轉換，還需要逐縣市補入現行官方碼表。

## 22 份書表與 data.txt 資料表對應

| 書表 | 實際使用的 data.txt 表 | 主要資料 | data.txt 以外的暫存資料 |
|---|---|---|---|
| A11-1 建造執照申請書表 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP02`、`BMSPARK` | 案件、面積、地號、起造人、設計人、停車、備註 | 無 |
| A11-2 起造人名冊（一） | `BMSBASE`、`BMSP01` | 起造人、棟戶、用途、地址 | 無 |
| A11-2-2 起造人名冊（二） | `BMSBASE` | 案件抬頭 | `BMSP01_11_2_2`；不在本 `data.txt` 13 表內 |
| A11-3 設計人名冊 | `BMSBASE`、`BMSP02` | 設計建築師與事務所 | 無 |
| A11-4 建築物概要表 | `BMSBASE`、`BMSSTAIR` | 防空面積、樓層、用途、面積、層高 | 無 |
| A11-5 委託書（A） | `BMSBASE`、`BMSP01`、`BMSP02`、`BMSP04` | 起造人、設計人、承造人、地址 | 後兩表透過 `BMSP02_RPT`、`BMSP04_RPT` 中介查詢顯示 |
| A11-6 建築物增建概要表 | `BMSBASE`、`BMSSTAIR` | 本次／原核准構造、高度、樓層及面積 | 無 |
| A12-2 地號表 | `BMSBASE`、`BMSLAN` | 地號、土地面積、使用面積、使用分區 | 無 |
| A12-4 土地使用權同意書 | `BMSBASE`、`BMSLANOWNER` | 同意書前言、地號、所有權人、持有／使用面積 | 無 |
| A12-4-2 土地使用權同意書（二） | `BMSBASE` | 同意書前言 | `BMSLANOWNER1`；不在本 `data.txt` 13 表內 |
| A12-5 使用共同壁協定書 | `BMSBASE`、`BMSLAN`、`BMSP01` | 案件、基地、起造人 | 鄰房／鄰地資料 `BMSNEBER` 不在本 `data.txt` 內 |
| A13-1 建照及雜照（變更設計）審查表 | `BMSBASE` | 案件抬頭、執照顯示與連結狀態 | 審查勾選內容主要為模板／程式資料 |
| A13-2 建照及雜照規定項目審查表 | `BMSBASE` | 案件抬頭、縣市與執照顯示 | 審查項目主要為模板／程式資料 |
| A13-3 使用道路申請書 | `BMSBASE`、`BMSP01` | 案件與申請人 | 道路資料 `BMSROAD` 不在本 `data.txt` 內 |
| A13-10 建造及雜照建築師簽證表 | `BMSBASE` | 主管機關、執照顯示、案件連結狀態 | 指定模板未綁 `BM_TEC` 或建築師明細 |
| A21-1 雜項執照申請書 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP02` | 案件、基地、起造人、設計人、備註 | 無 |
| A21-4 雜項工作物概要表 | `BMSBASE`、`BMSWORK` | 工作物名稱、構造、尺寸、面積、造價 | 無 |
| A23-1 山坡地雜項執照審查表 | `BMSBASE` | 案件抬頭與執照顯示 | 審查項目主要為模板／程式資料 |
| A31-1 第一次變更設計申請書 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`～`04`、`BMSPARK` | 變更案件主表、各角色、基地、停車與備註 | 無 |
| A31-4 建築物變更設計概要表 | `BMSBASE`、`BMSSTAIR` | 本次／原核准樓層、用途、面積、層高 | 無 |
| A31-5 雜項工作物變更設計概要表 | `BMSBASE`、`BMSWORK` | 本次／原核准工作物與造價 | 無 |
| A32-2 變更設計地號表 | `BMSBASE`、`BMSLAN` | 本次／原核准地號、面積與使用分區 | 無 |

## 報表計算欄位如何回推 data.txt

| 報表顯示欄位 | data.txt 應填的原始欄位 | 說明 |
|---|---|---|
| `BMSBASE.GOVDESC` | `BMSBASE.BMPAS`、`GOV` | 查縣市／主管機關代碼後組出名稱 |
| `BMSBASE.CODEBIN` | `BUILDING_CATEGORY` | 工程類別代碼，例如 `01` 新建 |
| `BMSBASE.BUILDLINE` | `BUILDING_LINE_WORD`、`BUILDING_LINE_NO`、`BUILDING_DATE` | 組成建築線文號與日期 |
| `BMSBASE.USE_CATEGORY` | `USE_CATEGORY_CODE1..3` + `BMPAS` | 土地使用分區代碼須配縣市查碼 |
| `BMSBASE.BUILDKIN` | `BUILDING_KIND1..3` + `BMPAS` | 建築構造代碼須配縣市查碼 |
| `BMSBASE.BUILDKIN_OLD` | `BUILDING_KIND1_OLD..3_OLD` + `BMPAS` | 原核准構造 |
| `BMSBASE.PUB_LIC` | `LICENSE`、`LICENSE_OLD`、`BMPAS`、`APPLY_TYPE` | 報表抬頭顯示的執照文字；不同申請類型可能取本次或原執照 |
| `BMSBASE.TempBuild_tittle` | `TempBuild` | 臨時建築物標題／註記 |
| `BMSLAN.LANSEC` | `DIST`、`SECTION`、`ROAD_NO1`、`ROAD_NO2` | 組成完整行政區、地段、地號 |
| `BMSLAN.LANZON` | `USE_CATEGORY_CODE1..2` + `BMSBASE.BMPAS` | 組成土地使用分區名稱 |
| `BMSLAN.*_OLD` 顯示 | `DIST_OLD`、`SECTION_OLD`、`ROAD_NO1_OLD`、`ROAD_NO2_OLD`、面積與分區 `_OLD` | A32-2 使用 |
| `BMSLANOWNER.LANOWSEC` | `DIST`、`SECTION`、`ROAD_NO1`、`ROAD_NO2` | 所有權同意書上的完整地號 |
| `BMSLANOWNER.BIRTHDAY` | `owner_birth` | 民國生日文字格式化 |
| `BMSLANOWNER.TOT_AREA_CHAR` | `TOT_AREA_hold` | 面積轉報表文字 |
| `BMSLANOWNER.USE_AREA_CHAR` | `USE_AREA_hold` | 面積轉報表文字 |
| `BMSP01.O_ADDR` | `O_ADDRADR`、`O_ADDRAD1..9` | 戶籍／公司完整地址 |
| `BMSP01.H_ADDR` | `H_ADDRADR`、`H_ADDRAD1..9` | 通訊完整地址 |
| `BMSP01.A_ADDR` | `ADDRADR`、`ADDRAD1..9` | 建築物門牌完整地址 |
| `BMSP01.BIRTHDAY` | `BIRTH_DATE` | 民國生日文字格式化 |
| `BMSP01.USECODE` | `BLD_CODE1..3`、`BLD_CODE*_DESC`、`BLD_CODE*_T` | 組成棟戶用途文字 |
| `BMSP02.COMIDNUM` | `COM_ID_AREA`、`COM_ID_WORD`、`COM_ID_NO`、`COM_ID_NO1` | 組成建築師開業證書字號 |
| `BMSP02.COMZON` | `COM_ZIP` | 事務所行政區顯示名稱 |
| `BMSP03.COMIDNUM`／`ADDZON` | 同 `BMSP02` 的證書與地址欄 | 監造建築師顯示資料 |
| `BMSP04.ARC_REG` | `ARC_REG_WORD`、`ARC_REG_CLAS`、`ARC_REG_PRI`、`ARC_REG_NO` | 組成營造業登記字號 |
| `BMSP04.ADDZON` | `COM_ZIP` | 公司行政區顯示名稱 |
| `BMSPARK.APPL_KIND1..3` | `PARK_KIND`、`CAR_KIND`、`APPL_KIND`、`IN_OUT`、`UP_DOWN`、`NUM`、`AREA` | 依五個分類軸彙總報表欄位 |
| `BMSSTAIR.STORY_FLOOR` | `STORY_CODE` | 樓層代碼轉「地上一層」等顯示文字 |
| `BMSSTAIR.USAGE` | `USAGE_CODE1..3`、`USAGE_CODE*_DESC`、`USAGE_CODE*_T` | 組成樓層用途文字 |
| `BMSSTAIR.*_RPT` | `STORY_AREA`、`STORY_HEIGHT`、`VERANDA_AREA`、`TERRACE_AREA` | 依報表格式輸出數字；`*_OLD` 同理 |

## 只需要對接的實用欄位

以下是前端預設顯示的欄位範圍；系統／相容欄位仍保存在輸出檔，但不要求來源 XML／CSV 提供。

### `BMSBASE` 案件主檔

| 欄位群 | data.txt 欄位 | 來源資料 |
|---|---|---|
| 案件識別 | `INDEX_KEY`、`BMPAS`、`GOV`、`BUILDING_CATEGORY`、`APPLY_TYPE`、`BUILDING_NAME`、`FILENAME`、`LICENSE`、`LICENSE_OLD`、`SEQ_NO`、`LAST_MODIFY` | 案件主檔；`INDEX_KEY` 可由轉檔器產生 |
| 案件旗標 | `PUBLIC_CODE`、`LINK_TYPE`、`TempBuild` | Y／N／空白 |
| 建築線 | `BUILDING_LINE_WORD`、`BUILDING_LINE_NO`、`BUILDING_DATE` | 指定文號與民國日期 |
| 法規 | `LAW_COVER_RATE`、`LAW_SPACE_RATE`、`LAW_01`、`LAW_02`、`LAW_02_DOC`、`LAW_03` | 法定建蔽容積、防火避難／耐震版本，以及性能設計認可日期與文號 |
| 基地面積 | `BASE_AREA_ARC`、`BASE_AREA_SHRINK`、`BASE_AREA_OTHER`、`BASE_AREA_PURPOSE`、`BASE_AREA_TOTAL`、`STATUTORY_OPEN_SPACE` | 面積計算資料，單位㎡ |
| 土地分區 | `USE_CATEGORY_CODE1..3` | KIN 代碼；須與 `BMPAS` 一起查 |
| 建築概要 | `BUIL_AREA_ARC`、`BUIL_AREA_OTHER`、`BUILDING_AREA`、`TOTAL_CONSTRU_AREA`、`BUILD_COVER_RATE`、`SPACE_RATE` | 建築／樓地板面積與實設比率 |
| 用途與構造 | `USAGE_CODE`、`USAGE_CODE_DESC`、`BUILDING_KIND1..3`、`BUILDING_HEIGHT`、`BUILD_HIHIGHT` | 代碼與顯示文字要同步 |
| 規模與造價 | `CHWANG_NO`、`BUILDING_NO`、`UP_FLOOR_NO`、`DN_FLOOR_NO`、`TOT_HOUSE_NO`、`PRICE` | 幢、棟、層、戶、元 |
| 防空避難 | `AIRRAID_U_AREA`、`AIRRAID_D_AREA`、`LAW_AIRRAID_AREA`、`AIRRAID_P_AREA` | 面積，沒有時可為 0 或依原資料語意留白 |
| 雜項／長文字 | `OTHERS_NAME`、`OTHERS_PRICE`、`HOUSE_MEMO`、`A12_TITTLE`、`A12_5TITLE` | 雜項工作物、同意書／協定書前言 |
| 原核准值 | `BUILDING_KIND1_OLD..3_OLD`、`BUILDING_HEIGHT_OLD`、`PRICE_OLD`、`OTHERS_PRICE_OLD` | A11-6、A31 系列使用 |

### `BMSLAN` 基地地號

| 欄位 | 意義／格式 |
|---|---|
| `person_seq`、`SPOKESMAN` | 列序；第一個代表地號通常 Y，其餘 N |
| `DIST`、`SECTION` | 行政區、地段代碼 |
| `ROAD_NO1`、`ROAD_NO2` | 地號母號、子號；不可合併成單欄 |
| `TOT_AREA`、`USE_AREA` | 登記總面積、本案使用面積 |
| `USE_CATEGORY_CODE1`、`USE_CATEGORY_CODE2` | 土地使用分區代碼 |
| `DIST_OLD`、`SECTION_OLD`、`ROAD_NO1_OLD`、`ROAD_NO2_OLD` | 原核准地號 |
| `TOT_AREA_OLD`、`USE_AREA_OLD`、`USE_CATEGORY_CODE1_OLD`、`USE_CATEGORY_CODE2_OLD` | 原核准面積與分區 |
| `LOCATED` | 特定範圍旗標 Y／N／空白 |

前端「變更前地號」區塊提供「一鍵帶入本次地號」，按欄位名稱將本次 `DIST`、`SECTION`、地號母子號、面積及分區代碼複製到對應的 `*_OLD`。本次空白也會覆蓋為原值空白。

### `BMSLANOWNER` 土地所有權關係

| 欄位群 | data.txt 欄位 |
|---|---|
| 地號鍵 | `DIST`、`SECTION`、`ROAD_NO1`、`ROAD_NO2` |
| 所有權人 | `owner_id`、`owner`、`owner_birth`、`owner_add`、`owner_tel`、`owner_memo` |
| 面積 | `TOT_AREA_hold`、`USE_AREA_hold` |
| 排序 | `Person_seq` |

### `BMSMEMO` 備註

| 欄位 | 意義 |
|---|---|
| `MEMO_SEQ` | 備註代碼，例如 `M591` |
| `MEMO_SEQ_NAME` | 代碼顯示名稱，例如「火災警報器」 |
| `DESE` | 本案實際備註全文 |
| `person_seq` | 顯示順序 |

舊二維系統的 `Build.mdb/Bldcode` 另有 6 個規定備註分類、52 個「程序、屬性」與 89 則預設全文。分類只負責先過篩，不寫入 `data.txt`；使用者選定內容後，要把程序代碼、程序名稱與全文一起寫入上述三個業務欄位。自由備註允許代碼與名稱留白。`DESE` 最長 230 字，插入預設內容後仍應允許人工修改。

`BMSBASE.A12_TITTLE` 與 `A12_5TITLE` 是書表長文字，不是規定備註列；兩者可各自保存為共用範本，但套用時仍要落在案件主檔原欄位。

### `BMSP01` 起造人－棟戶－門牌關係

| 欄位群 | data.txt 欄位 |
|---|---|
| 起造人 | `CNAME`、`BIRTH_DATE`、`IDENTIFY_NO`、`Law_represent`、`TEL_NO`、`Fax_NO`、`eMail` |
| 關係與排序 | `person_seq`、`SPOKESMAN`、`BUILDING_NO`、`CHWANG`、`DONG`、`FLOOR`、`HOUSE` |
| 用途 | `BLD_CODE1..3`、`BLD_CODE1_DESC..3_DESC`、`BLD_CODE1_T..3_T` |
| 戶籍／公司地址 | `O_ADDRADR`、`O_ADDRAD1..9` |
| 通訊地址 | `H_ADDRADR`、`H_ADDRAD1..9` |
| 建築物門牌 | `ADDRADR`、`ADDRAD1..9` |

地址欄的 `ADR` 是行政區／郵遞區型代碼；其餘欄依原系統拆存村里鄰、路街段、門牌主號、之號、樓、室及其他文字。來源只有一條完整地址時，應先建立可人工覆核的拆地址步驟，不能全部塞進 `AD9`。

### `BMSP02`／`BMSP03` 設計與監造建築師

| 欄位群 | data.txt 欄位 |
|---|---|
| 人員 | `CNAME`、`IDENTIFY_NO`、`person_seq`、`SPOKESMAN` |
| 開業證書 | `COM_ID_AREA`、`COM_ID_WORD`、`COM_ID_NO`、`COM_ID_NO1` |
| 事務所 | `OFFICE_NAME`、`COM_ZIP`、`COM_ADDRESS` |
| 聯絡 | `TEL_NO`、`FAX_NO`、`eMail` |

### `BMSP04` 承造人／營造業

| 欄位群 | data.txt 欄位 |
|---|---|
| 公司 | `COMPANY_NAME`、`COM_IDNO`、`BOSS`、`COM_ZIP`、`COM_ADDRESS` |
| 營造業登記 | `ARC_REG_WORD`、`ARC_REG_CLAS`、`ARC_REG_PRI`、`ARC_REG_NO` |
| 專任工程人員 | `TECH_NAME`、`TECH_LIC`、`FTENGTYPE` |
| 工地主任 | `SCTNAME`、`SCTNO` |
| 聯絡 | `TEL_NO`、`FAX_NO`、`eMail` |

### `BMSPARK` 停車空間

`PARK_KIND`、`CAR_KIND`、`APPL_KIND`、`IN_OUT`、`UP_DOWN`、`NUM`、`AREA`、`AIR_FLAG`。每個分類組合各一列，不要先把所有停車位合成總數。

### `BMSSTAIR` 樓層用途面積

| 欄位群 | data.txt 欄位 |
|---|---|
| 本次樓層 | `BUILDING_NO`、`STORY_CODE`、`STORY_AREA`、`STORY_HEIGHT`、`VERANDA_AREA`、`TERRACE_AREA` |
| 本次用途 | `USAGE_CODE1..3`、`USAGE_CODE1_DESC..3_DESC`、`USAGE_CODE1_T..3_T` |
| 原核准樓層 | 上述欄位對應的 `*_OLD` 欄位 |
| 排序 | `person_seq` |

前端「變更前／原核准樓層概要」提供「一鍵帶入本次樓層概要」，包括三組用途的代碼、`*_DESC` 與 `*_T` 輔助值；本次空白也會覆蓋為原值空白。

### `BMSWORK` 雜項工作物

本次值：`CONSNAME`、`BUILDING_KIND`、`LENGTH`、`HEIGHT`、`WIDE`、`AREA`、`CONNUM`、`DESE`。A31-5 另填 `CONSNAME_OLD`、`BUILDING_KIND_OLD`、`LENGTH_OLD`、`HEIGHT_OLD`、`WIDE_OLD`、`AREA_OLD`、`DESE_OLD`。

## 目前已確認的代碼

| 代碼類型／欄位 | 代碼 | 顯示資料 | 注意 |
|---|---|---|---|
| 縣市 `BMPAS/GOV` | `I80` | 臺中市／臺中市政府 | 高可信度 |
| 行政區 `DIST` | `436` | 臺中市清水區 | 高可信度 |
| 行政區 `DIST` | `420` | 臺中市豐原區 | 高可信度 |
| 地段 `SECTION` | `4662` | 福安段 | 已由臺中市政府地政局 2026-05 官方地段碼表確認 |
| 工程類別 `BUILDING_CATEGORY` | `01` | 新建 | `BIN` 類型 |
| 申請類型 `APPLY_TYPE` | `A31-1` | 建造變更設計申請 | `APP` 類型 |
| 使用分區 `USE_CATEGORY_CODE*` | `0140` + `I80` | 第四種住宅區 | `KIN`；縣市是查碼條件 |
| 主要用途 `USAGE_CODE` | `01` | 住宅 | `BLU` 類型 |
| 構造 `BUILDING_KIND*` | `10` + `I80` | 鋼筋混凝土造 | `STU`；縣市是查碼條件 |
| 用途類組 `BLD_CODE*`／`USAGE_CODE*` | `H2` | 住宅類組 | `USECOD` |
| 用途類組 | `00` | 其他 | 實際名稱通常由 `*_DESC` 提供 |
| 樓層 `STORY_CODE` | `U0010` | 地上 1 樓 | `STC` 兩段代碼組合 |
| 備註 `MEMO_SEQ` | `M591` | 火災警報器 | `RMK` 兩段代碼組合 |
| 備註 `MEMO_SEQ` | `M2Q1` | 污水用戶 | 同上 |
| 備註 `MEMO_SEQ` | `M161` | 地質敏感 | 同上 |
| 停車各分類 | `1` | 平面／小型車／法定／室內／地上 | 要依欄位的代碼類型分別解讀 |
| 法規 `LAW_01` | `41` | 112/5/10 建築技術規則版本 | `BMLAW1` |
| 法規 `LAW_03` | `05` | 113/3/1 耐震設計規範版本 | `BMLAW2` |

`LAW_01`、`LAW_03` 的歷史選項另由舊程式 `Build.mdb` 補充；`LAW_02` 是性能設計認可日期，`LAW_02_DOC` 是認可通知書文號，兩者不可誤接到 `BMLAW2`。這些舊選項只供相容輸入，不代表個案最新法令判定。

## 建議 XML／CSV 對接方式

不要把所有資料放在單一寬 CSV。建議一個案件搭配以下工作表／檔案／XML 節點：

| 來源節點／CSV | 一列代表 | 目標表 |
|---|---|---|
| `case` | 一個案件 | `BMSBASE` |
| `lands` | 一筆地號 | `BMSLAN` |
| `land_owners` | 一筆地號與一位所有權人的關係 | `BMSLANOWNER` |
| `memos` | 一則備註 | `BMSMEMO` |
| `applicant_units` | 一個起造人 × 棟戶／門牌／用途關係 | `BMSP01` |
| `designers` | 一位設計建築師 | `BMSP02` |
| `supervisors` | 一位監造建築師 | `BMSP03` |
| `contractors` | 一家承造營造業 | `BMSP04` |
| `parking` | 一個停車分類組合 | `BMSPARK` |
| `stories` | 一個樓層 × 用途組合 | `BMSSTAIR` |
| `works` | 一種雜項工作物 | `BMSWORK` |

前端的 CSV／XML 轉換功能一次處理一個目標表，可自動依英文原始欄名或常見中文名稱猜欄位，再由使用者人工確認。「下載範例 CSV／XML」可依資料群組生成全欄位虛構範例；修改後可直接回匯。CSV 使用 UTF-8 BOM＋CRLF，XML 使用 `<CPAMIImport>` 根節點，每一筆使用目標表名作節點。

多地號、多樓層等重複資料可按「批次表格」一次新增 1／10 列，或從 Excel／TSV／CSV 複製矩形範圍直接貼入。若貼上範圍第一列是原始欄名或中文欄名，前端會把它視為標題；不需要逐格新增記錄。

所有業務代碼與 Y／N 欄位已改為共用的固定高度選項視窗：搜尋框固定在清單上方，可依中文名稱或代碼過濾。清單以顯示名稱為主排序；若名稱開頭是中文數字或大寫中文數字，依實際數值排序，名稱前方另有中文字時則依繁體中文筆畫排序。

## 匯出 data.txt 的硬性格式

```text
@TableName BMSBASE
@RecordBegin
@d INDEX_KEY "1150101120000"
@d BMPAS "I80"
@d BUILDING_NAME "工程名稱"
@RecordEnd
```

| 項目 | 必須符合 |
|---|---|
| 資料表 | 13 表皆保留，順序與原始 `data.txt` 相同 |
| 欄位 | 每表固定欄位集合與順序；合計 596 欄 |
| 語法 | `@TableName`、`@RecordBegin`、`@d 欄名 "值"`、`@RecordEnd` |
| 編碼 | CP950／Big5、無 BOM；遇到不能表示的 Unicode 字元必須報錯，不可變成 `?` |
| 換行 | CRLF，檔尾保留 CRLF |
| 空值 | `""`；空白數值不可擅自改為 `"0"` |
| 日期 | 多數採民國 `yyyMMdd` 7 碼 |
| 主鍵 | 全表 `INDEX_KEY` 一致 |
| 子表排序 | `person_seq`／`PERSON_SEQ`／`Person_seq` 使用正整數且同表不可重複 |
| 禁止字元 | 值內不可有半形雙引號或實體 CR／LF；舊格式沒有可靠跳脫規則 |

前端匯出器會以原始 `data.txt` 作 13 表與 596 欄模板。載入既有 `data.txt` 時，未顯示欄位採「保留已載入值」策略；按「新空白案件」則清空所有舊案列，只建立一筆空白 `BMSBASE`，避免把範例個資或隱藏表資料帶入新案。新增列會保留完整欄位集合但以空字串開始。匯出前會檢查數字、民國日期提示、主鍵一致性、序號重複、代碼／說明缺配及 CP950 可編碼性。
