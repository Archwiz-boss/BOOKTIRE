# CPAMI B 系列書表數據對應表

> 範圍：`ALLRPT` 中 code `B` 的 14 份施工管理書表，加上 code `G` 的 5 份 B14 施工勘驗書表。
> 補充範圍：因 `BM_TEC` 與 B 系列共用專業人員資料脈絡，另分析 code `F` 的 `frxBM_TEC.fr3`，但不在本文件中把它改歸 B 組。
> 分析依據：`cpami-form-editor/web/codebook.json`、`cpami/Arch2016C/fsrp/frxB*.fr3`、`Link_frxB12_1.fr3`、`frxBM_TEC.fr3`、`Build.mdb` 欄位結構及 `ARCH2016.exe` 內嵌資料集定義。
> 格式界線：`data.txt` 仍固定為 CP950／Big5、13 表、596 欄；本文件不改變既有格式。
> 隱私說明：本文件只記錄結構、代碼與欄位語意，不引用根目錄真實案件值。
> 研究狀態：Prompt 6 研究與實作依據；2026-07-14 已由使用者決定完整實作 13 表外資料，舊 `data.txt` 仍維持 13 表相容輸出。

## 結論

B／G 兩類共 19 份書表。目前本機 `fsrp` 可找到 18 份對應模板；`ALLRPT` 指定的 B14-2 `B14-2.fr3` 不存在，也沒有其他同名或近似檔案。

B 系列模板實際使用 `data.txt` 13 表中的 7 表：

`BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP03`、`BMSP04`、`BMSSC`。

其中：

- `BMSP03` 是監造人／監造建築師資料，B11-1、B11-4、B13-1、B13-3、B13-5、B13-6、B21-1、B14-1 都會重用。
- `BMSP04` 是承造營造業、負責人、專任工程人員及工地主任資料，B11-1、B11-3、B13-1、B13-3、B13-4、B13-5、B21-1、B14-1、B14-3 都會重用。
- `BMSSC` 的 54 欄確定是 B21-2「營造業承攬建築工程開／竣工查報表」主資料；其 35 個 BUC／BUP／BUK／BUS 旗標語意可以從模板逐項還原。
- `BM_TEC` 不被 19 份 B／G 模板綁定；它由 code `F` 的「建築物結構與設計專業技師簽證報告」使用。本文件仍完成其欄位綁定，以便後續 D／特殊書表組實作。

完整列印還需要 13 表外資料：

1. `BMSROAD`：`Build.mdb` 實體表，B11-1 使用。
2. `BMSCHK`：`Build.mdb` 實體表，B14-1、B14-3 使用；B14-2 因模板缺漏而無法查證。
3. `BMSSCRP`：`Build.mdb` 實體表，B21-2 的逐月材料數量使用。
4. `RptPhoto`：B14-4、B14-5 報表內嵌 SQL 所需的圖片／附件資料表；不在 `Build.mdb`、`_Build.mdb`、`code.mdb` 或兩份案件 `pic/*/code.mdb` 中。

## 使用者決策與實作邊界（2026-07-14）

使用者決定完整提供舊二維使用者需要的 B 系列輸入功能，不把功能限制在 `data.txt` 13 表；同時要求輸出的 `data.txt` 每次仍完整包含原本 13 表、596 欄，不可因切換書表組或額外資料而缺表／缺欄。

因此採用以下雙軌格式：

- `data.txt`：仍是 CP950、13 表、596 欄、固定順序；`BMSROAD/BMSCHK/BMSSCRP/RptPhoto` 不會硬塞進去，避免破壞新二維匯入相容性。
- 完整案件 JSON：schema `2026-07-14.1`，在 `tables` 保存完整 13 表，在 `extraTables` 保存 `BMSROAD`、`BMSCHK`、`BMSSCRP`、`RPTPHOTO`。
- `RPTPHOTO`：除舊報表可確認的 `INDEX_KEY/PERSON_SEQ/barcode/CR_DATE/MEMO`，另保存 `FORM_CODE/FILE_NAME/MIME_TYPE/FILE_SIZE`；`barcode` 使用 Base64 保存原檔內容。
- PostgreSQL：`payload` 同時保存 `tables` 與 `extraTables`；既有 13 個 view 與 data.txt 匯出只投影／序列化 `tables`。

原程式有輸入 UI，但畫面資源已編譯進 `ARCH2016.exe`，不是獨立表單檔。執行檔可查到 `BMSROADQuery`、`BMSCHKQuery`、`BMSSCRPQuery` 元件及「使用道路」「施工勘驗資料」「工程主要材料及人力資源概要資料」等中文群組名稱，證明這些不是單純報表欄位；本編輯器的互動則比照目前已完成的搜尋選單、收合區段、批次表格、清空確認與狀態回饋。

以下看似額外的資料集不需要新增儲存表：

