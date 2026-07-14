# CPAMI C／D 系列書表數據對應表

> 範圍：`ALLRPT` 中 code `C` 的 13 份使用管理書表、code `D` 的 3 份拆除書表、code `F` 的 1 份專業技師書表，以及 code `H` 的 2 份農舍管制書表。
> 分析依據：`cpami-form-editor/web/codebook.json`、`cpami/Arch2016C/fsrp/frxC*.fr3`、`frxD*.fr3`、`Link_frxC12_1.fr3`、`Link_frxD13_1.fr3`、`frxBM_TEC.fr3`、`frxG01.fr3`、`frxG02.fr3`、`Build.mdb` 欄位結構及 `ARCH2016.exe` 內嵌資料集定義。
> 格式界線：舊 `data.txt` 固定為 CP950／Big5、13 表、596 欄；13 表外資料只進入完整案件 JSON／資料庫 payload。
> 隱私說明：只記錄結構、代碼與欄位語意，不引用根目錄真實案件值。
> 研究狀態：Prompt 7 研究與實作依據；使用者已決定完整提供舊二維功能，並要求 `data.txt` 每次維持完整相容輸出。

## 結論

C／D／F／H 共 19 份書表，`ALLRPT` 指定的 19 個模板在本機均存在。另有未列在 `ALLRPT` 的 `frxC21_1A.fr3`，是 C21-1 的擴充版面，不另算一份書表。

這些模板使用 data.txt 13 表中的 11 表：

`BMSBASE`、`BMSLAN`、`BMSLANOWNER`、`BMSMEMO`、`BMSP01`、`BMSP02`、`BMSP03`、`BMSP04`、`BMSPARK`、`BMSSTAIR`、`BM_TEC`。

另外重用 Prompt 6 已納入案件擴充 schema 的：

- `BMSROAD`：D11-1「拆除執照申請書」的借用道路資料。

本輪新增兩個 13 表外資料群組：

1. `C21_3`：C21-3「變更使用執照檢討項目簽證表」的逐項檢討資料。它不是 `Build.mdb` 實體表，而是 `ARCH2016.exe` 內的執行期資料集。
2. `BMELVTR`：C22-5「昇降設備及機械停車設備附表」使用的 `Build.mdb` 實體表，共 25 欄。

code `F` 的 `BM_TEC` 已是 data.txt 13 表之一；code `H` 的兩份農舍清冊只使用既有 `BMSBASE/BMSLAN/BMSLANOWNER/BMSP01`，不需要再發明新表。

## 使用者決策與格式邊界

使用者先前已明確決定「原本二維所有功能都要能填」，同時要求舊 `data.txt` 不得因擴充資料而失去新二維匯入相容性。因此本輪沿用 Prompt 6 的雙軌設計：

- `data.txt`：永遠完整輸出原 13 表、596 欄、固定欄序、CRLF、CP950；沒有資料的子表也輸出完整欄序空白記錄。
- 完整案件 JSON／PostgreSQL payload：`tables` 保存 13 表，`extraTables` 保存 `BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO/C21_3/BMELVTR`。
- `C21_3` 與 `BMELVTR` 不寫進 `data.txt`，避免新二維把未知表視為格式錯誤。

## 書表目錄與模板狀態