- `BmsP01_22_2_2` 是從 `BMSP01` 動態查詢產生。`ARCH2016.exe` 內嵌 SQL 會以 `CNAME + CNAME_OLD` 分組，並計算 `cnameall`、`cnamecon`；原始欄位仍來自 `BMSP01`。
- `RptLink0`～`RptLink3` 是 `Link_frxB12_1.fr3` 的報表暫存資料集。一般版 `frxB12_1.fr3` 在相同位置直接使用 `BMSBASE` 的 `LICENSE_LINK`、`P01_LINK`、`LAN_LINK`、`ADDR_LINK` 衍生值，因此可視為版面拆分，不是新的案件資料表。
- `BmsMEMO1`、`BMSMEMO_1`、`BMSMEMO_2` 是 `BMSMEMO` 的查詢別名，用來把不同備註列放到不同區塊。

## 書表目錄與本機模板狀態

下表完全依目前 `ALLRPT` 內容排列；名稱不手抄舊畫面。

| 書表 | `ALLRPT` 名稱 | code | 指定模板 | 本機狀態 |
|---|---|---|---|---|
| B11-1 | 建築工程開工申報書 | B | `frxB11_1.fr3` | 存在 |
| B11-2 | 建築工程開工展期申報書 | B | `frxB11_2.fr3` | 存在 |
| B11-3 | 承造人名冊 | B | `frxB11_3.fr3` | 存在 |
| B11-4 | 監造人名冊 | B | `frxB11_4.fr3` | 存在 |
| B12-1 | 變更起造人、承造人、監造人審查表 | B | `frxB12_1.fr3`、`Link_frxB12_1.fr3` | 兩版皆存在 |
| B13-1 | 變更起造人申報書 | B | `frxB13_1.fr3` | 存在 |
| B13-2 | 變更起造人名冊（一） | B | `frxB13_2.fr3` | 存在 |
| B13-2-2 | 變更起造人名冊（二） | B | `frxB13_2_2.fr3` | 存在；由 `BMSP01` 動態分組 |
| B13-3 | 變更承造人申報書 | B | `frxB13_3.fr3` | 存在 |
| B13-4 | 變更承造人名冊 | B | `frxB13_4.fr3` | 存在 |
| B13-5 | 變更監造人申報書 | B | `frxB13_5.fr3` | 存在 |
| B13-6 | 變更監造人名冊 | B | `frxB13_6.fr3` | 存在 |
| B21-1 | 建築工程竣工展期申請書 | B | `frxB21_1.fr3` | 存在 |
| B21-2 | 營造業承攬建築工程開／竣工查報表 | B | `frxB21_2.fr3` | 存在 |
| B14-1 | 建築工程勘驗申報書 | G | `frxB14_1.fr3` | 存在 |
| B14-2 | 建築工程必需勘驗部份申報表 | G | `B14-2.fr3` | **本機缺漏** |
| B14-3 | 建築物監造（監督、查核）報告表 | G | `frxB14_3.fr3` | 存在，但模板內標題／編號不一致 |
| B14-4 | 建築物施工日誌 | G | `frxB14_4.fr3` | 存在，但模板實際是「B14-4 現況照片」 |
| B14-5 | 建築物施工中營造業專任工程人員督察紀錄表 | G | `frxB14_5.fr3` | 存在，但模板實際是「B14-5 檢附附件」 |

### B14 模板差異

- `frxB14_3.fr3` 的報表標題是「施工勘驗申報計畫書」，模板角標卻是 `B14-6`；這與 `ALLRPT` 的 B14-3「建築物監造（監督、查核）報告表」不一致。
- `frxB14_4.fr3` 不是完整施工日誌，而是現況照片清冊；每列綁圖片、拍照日期與說明。
- `frxB14_5.fr3` 不是完整督察紀錄表，而是檢附附件清冊；每列綁圖片與說明。
- 因此後續若要宣稱「完整支援 B14-2～B14-5」，必須先取得正確模板或由使用者確認沿用本機這套附件版行為。

## 19 份 B／G 書表與資料表對應

| 書表 | 實際使用的 13 表 | 主要資料 | 13 表以外／報表暫存資料 |
|---|---|---|---|
| B11-1 | `BMSBASE`、`BMSLAN`、`BMSP01`、`BMSP03`、`BMSP04` | 執照、開工日期、基地、起造／監造／承造及工程人員 | `BMSROAD` 道路使用情形 |
| B11-2 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01` | 原執照、預定／核准開工日、展期理由、起造人 | `LinkQuery` 由主檔連結文字衍生，無額外實體表 |
| B11-3 | `BMSBASE`、`BMSP04` | 承造營造業、負責人、專任工程人員、登記與聯絡資料 | 人數為查詢計數 |
| B11-4 | `BMSBASE`、`BMSP03` | 監造建築師、事務所、開業證書與聯絡資料 | 人數為查詢計數 |
| B12-1 | `BMSBASE` | 執照、起造人、地號、建築地址連結文字 | Link 版用 `RptLink0..3.Memo` 暫存排版；來源仍是主檔 Link 欄位 |
| B13-1 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP03`、`BMSP04` | 本次／原起造人、監造、承造、基地及備註 | 無新增實體表 |
| B13-2 | `BMSBASE`、`BMSP01` | 本次／原起造人逐筆姓名、地址、證號、棟戶範圍 | 無 |
| B13-2-2 | `BMSBASE`、`BMSP01` | 同一新舊起造人名義下的棟、幢、層、戶及用途 | `BmsP01_22_2_2` 為 `BMSP01` 動態分組，不是新表 |
| B13-3 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP03`、`BMSP04` | 本次／原承造營造業、專任工程人員、工地主任 | 無新增實體表 |
| B13-4 | `BMSBASE`、`BMSP04` | 本次／原承造人逐筆名冊 | 無 |
| B13-5 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP03`、`BMSP04` | 本次／原監造建築師及其他案件角色 | 無新增實體表 |
| B13-6 | `BMSBASE`、`BMSP03` | 本次／原監造人逐筆名冊 | 無 |
| B21-1 | `BMSBASE`、`BMSLAN`、`BMSMEMO`、`BMSP01`、`BMSP03`、`BMSP04` | 核准開工、完工／展期日期、展期次數、申請人及工程人員 | 無新增實體表 |
| B21-2 | `BMSBASE`、`BMSSC` | 開／竣工查報主檔、成本、基地、日期、面積、用途／構造旗標、人力 | `BMSSCRP` 逐月材料數量；不在 data.txt |
| B14-1 | `BMSBASE`、`BMSLAN`、`BMSP01`、`BMSP03`、`BMSP04` | 勘驗申報抬頭、基地、三方人員資料 | `BMSCHK.COMCHK` 勘驗項目組合文字 |
| B14-2 | 無法確認 | 模板缺漏 | `ALLRPT` 有目錄，但 `fsrp` 無模板；不得猜欄位 |
| B14-3 | `BMSBASE`、`BMSP04` | 開工日期、承造營造業 | `BMSCHK` 的順序、勘驗項目及組合文字 |
| B14-4 | `BMSBASE` 僅作異動序號抬頭 | 本機模板實際為現況照片 | `RptPhoto.INDEX_KEY/PERSON_SEQ/barcode/CR_DATE/MEMO` |
| B14-5 | `BMSBASE` 僅作異動序號抬頭 | 本機模板實際為檢附附件 | `RptPhoto.INDEX_KEY/PERSON_SEQ/barcode/MEMO` |

## `BM_TEC` 特殊書表綁定

`frxBM_TEC.fr3` 實際使用：

| 來源 | 使用內容 |
|---|---|
| `BM_TEC` | 技師姓名、簽證項目、證書／執照、核准文號、事務所、程式、登記日期、備註與簽證內容 |
| `BMSBASE` | 地上／地下層數、異動序號 |
| `BMSLAN` | 完整地號顯示 |
| `BMSP01` | 建築地址顯示 |

模板直接或透過計算欄位使用 `BM_TEC` 的 `TEC_ITEM`、`TEC_NAME`、`CAPACITY_GET`、`CAPACITY_NO`、`TRX_NO`、`REG_NO`、`COM_NAME`、`COM_ZIP`、`COM_ADDR`、`COM_TEL`、`PROGRAM`、`REG_DATE`、`MEMO`、`TEC_DATA`。`TEC_TYPE` 雖未直接印在這份模板，仍是技師科別的重要原始欄位。

## 報表計算欄位如何回推