| 書表 | `ALLRPT` 名稱 | code | 指定模板 | 本機狀態 |
|---|---|---|---|---|
| C11-1 | 使用執照申請表 | C | `frxC11_1.fr3` | 存在 |
| C11-2 | 起造人名冊(三) | C | `frxC11_2.fr3` | 存在 |
| C11-2-2 | 起造人名冊(四) | C | `frxC11_2_2.fr3` | 存在 |
| C12-1 | 使用執照審查表 | C | `frxC12_1.fr3`、`Link_frxC12_1.fr3` | 兩版皆存在 |
| C21-1 | 變更使用執照申請書 | C | `frxC21_1.fr3` | 存在；另有 `frxC21_1A.fr3` 擴充版 |
| C21-2 | 變更使用執照概要表 | C | `frxC21_2.fr3` | 存在 |
| C21-3 | 變更使用執照檢討項目簽證表 | C | `frxC21_3.fr3` | 存在 |
| C21-4 | 申請人名冊 (使用執照) | C | `frxC21_4.fr3` | 存在 |
| C22-1 | 變更使用執照審查表 | C | `frxC22_1.fr3` | 存在 |
| C22-2 | 變更使用執照竣工勘驗審查表 | C | `frxC22_2.fr3` | 存在 |
| C22-3 | 使用項目更動申請表(一式二分) | C | `frxC22_3.fr3` | 存在 |
| C22-4 | 變更使用委託書 | C | `frxC22_4.fr3` | 存在 |
| C22-5 | 昇降設備 | C | `frxC22_5.fr3` | 存在 |
| D11-1 | 拆除執照申請書 | D | `frxD11_1.fr3` | 存在 |
| D11-2 | 申請人名冊 (拆除執照) | D | `frxD11_2.fr3` | 存在 |
| D13-1 | 拆除執照審查表 | D | `frxD13_1.fr3`、`Link_frxD13_1.fr3` | 兩版皆存在；另有 `frxRepD13_1.fr3` |
| BM_TEC | 建築物結構與設計專業技師簽證報告 | F | `frxBM_TEC.fr3` | 存在 |
| G01 | 農舍管制註記清冊 | H | `frxG01.fr3` | 存在 |
| G02 | 農舍管制註記清冊（異動書） | H | `frxG02.fr3` | 存在 |

## 每份書表與資料群組對應

| 書表 | 實際資料來源 | 主要內容 |
|---|---|---|
| C11-1 | `BMSBASE/BMSLAN/BMSMEMO/BMSP01/BMSP03/BMSP04/BMSPARK` | 使用執照主檔、地號、起造人、監造／承造、停車彙總 |
| C11-2 | `BMSBASE/BMSP01` | 起造人、棟戶分配與地址 |
| C11-2-2 | `BMSBASE/BMSP01` 的分組查詢 | 起造人名冊另一版；`CNAMECON` 是查詢計算值 |
| C12-1 | `BMSBASE` 加 `LinkQuery` | 審查表的執照、地號、門牌連結文字 |
| C21-1 | `BMSBASE/BMSLAN/BMSMEMO/BMSP01/BMSP02` | 變更使用申請、原使照、申請人、設計人、土地分區 |
| C21-1A | `BMSBASE/BMSLAN/BMSMEMO/BMSP01/BMSP03/BMSP04/BMSPARK` | C21-1 擴充版建築概要，不是獨立 ALLRPT 項目 |
| C21-2 | `BMSBASE/BMSMEMO/BMSSTAIR` | 變更使用說明、檢討原則、附件勾選、樓層變更前後 |
| C21-3 | `BMSBASE`＋`C21_3` | 27 類檢討項目與逐項簽證內容 |
| C21-4 | `BMSBASE/BMSP01` | 申請人名冊 |
| C22-1 | `BMSBASE/BMSLAN/BMSP01` | 變更使照審查資料 |
| C22-2 | `BMSBASE/BMSLAN/BMSP01` | 竣工勘驗審查資料 |
| C22-3 | `BMSBASE/BMSLAN/BMSMEMO/BMSP01/BMSSTAIR` | 使用項目更動與樓層新舊用途／面積 |
| C22-4 | `BMSBASE/BMSLAN/BMSP01/BMSP02/BMSP04` | 申請人、設計人、承造人委託資料 |
| C22-5 | `BMSBASE/BMSP01/BMELVTR` | 昇降設備與機械停車設備清冊 |
| D11-1 | `BMSBASE/BMSLAN/BMSMEMO/BMSP01/BMSP03/BMSP04/BMSROAD` | 拆除物、拆除面積、借用道路、監督簽章 |
| D11-2 | `BMSBASE/BMSP01` | 拆除執照申請人名冊 |
| D13-1 | `BMSBASE/BMSLAN/BMSP01` 的 `LinkQuery` | 拆照審查連結文字 |
| BM_TEC | `BMSBASE/BMSLAN/BMSP01/BM_TEC` | 技師資格、事務所、程式與簽證內容 |
| G01 | `BMSBASE/BMSLAN/BMSP01` 的 `G01P01` 查詢 | 農舍坐落／提供興建地號、使照與農舍類型 |
| G02 | `BMSBASE/BMSLAN/BMSLANOWNER/BMSP01` | 農舍異動、土地所有權人、坐落／提供興建註記 |