| 報表欄位／資料集 | 原始欄位 | 回推規則 |
|---|---|---|
| `BmsBase.GOVDESC`／`GOVNAME` | `BMSBASE.BMPAS`、`GOV` | 查主管機關名稱 |
| `BmsBase.PUB_LIC` | `LICENSE`、`LICENSE_OLD`、`APPLY_TYPE`、`BMPAS` | 組成報表執照抬頭；不同申請類型可能取不同執照欄 |
| `BmsBase.RECEIVE_LICE` | `RECEIVE_LICE_DATE` | 民國日期顯示值 |
| `BmsBase.permit_Start_work` | `Start_work_permit_date` | 核准開工日期顯示值 |
| `BmsBase.pre_Start_work` | `Start_work_pre_date` | 預定開工日期顯示值 |
| `BmsBase.COMPLETE` | `COMPLETE_DATE` | 完工日期顯示值 |
| `BmsBase.Complete_permit` | `Complete_permit_date` | 核准／預定完工日期顯示值 |
| `BmsBase.IDENTIFY_LICE` | `IDENTIFY_LICE_DATE` | 執照核定日期顯示值 |
| `LinkQuery.LICENSE_LINK` | `BMSBASE.LICENSE_LINK` | B12-1 執照文字 |
| `LinkQuery.P01_LINK` | `BMSBASE.P01_LINK` | B12-1 起造人文字 |
| `LinkQuery.LAN_LINK` | `BMSBASE.LAN_LINK` | B12-1 地號文字 |
| `LinkQuery.A_ADDR_LINK` | `BMSBASE.ADDR_LINK` | B12-1 建築地址文字；資料集名稱與實體欄名不同 |
| `BmsLAN.LANSEC` | `DIST`、`SECTION`、`ROAD_NO1`、`ROAD_NO2` | 組成完整行政區、地段、地號 |
| `BmsLAN.LANZON` | `USE_CATEGORY_CODE1/2`＋`BMSBASE.BMPAS` | 查土地使用分區文字 |
| `BmsP01.O_ADDR/H_ADDR` | 各自的 `*_ADR`、`*AD1..9` | 組成戶籍／通訊地址 |
| `BmsP01.A_ADDR/B_ADDR` | `ADDRADR`、`ADDRAD1..9` | 同一組建築物門牌欄位的報表顯示變體；逐列版與彙整版使用不同別名 |
| `BmsP01.BIRTHDAY` | `BIRTH_DATE` | 民國生日格式化；`BIRTHDAY_OLD` 對應 `BIRTH_DATE_OLD` |
| `BmsP01.USECODE` | `BLD_CODE1..3`、`*_DESC`、`*_T` | 組成 B13-2-2 的用途文字 |
| `BmsP01_22_2_2.CNAMECON` | `BMSP01.CNAME`、`CNAME_OLD` | 以新舊姓名組合計算同名義資料筆數 |
| `BmsP03.COMIDNUM` | `COM_ID_AREA`、`COM_ID_WORD`、`COM_ID_NO`、`COM_ID_NO1` | 組成監造建築師開業證書字號；`*_OLD` 同理 |
| `BmsP03.ADDZON` | `COM_ZIP` | 查事務所行政區名稱；`ADDZON_OLD` 對應 `COM_ZIP_OLD` |
| `BmsP04.ARC_REG` | `ARC_REG_WORD`、`ARC_REG_CLAS`、`ARC_REG_PRI`、`ARC_REG_NO` | 組成營造業登記字號；`ARC_REG_OLD` 對應 `_OLD` 欄 |
| `BmsP04.ADDZON` | `COM_ZIP` | 查公司行政區名稱；`ADDZON_OLD` 對應 `COM_ZIP_OLD` |
| `BMSSC.WORK_START/WORK_END` | `DATE_WORK_START`、`DATE_WORK_END` | 舊程式 `CalcFields` 產生的日期顯示欄；原始資料仍填 7 碼民國日期 |
| `BMSSC` 旗標方框 | `PRSTYLE`、`COST_PRI_SELECT`、`BUC*`、`BUP*`、`BUK*`、`BUS*` | 模板用 IIF 轉成 `■`／`□` |
| B21-2 工程總數量 | `BMSSCRP.ITEM01/02/04/07/08` | 逐月列顯示，頁尾用 `SUM` 加總 |
| `BmsCHK.CHKDESC` | `BMSCHK.CHK_Item_code` | 查 `BMPECT` 得到勘驗項目名稱 |
| `BmsCHK.COMCHK` | `BMSCHK` 多個勘驗欄位 | 舊程式 `qryBMSCHKALLCalcFields` 組成；模板沒有暴露精確串接程式，不應自行猜格式 |
| `BM_TEC.COMZON` | `COM_ZIP` | 查行政區名稱 |
| `BM_TEC.REGDATE` | `REG_DATE` | 民國登記日期顯示值 |
| `BM_TEC.TEC_USE` | `TEC_ITEM` | 查 `BMTEC` 簽證項目，組成「○○部份由本技師事務所簽證負責」 |

### 變更申請旗標

- `BMSBASE.B13_3TYPE = Y`：勾選「起造人單獨依建築法第五十五條規定申請變更承造人」。
- `BMSBASE.B13_5TYPE = Y`：勾選「起造人單獨依建築法第五十五條規定申請變更監造人」。
- 其他值在現有模板都顯示未勾選。

## 13 表內的實用欄位

以下只列 B 系列真正需要對接的欄位群；系統欄仍由格式引擎保留。

### `BMSBASE` 案件、執照與工期

| 欄位群 | 原始欄位 | 用途 |
|---|---|---|
| 案件識別 | `INDEX_KEY`、`LAST_MODIFY`、`BMPAS`、`GOV`、`APPLY_TYPE` | 異動序號、主管機關及書表情境 |
| 執照 | `LICENSE`、`LICENSE_OLD`、`LINK_TYPE` | 開工、變更、竣工書表抬頭 |
| 工期日期 | `RECEIVE_LICE_DATE`、`Start_work_pre_date`、`Start_work_permit_date`、`COMPLETE_DATE`、`Complete_permit_date`、`IDENTIFY_LICE_DATE` | 多數為民國 `yyyMMdd` 7 碼 |
| 展期 | `SEQ_NO`、`PS_DESC` | B11-2、B21-1 的展期次數與說明；展期理由也可能由 `BMSMEMO.DESE` 顯示 |
| 變更旗標 | `B13_3TYPE`、`B13_5TYPE` | Y／N／空白；Y 代表起造人單獨申請 |
| B12-1 連結文字 | `LICENSE_LINK`、`P01_LINK`、`LAN_LINK`、`ADDR_LINK` | 審查表直接顯示的已組合文字 |

### `BMSLAN` 基地

`person_seq`、`SPOKESMAN`、`DIST`、`SECTION`、`ROAD_NO1`、`ROAD_NO2`、`TOT_AREA`、`USE_AREA`、`USE_CATEGORY_CODE1/2`。B 系列主要使用完整地號、行政區與使用分區顯示；母號、子號仍不可合併。

### `BMSMEMO` 書表備註

`person_seq`、`MEMO_SEQ`、`MEMO_SEQ_NAME`、`DESE`。B11-2、B13-1、B13-3、B13-5、B21-1 會顯示一筆或多筆 `DESE`；舊程式可用多個查詢別名把不同備註列放到不同段落。

### `BMSP01` 起造人與棟戶範圍

| 欄位群 | 原始欄位 |
|---|---|
| 人員 | `CNAME`、`BIRTH_DATE`、`IDENTIFY_NO`、`TEL_NO`、`Fax_NO`、`eMail` |
| 地址 | `O_ADDRADR/O_ADDRAD1..9`、`H_ADDRADR/H_ADDRAD1..9`、`ADDRADR/ADDRAD1..9` |
| 棟戶範圍 | `BUILDING_NO`、`CHWANG`、`DONG`、`FLOOR`、`HOUSE` |
| 用途 | `BLD_CODE1..3`、`BLD_CODE1_DESC..3_DESC`、`BLD_CODE1_T..3_T` |
| 變更前 | `CNAME_OLD`、`BIRTH_DATE_OLD`、`IDENTIFY_NO_OLD`、`TEL_NO_OLD`、`FAX_NO_OLD`、`EMAIL_OLD`、三組地址 `_OLD`、棟戶 `_OLD` |
| 關係與排序 | `person_seq`、`SPOKESMAN` |

B13-2-2 不是另一套人員資料；它會把同一 `BMSP01` 內相同的新舊姓名組合集中顯示，再列出每筆棟戶與用途。

### `BMSP03` 監造建築師

本次值：`person_seq`、`SPOKESMAN`、`CNAME`、`IDENTIFY_NO`、`COM_ID_AREA`、`COM_ID_WORD`、`COM_ID_NO`、`COM_ID_NO1`、`OFFICE_NAME`、`COM_ZIP`、`COM_ADDRESS`、`TEL_NO`、`FAX_NO`、`eMail`。

變更前值：上述人員、證書、事務所與聯絡欄位的 `*_OLD`；注意原始欄名是 `EMAIL_OLD`，不可改成 `eMail_OLD`。

### `BMSP04` 承造營造業與工程人員

| 欄位群 | 本次欄位 | 變更前欄位 |
|---|---|---|
| 公司／負責人 | `COMPANY_NAME`、`COM_IDNO`、`BOSS`、`COM_ZIP`、`COM_ADDRESS` | 對應 `*_OLD` |
| 營造業登記 | `ARC_REG_WORD`、`ARC_REG_CLAS`、`ARC_REG_PRI`、`ARC_REG_NO` | 對應 `*_OLD` |
| 專任工程人員 | `TECH_NAME`、`TECH_IDNO`、`TECH_LIC`、`FTENGTYPE` | `TECH_NAME_OLD`、`TECH_LIC_OLD`、`FTENGTYPE_OLD` |
| 工地主任 | `SCTNAME`、`SCTNO` | `SCTNAME_OLD`、`SCTNO_OLD` |
| 公會 | `GUILDNO1`、`GUILDNO2` | `GUILDNO1_OLD`、`GUILDNO2_OLD` |
| 聯絡 | `TEL_NO`、`FAX_NO`、`eMail` | `TEL_NO_OLD`、`FAX_NO_OLD`、`EMAIL_OLD` |
| 排序 | `person_seq`、`SPOKESMAN` | — |

### `BMSSC` B21-2 開／竣工查報主檔