## 報表計算與選項回推

### C11-1 停車彙總

模板的 `BMSPARK_T` 是 `BMSPARK` 查詢別名；`APPL_KIND1/2/3` 與總數是依各停車列加總的顯示值，不是新儲存表。

### C21-2 變更使用概要

`CHG_EXP`：

| 值 | 顯示意義 |
|---|---|
| `1` | 非供公眾變更為非供公眾 |
| `2` | 非供公眾變更為供公眾 |
| `3` | 供公眾變更為他種供公眾 |
| `4` | 供公眾變更為非供公眾 |

`CHG_PRIN`：

| 值 | 顯示意義 |
|---|---|
| `1` | 依有關規定全部檢討 |
| `2` | 僅就規定項目檢討 |
| `3` | 全部免檢討 |

`DOC1/DOC2/DOC3/DOC4` 為 Y／N，依序表示檢討項目簽證表、室內裝修圖說、結構計算書、設備圖說。`BMSSTAIR` 同列的 `_OLD` 與現況欄位形成變更前後對照。

### C21-3 檢討項目

codebook 的 `C21_3` 類型共有 27 筆（`000`～`026`），包含防火區劃、分間牆、裝修材料、樓梯、避難、無障礙、停車、採光、通風、容積率與建築師簽章等項目。舊程式把代碼列轉成 `Rpt_Seq/Rpt_Item`，使用者填 `Rpt_Data`。

### C22-5 設備分類

| `ELEV_USE` | 設備型式 |
|---|---|
| `A` | 緊急用升降機 |
| `B` | 一般升降機 |
| `C` | 自動樓梯 |
| `D` | 其他升降機 |
| `E` | 垂直循環型機械停車設備 |
| `F` | 多層循環型機械停車設備 |
| `G` | 水平循環型機械停車設備 |
| `H` | 平面往復型機械停車設備 |
| `I` | 簡易升降型機械停車設備 |
| `J` | 升降機型機械停車設備 |
| `K` | 多段型機械停車設備 |
| `L` | 升降滑動型機械停車設備 |
| `M` | 機械停車設備旋轉台 |
| `N` | 汽（機）車用升降機 |
| `O` | 個人住宅用升降機 |

模板把 `A/B/C/D/O` 列在「昇降設備資料」，其餘列在「機械停車設備資料」。每筆報表台數固定顯示 1。

### D11-1 借用道路

直接使用 `BMSROAD.ROAD_SEC/ALLEY/LANE/DOOR_NO/LENGTH/WIDE`；與 B11-1 是同一份案件道路資料，不另外複製。

### 農舍 G01／G02

- `BMSLAN.LOCATED=Y`：農舍實際坐落地號；`N`：提供興建地號。
- `BMSBASE.LAND_GET_TIME=1/2`：農業發展條例修正前／後取得。
- `BMSBASE.FARM_BUILD=1/2`：個別興建／集村興建。
- G02 的 `LANOWNER` 是由 `BMSLANOWNER.owner` 等欄位組成的查詢顯示，不是 `BMSLAN` 新欄位。

## 13 表內實用欄位

### `BMSBASE` — C／D／H 主檔補充