| 欄位群 | 原始欄位 | 格式／語意 |
|---|---|---|
| 報表型態 | `PRSTYLE` | `1` 開工查報、`2` 竣工查報 |
| 執照與角色 | `LICENSE_OLD`、`P01_NAME`、`P04_NAME`、`P04_NO` | 建造字號、起造人／工程名稱、承造營造業、營造業編號 |
| 工程總價 | `COST_PUB`、`COST_PUB_MAKING`、`COST_PRI_SELECT`、`COST_PRI` | 金額為純數字；非公有類型 `1` 建設公司、`2` 自建 |
| 工程地點 | `ZON_WORKING`、`ZON_ZIP` | 完整地點文字與郵遞區號 |
| 日期 | `DATE_WORK_START`、`DATE_WORK_END`、`DATE_USELIC` | 民國 `yyyMMdd` 7 碼 |
| 面積／造價／樓層 | `AREA_FLOOR`、`AREA_UNDER_FLOOR`、`FLOOR_COST`、`FLOOR_NUMBER` | 地上／地下樓地板面積、每㎡平均造價、樓層數文字 |
| 停車 | `PARK_INSIDE`、`PARK_OUTSIDE` | 車位數，純數字 |
| 土地分區 | `BUC1..9` | Y／N；依下表 |
| 使用性質 | `BUP1..11` | Y／N；依下表 |
| 建築構造 | `BUK1..6` | Y／N；依下表 |
| 住宅型態 | `BUS1..4` | Y／N；依下表 |
| 人力 | `PEO_TECH_DATE`、`PEO_PLAIN_DATE` | MDB 雖是 Text(7)，模板標示為技術工／普通工「總工日」，不是民國日期；建議非空時驗證為數字字串 |

#### `BMSSC` 旗標對應

| 欄位 | 顯示選項 | 欄位 | 顯示選項 |
|---|---|---|---|
| `BUC1` | 住宅區 | `BUP1` | 純住宅 |
| `BUC2` | 商業區 | `BUP2` | 混合住宅 |
| `BUC3` | 工業區 | `BUP3` | 商店 |
| `BUC4` | 行政區 | `BUP4` | 工廠 |
| `BUC5` | 文教區 | `BUP5` | 辦公室 |
| `BUC6` | 風景區 | `BUP6` | 旅館 |
| `BUC7` | 保護區 | `BUP7` | 倉庫 |
| `BUC8` | 農業區 | `BUP8` | 學校 |
| `BUC9` | 其他 | `BUP9` | 醫院 |
| — | — | `BUP10` | 遊樂場 |
| — | — | `BUP11` | 其他 |
| `BUK1` | 鋼骨鋼筋混凝土 | `BUS1` | 傳統式農村住宅 |
| `BUK2` | 鋼筋混凝土 | `BUS2` | 獨棟或雙併式住宅 |
| `BUK3` | 鋼架 | `BUS3` | 連棟式住宅 |
| `BUK4` | 加強磚造 | `BUS4` | 集合住宅 |
| `BUK5` | 磚石 | — | — |
| `BUK6` | 其他 | — | — |

### `BM_TEC` 專業技師

| 欄位群 | 原始欄位 | 格式／代碼 |
|---|---|---|
| 排序 | `PERSON_SEQ` | 正整數，同表不可重複 |
| 簽證分類 | `TEC_ITEM`、`TEC_TYPE` | `BMTEC` 簽證項目、`TEC` 技師科別 |
| 技師 | `TEC_NAME`、`CAPACITY_GET`、`CAPACITY_NO`、`TRX_NO`、`REG_NO` | 姓名、資格字別、證書、核准／換發文號、執業登記號 |
| 事務所 | `COM_NAME`、`COM_ZIP`、`COM_ADDR`、`COM_TEL`、`COM_FAX` | 名稱、行政區／郵遞碼、地址、電話、傳真 |
| 簽證內容 | `PROGRAM`、`REG_DATE`、`MEMO`、`TEC_DATA` | 結構程式、7 碼登記日期、備註、簽證內容 |

## 13 表外資料的實用欄位

### `BMSROAD` — B11-1 道路使用情形

`Build.mdb` 實體表，共 17 欄：

| 欄位 | 中文意義／格式 |
|---|---|
| `INDEX_KEY` | 案件主鍵 |
| `person_seq`、`SPOKESMAN` | 道路列序、代表列 Y／N |
| `DIST` | 行政區代碼 |
| `ROAD_SEC` | 路／街／段文字 |
| `ALLEY` | 巷 |
| `LANE` | 弄 |
| `DOOR_NO` | 號 |
| `LENGTH` | 使用道路長度（m），Double |
| `WIDE` | 使用道路寬度（m），Double |
| `MEMO` | 道路備註 |
| `USE_LIMITE_DAY` | 使用期限，Text(7)，依舊系統日期慣例為民國日期 |
| `USE_ANSER` | 道路使用答覆／說明，長文字 |
| `CR_DATE`、`UP_DATE`、`OP_USER`、`識別碼` | 系統欄 |

B11-1 模板直接列印 `ROAD_SEC`、`ALLEY`、`LANE`、`DOOR_NO`、`LENGTH`、`WIDE`。

### `BMSCHK` — B14 勘驗資料

`Build.mdb` 實體表，共 35 欄：

| 欄位群 | 原始欄位 | 說明 |
|---|---|---|
| 項目 | `CHK_Item_code`、`CHK_Item`、`PERSON_SEQ` | 項目代碼查 `BMPECT`、顯示文字、順序 |
| 第一次勘驗 | `CHK_Reg_Number1`、`CHK_Date1`、`CHK_Over_Date1`、`CHK_OK1` | 申報／掛號字號、申報日期、完成日期、通過旗標 |
| 結構／建築師 | `Struct_Tech`、`ARCH_NAME` | 結構技師旗標及建築師姓名 |
| 第二次勘驗 | `CHK_Reg_Number2`、`CHK_Date2`、`CHK_Over_Date2`、`CHK_OK2` | 第二組字號、日期、結果 |
| 技師 | `TECH_NAME`、`TECH_LIC` | 技師姓名與證照 |
| 網路申報 | `NET_CHECK`、`NET_CR_DATE`、`NET_REG_DATE`、`NET_REG_NO`、`NET_SEQ` | 網路查核、建立／掛號日期、掛號號碼與順序 |
| 現場查驗 | `PECT_FLAG`、`PECT_RES_ITEM`、`PECT_RES`、`PECT_DATE`、`BOSS_MAN`、`PECT_ITEM`、`PECT_DESC` | 查驗旗標、結果項目、結果、日期、負責人、項目與說明 |
| 複驗 | `PECT_RVLFLAG`、`PECT_RVLDATE` | 複驗旗標與日期 |
| 其他 | `UREMARK`、`CR_DATE`、`UP_DATE`、`OP_USER`、`識別碼` | 備註／系統欄 |

舊程式另外產生 `CHKDESC`（`BMPECT` 查碼）與 `COMCHK`（組合顯示文字）。後者的精確串接邏輯不在 `.fr3`，後續實作應先保留所有原始欄，不能只存最後一條 `COMCHK` 文字。

### `BMSSCRP` — B21-2 逐月材料資料

`Build.mdb` 實體表，共 18 欄：

| 欄位 | 中文意義／格式 |
|---|---|
| `INDEX_KEY` | 案件主鍵 |
| `PERSON_SEQ` | 列序，Double；匯入時應使用正整數 |
| `PAGE_NO` | 頁次／分頁序號，Double |
| `MONTHS` | 月次，Text(20) |
| `ITEM01` | 鋼骨（鋼板及型鋼，噸） |
| `ITEM02` | 鋼筋（噸） |
| `ITEM03` | 模板未使用，語意待舊系統 UI 複核 |
| `ITEM04` | 級配／石料及碎石（m³） |
| `ITEM05`、`ITEM06` | 模板未使用，語意待舊系統 UI 複核 |
| `ITEM07` | 預拌混凝土（m³） |
| `ITEM08` | 瀝青混凝土（m³） |
| `PEO_TECH_DATE`、`PEO_PLAIN_DATE` | Double；本模板未直接使用，名稱顯示可能與技術工／普通工數量有關，須複核 |
| `CR_DATE`、`UP_DATE`、`OP_USER`、`識別碼` | 系統欄 |

B21-2 逐列顯示 `MONTHS` 與 `ITEM01/02/04/07/08`，並在「工程總數量」列分別加總。

### `RptPhoto` — B14-4／B14-5 圖片與附件

本機模板內嵌 SQL：

```sql
SELECT * FROM RptPhoto
WHERE INDEX_KEY = :V1
ORDER BY PERSON_SEQ
```

可由模板確定的欄位至少有：

| 欄位 | 用途 |
|---|---|
| `INDEX_KEY` | 案件主鍵 |
| `PERSON_SEQ` | 圖片／附件順序 |
| `barcode` | 圖片二進位欄；FastReport `TfrxPictureView.DataField` |
| `CR_DATE` | B14-4 拍照日期 |
| `MEMO` | 照片／附件說明 |

本機所有 MDB 都找不到 `RptPhoto` 實體表，因此它可能是列印時連到外部資料庫，或由其他流程建立的暫存表。僅靠目前檔案無法確認完整欄位、圖片格式與生命週期。

## 已確認的代碼與固定選項

| 欄位／類型 | 代碼 | 顯示名稱／行為 | 依據 |
|---|---|---|---|
| `BMSSC.PRSTYLE` | `1` | 開工查報表 | `frxB21_2.fr3` |
| `BMSSC.PRSTYLE` | `2` | 竣工查報表 | `frxB21_2.fr3` |
| `BMSSC.COST_PRI_SELECT` | `1` | 建設公司 | `frxB21_2.fr3` |
| `BMSSC.COST_PRI_SELECT` | `2` | 自建 | `frxB21_2.fr3` |
| `BMSBASE.B13_3TYPE` | `Y` | 起造人單獨申請變更承造人 | `frxB13_3.fr3` |
| `BMSBASE.B13_5TYPE` | `Y` | 起造人單獨申請變更監造人 | `frxB13_5.fr3` |
| `BMSP04.FTENGTYPE` | `1` | 主任技師 | 模板 IIF；目前 codebook 無 `TECTYP` 列 |
| `BMSP04.FTENGTYPE` | `2` | 主任建築師 | 模板 IIF；目前 codebook 無 `TECTYP` 列 |
| `BMSP04.FTENGTYPE` | `3` | 主任技師及主任建築師 | 模板 IIF；目前 codebook 無 `TECTYP` 列 |
| `BMSP04.ARC_REG_CLAS`／`ARCLS` | `1/2/3/4` | 甲／乙／丙／直甲 | `codebook.json` |
| `BMSCHK.CHK_Item_code`／`BMPECT` | 124 筆 | 開工、施工計畫、樓層頂版、雜項工程等勘驗項目 | `codebook.json`；前端應取全量，不手抄 |
| `BM_TEC.TEC_ITEM`／`BMTEC` | `1..6` | 結構設計、地基調查、電氣設計、空調設計、生活汙水、現況測量 | `codebook.json` |
| `BM_TEC.TEC_TYPE`／`TEC` | `01..09` | 土木、結構、應用地質、大地、電機、冷凍空調、環境工程、水土保持、測量 | `codebook.json` |
| `BUC*`／`BUP*`／`BUK*`／`BUS*` | `Y/N/空白` | B21-2 多選方框 | `frxB21_2.fr3` |