| 欄位 | 中文意義／格式 |
|---|---|
| `LICENSE_USE` | 原使用執照／本案使用執照字號，Text |
| `IDENTIFY_LICE_DATE_USE` | 使用執照核發日期，民國 yyyMMdd |
| `RECEIVE_LICE_DATE_USE` | 使用執照領照日期，民國 yyyMMdd |
| `LICENSE_OLD` | 原核准執照字號，Text |
| `IDENTIFY_LICE_OLD_DATE` | 原核准執照核發日期，民國 yyyMMdd |
| `CHG_EXP` | 變更使用說明，代碼 1～4 |
| `CHG_PRIN` | 變更使用檢討原則，代碼 1～3 |
| `CHG_PRIN_DESC` | 檢討原則顯示文字，Text |
| `DOC1`～`DOC4` | 變更使用附件勾選，Y／N |
| `LAW_02`、`LAW_02_DOC` | C11-1 額外法令版本與文號，Text／代碼 |
| `OTHERS_MEMO` | C21-1A 其他說明，Text |
| `LAND_GET_TIME` | 農地取得時點，1 修正前／2 修正後 |
| `FARM_BUILD` | 農舍興建種類，1 個別／2 集村 |
| `FARM_MEMO` | 農舍說明，Text |

其他共同欄位如建築面積、樓層戶數、使用分區、用途、法定空地、建蔽率、容積率、工程造價與執照連結文字，沿用 A／B 組同一份 `BMSBASE` 記錄。

### `BMSLAN`／`BMSLANOWNER`

- `BMSLAN`：`DIST/SECTION/ROAD_NO1/ROAD_NO2/TOT_AREA/USE_AREA/LOCATED`。
- `BMSLANOWNER`：同一地號鍵、`owner_id/owner/TOT_AREA_hold/USE_AREA_hold/owner_birth/owner_add/owner_tel/owner_memo`。
- G02 需要 `BMSLANOWNER` 才能顯示農地所有權人；不能只用地號表猜姓名。

### `BMSP01`～`BMSP04`

- `BMSP01`：C／D 申請人與 H 農舍起造人；姓名、證號、出生日期、戶籍／通訊／建築地址、電話、棟戶分配。
- `BMSP02`：C21-1、C22-4 設計人。
- `BMSP03`：C11-1、D11-1 的監造／監督建築師。
- `BMSP04`：C11-1、C22-4、D11-1 的承造營造業與負責人。

### `BMSPARK`／`BMSSTAIR`／`BM_TEC`

- `BMSPARK`：C11-1 停車分類與數量。
- `BMSSTAIR`：C21-2、C22-3 樓層、面積、使用類組及 `_OLD` 變更前資料。
- `BM_TEC`：F 專業技師書表使用，完整欄位與代碼沿用 `CPAMI_B系列書表_數據對應表.md`。

## 13 表外資料結構

### `C21_3` — 變更使用檢討項目

`Build.mdb` 沒有此表；`ARCH2016.exe` 內存在 `C21_3Query/qryC21_3/qryCodeC21_3` 元件及下列欄位，證明它是舊程式執行期資料集：

| 欄位 | 意義 |
|---|---|
| `Index_key` | 案件主鍵 |
| `Rpt_FmName` | 書表名稱／代號，預設 C21-3 |
| `Rpt_Seq` | 檢討項目代碼，對應 codebook `C21_3` 的 `000`～`026` |
| `Rpt_Item` | 檢討項目顯示文字 |
| `Rpt_Data` | 使用者填寫的檢討／簽證內容 |
| `ID` | 舊程式內部列識別欄 |

### `BMELVTR` — 昇降／機械停車設備

`Build.mdb` 實體表，共 25 欄；目前本機案件表為 0 筆。Access 型別 130 為文字、5 為數值、3 為 AutoNumber／整數。