## 數字與日期驗證建議

研究階段只提出建議，不在本階段修改驗證器。

建議先以 warning 驗證的數字欄：

- `BMSSC.COST_PUB`、`COST_PUB_MAKING`、`COST_PRI`、`AREA_FLOOR`、`AREA_UNDER_FLOOR`、`PARK_INSIDE`、`PARK_OUTSIDE`。
- `BMSSC.PEO_TECH_DATE`、`PEO_PLAIN_DATE`：雖為 Text，模板語意是總工日。
- `BMSROAD.person_seq`、`LENGTH`、`WIDE`。
- `BMSCHK.PERSON_SEQ`、`NET_SEQ`。
- `BMSSCRP.PERSON_SEQ`、`PAGE_NO`、`ITEM01..08`、`PEO_TECH_DATE`、`PEO_PLAIN_DATE`。

民國日期欄：

- 13 表內：`BMSSC.DATE_WORK_START`、`DATE_WORK_END`、`DATE_USELIC`、`BM_TEC.REG_DATE`，以及既有各表 `CR_DATE/UP_DATE`。
- 13 表外：`BMSROAD.USE_LIMITE_DAY`、`BMSCHK` 的各 `*_DATE*`、`RptPhoto.CR_DATE`。

## 缺口清單與建議處理

缺口非空，因此依 Prompt 6 停止條件，本文件完成後不得直接進入前端實作。

| # | 缺口 | 舊系統位置／證據 | 不處理的影響 | 建議方式 |
|---:|---|---|---|---|
| 1 | `BMSROAD` 不在 data.txt 13 表 | `Build.mdb` 實體表；B11-1 直接綁 6 個道路欄位 | B11-1 道路使用情形無法完整輸入／重建 | 若要完整 B11-1，放入案件 payload 頂層 `extraTables.BMSROAD`，schema 升版；舊 `data.txt` 匯出忽略但不得丟失 |
| 2 | `BMSCHK` 不在 data.txt 13 表 | `Build.mdb` 實體表；B14-1、B14-3 綁定 | 勘驗項目、申報日期、查驗結果無法保存 | 以完整 35 欄放入 `extraTables.BMSCHK`，不要只存計算後 `COMCHK` |
| 3 | `BMSSCRP` 不在 data.txt 13 表 | `Build.mdb` 實體表；B21-2 綁逐月材料列 | B21-2 只能填主檔，不能填逐月材料／總數量 | 放入 `extraTables.BMSSCRP`，保留 `PERSON_SEQ` 與全部 ITEM 欄 |
| 4 | `RptPhoto` 不在任何本機 MDB 與 data.txt | B14-4／5 內嵌 SQL 與 `barcode` 圖片欄 | 照片、附件與說明無法保存 | 不建議把大型圖片塞進 data.txt 或 JSONB；payload 存附件 metadata／reference，二進位放內部系統附件儲存，schema 升版 |
| 5 | B14-2 模板缺漏 | `ALLRPT.sub = B14-2.fr3`，`fsrp` 無檔 | 無法查證欄位與版面，不能可靠實作 | 請提供正確 B14-2 模板／新版舊系統，或明確決定先保留目錄占位 |
| 6 | B14-3～B14-5 目錄與模板不一致 | B14-3 模板自稱 B14-6；B14-4／5 是照片／附件版 | 依目錄名稱做 UI 會與實際列印資料不符 | 先確認要以 `ALLRPT` 業務名稱、還是以本機模板行為為準；未決前不要宣稱完整支援 |

### 已採用的處理方式

已採用「完整案件 payload 擴充」：納入 `BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO`，並提供完整案件 JSON 匯入／匯出；`data.txt` 仍完整輸出原 13 表。B14-2 沒有本機模板、B14-3～B14-5 目錄與模板不一致，仍屬報表呈現缺口，但不再阻止原始資料欄位輸入與保存。