| 順序 | 欄位 | Access 型別 | 中文意義 |
|---:|---|---:|---|
| 1 | `識別碼` | 3 | 系統識別碼 |
| 2 | `INDEX_KEY` | 130 | 案件主鍵 |
| 3 | `PERSON_SEQ` | 5 | 列序 |
| 4 | `CMEPAS` | 130 | 設備／檢查機構代碼前綴 |
| 5 | `CMENUM` | 130 | 檢查機構編號 |
| 6 | `PAKENO` | 130 | 設備統一編碼／許可證字號 |
| 7 | `CHECK_YEAR` | 130 | 檢查年度 |
| 8 | `CMENAM` | 130 | 檢查機構名稱 |
| 9 | `BUILD_NAME` | 130 | 建築物名稱 |
| 10 | `BUILD_ADDR` | 130 | 建築物地址 |
| 11 | `CHECK_RESULT` | 130 | 檢查結果 |
| 12 | `USE_LICENSE` | 130 | 使用許可證字號 |
| 13 | `CHECK_DATE` | 130 | 檢查日期，民國 yyyMMdd |
| 14 | `VALID_DATE` | 130 | 有效期限，民國 yyyMMdd |
| 15 | `FACILITY_NO` | 130 | 設備編號 |
| 16 | `FACILITY_SCALE` | 130 | 設備規模 |
| 17 | `ELEV_USE` | 130 | 設備型式 A～O |
| 18 | `MFT_NAME` | 130 | 專業廠商／製造廠商名稱 |
| 19 | `MFT_NO` | 130 | 專業廠商／製造廠商編號 |
| 20 | `CHECK_MAN_NO` | 130 | 檢查人員編號 |
| 21 | `CHECK_MAN_NAME` | 130 | 檢查人員姓名 |
| 22 | `LIC_NUM` | 130 | 證照號碼 |
| 23 | `CR_DATE` | 130 | 建立日期 |
| 24 | `UP_DATE` | 130 | 更新日期 |
| 25 | `OP_USER` | 130 | 操作人員 |

## 查詢別名與非儲存資料

- `LinkQuery`、`RptLink0`～`RptLink4`：C12-1／D13-1 的連結版報表暫存資料；可由 `BMSBASE/BMSLAN/BMSP01` 組合，不另建案件表。
- `RptList1`：D11-2 模板雖宣告查詢 `RptList`，實際 `MasterData` 直接綁 `BMSP01`；不需要保存一份重複名冊。
- `G01P01`：由 `BMSP01` 組合農舍起造人姓名與門牌。
- `BME_B/BME_M`：都是 `BMELVTR` 查詢別名，依 `ELEV_USE` 分組，不是兩張表。
- `CNAMECON`、`LANSEC`、`LANZON`、`USE_CATEGORY`、`BUILDKIN`、`COMIDNUM` 等是舊程式查詢計算顯示欄，不是需要額外輸入的新原始欄位。

## 特殊書表歸組結論

維持 Prompt 5 的安排：

- C 組：code `C` 13 份使用管理書表。
- D 組「拆除與其他」：code `D`＋`F`＋`H`。

理由：舊系統截圖也把 D、F、H 放在第三欄；目前 UI 只設 A／B／C／D 四個入口，而 F、H 各只有少量書表。資料仍是同一案件的共用表，不會因導覽歸組而複製。

## 缺口清單與採用方案

| # | 缺口 | 舊系統位置 | 影響 | 採用方案 |
|---:|---|---|---|---|
| 1 | `C21_3` 不在 data.txt／Build.mdb | `ARCH2016.exe` 的 `C21_3Query/qryC21_3` 執行期資料集 | 無法保存 27 類檢討項目的簽證內容 | schema 升版，新增 `extraTables.C21_3` 六欄；前端從 codebook `C21_3` 選項帶入項目名稱 |
| 2 | `BMELVTR` 不在 data.txt 13 表 | `Build.mdb` 25 欄實體表；C22-5 直接查詢 | 無法輸入昇降與機械停車設備 | schema 升版，新增 `extraTables.BMELVTR` 完整 25 欄 |

使用者已在 Prompt 6 決定完整實作舊二維功能，因此不再停留於 13 表限定方案；本輪會落實上述兩個擴充群組，但 `data.txt` 仍只輸出完整原 13 表。
