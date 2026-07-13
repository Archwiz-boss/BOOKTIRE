# CPAMI 舊二維建照系統 `data.txt` 資料結構與代碼對應表

> 分析標的：`data.txt`、`cpami/Arch2016C/ARCH2016.exe`、`Build.mdb`、`bldcode.mdb`、`land.mdb`、`fsrp/*.fr3`。
> 本文件以 UTF-8（含 BOM）儲存；原始 `data.txt` 必須維持 Big5/CP950 才能供舊系統匯入。

## 結論先行

1. `data.txt` 不是 CSV，而是舊系統自訂的「多資料表文字匯出檔」。每個 `@TableName` 對應 `Build.mdb` 的真實 Access 資料表。
2. 本檔共有 13 個資料表區塊、99 筆記錄、4,559 個欄位值；每一表的欄位集合與 `Build.mdb` 完全一致。
3. `ARCH2016.exe` 的匯出程式直接執行 `SELECT * FROM <表> WHERE INDEX_KEY = ...`；有 `PERSON_SEQ` 的子表會排除 0 並依序號排序。報表再以同一 `INDEX_KEY` 查表，交給 FastReport `.fr3` 顯示。
4. 因此自動轉檔的核心不是操作 UI，而是：把 XML/CSV 正規化成 13 表列資料，填入真實欄名，最後序列化為 CP950 + CRLF。
5. 代碼不是單一欄查表：行政區、地段、土地使用分區、構造通常還要帶縣市代碼；樓層與備註則是兩段代碼串接。

## 檔案語法與不可破壞的格式

```text
@TableName BMSBASE
@RecordBegin
@d INDEX_KEY "1150101120000"
@d BMPAS "I80"
@d BUILDING_NAME "範例集合住宅新建工程"
@d BUILDING_AREA ""
@RecordEnd
```

| 項目 | 實際規則 |
|---|---|
| 編碼 | Big5 / Windows CP950；無 BOM |
| 換行 | CRLF（`0D 0A`） |
| 表頭 | `@TableName` + 一個空白 + 真實資料表名 |
| 記錄 | `@RecordBegin` 至 `@RecordEnd` |
| 欄位 | `@d` + 空白 + 真實欄名 + 空白 + 雙引號包住的值 |
| 空值 | `""`；數字 0 必須寫成 `"0"`，兩者意義不同 |
| 數字 | 仍以文字輸出；小數點用 `.`，不可加千分位逗號或單位 |
| 日期 | 多數欄位為民國 `yyyMMdd` 7 碼，例如 `1150713`；不是 Gregorian `yyyy-MM-dd` |
| 旗標 | 多數是文字 `Y` / `N` / `""`，不是 JSON Boolean |
| 欄位順序 | 匯入器以欄名解析；為版本相容仍應完全照本檔／MDB 欄序輸出 |
| 特殊字元 | 樣本沒有內嵌 `"`、反斜線、Tab 或實體換行；未找到可靠跳脫規則，轉檔時應禁止內嵌 `"`/CR/LF 或先替換為全形符號／空白 |

CP950 無法表示全部 Unicode 字元。產生檔案時應使用「嚴格 CP950 編碼」檢查，不可靜默把無法編碼字元轉成 `?`。代碼庫中的 `UNC`/`PRTS` 是舊程式的造字／Unicode 相容機制，不宜自行猜碼。

## 資料流與表關係

```text
XML / CSV 原始資料
  -> 正規化（案件、地號、所有權人、人員、樓層、用途、停車、工作物）
  -> 查 bldcode：代碼 + 縣市/子碼
  -> 產生 13 個資料表列；全表共用 INDEX_KEY
  -> 依樣本欄序輸出 data.txt（CP950 + CRLF）
  -> 舊/新二維系統匯入 Build.mdb
  -> FastReport .fr3 依 INDEX_KEY 查表並顯示/列印
```

```text
BMSBASE（案件 1）
├─ BM_TEC（專業技師 1）
├─ BMSLAN（土地 28）── BMSLANOWNER（土地所有權關係 28）
├─ BMSMEMO（備註 6）
├─ BMSP01（起造人/棟號 24）
├─ BMSP02（設計人 1）
├─ BMSP03（監造人 1）
├─ BMSP04（承造人 1）
├─ BMSPARK（停車彙總 1）
├─ BMSSC（開竣工查報相容資料 1）
├─ BMSSTAIR（樓層/用途列 5）
└─ BMSWORK（雜項工作物 1）
```

## 13 表用途與目前筆數

| 順序 | 表名 | 筆數 | 欄位數 | 用途／一列代表什麼 |
|---:|---|---:|---:|---|
| 1 | `BMSBASE` | 1 | 166 | 案件主檔／基地與建築總表 |
| 2 | `BM_TEC` | 1 | 22 | 專業技師資料 |
| 3 | `BMSLAN` | 28 | 24 | 基地土地清冊（一筆地號一列） |
| 4 | `BMSLANOWNER` | 28 | 18 | 土地所有權資料（一筆地號－所有權人關係一列） |
| 5 | `BMSMEMO` | 6 | 9 | 案件備註／法定註記事項 |
| 6 | `BMSP01` | 24 | 112 | 起造人－棟號／門牌／用途關係 |
| 7 | `BMSP02` | 1 | 19 | 設計人（建築師） |
| 8 | `BMSP03` | 1 | 32 | 監造人（建築師） |
| 9 | `BMSP04` | 1 | 53 | 承造人／營造業／專任工程人員 |
| 10 | `BMSPARK` | 1 | 14 | 停車空間彙總 |
| 11 | `BMSSC` | 1 | 54 | 營造業開竣工查報表 B21-2 資料 |
| 12 | `BMSSTAIR` | 5 | 52 | 樓層－用途－面積明細 |
| 13 | `BMSWORK` | 1 | 21 | 雜項工作物明細 |

### XML/CSV 正規化時的列粒度

| 來源實體 | 目標表 | 產生列的規則 |
|---|---|---|
| 案件/基地總資料 | `BMSBASE` | 每案 1 列 |
| 專業技師 | `BM_TEC` | 每位技師、每個簽證項目 1 列 |
| 地號 | `BMSLAN` | 每筆地號 1 列；母號/子號拆欄 |
| 地號－所有權人 | `BMSLANOWNER` | 每個地號與每位所有權人的關係 1 列；不是只建唯一所有權人表 |
| 備註 | `BMSMEMO` | 每則備註 1 列；代碼、名稱、全文要一起填 |
| 起造人－棟號/用途 | `BMSP01` | 每個「起造人 × 棟號/門牌/用途」關係 1 列；本案 24 棟所以有 24 列 |
| 設計/監造/承造 | `BMSP02`/`03`/`04` | 各角色每人/業者 1 列 |
| 停車分類 | `BMSPARK` | 每種停車方式×車種×法定/自設×室內外×地上下 1 列 |
| 樓層用途 | `BMSSTAIR` | 每個「樓層 × 用途組合」1 列；同一樓層可有多列 |
| 雜項工作物 | `BMSWORK` | 每種工作物 1 列 |

### 建議第一階段先對接的業務欄位

| 表名 | 優先對接欄位群 | 原始資料需求 |
|---|---|---|
| `BMSBASE` | `INDEX_KEY`、`BMPAS`、`BUILDING_CATEGORY`、`BUILDING_NAME`、建築線三欄、法定/實設建蔽容積、基地/建築/樓地板面積、`USE_CATEGORY_CODE*`、`USAGE_CODE*`、`BUILDING_KIND*`、幢棟層戶數、造價、`APPLY_TYPE`、法令版本 | 案件主檔、面積計算、工程類別、申請類型 |
| `BMSLAN` | `DIST`、`SECTION`、`ROAD_NO1/2`、`TOT_AREA`、`USE_AREA`、土地使用分區碼 | 地號清冊；母號、子號不可合成單一數字後再拆 |
| `BMSLANOWNER` | 同一組地號鍵 + 所有權人 ID/姓名/持有及使用面積/生日/地址/電話 | 土地謄本或所有權 CSV/XML |
| `BMSP01` | 起造人基本資料、三套地址、`BUILDING_NO`、`BLD_CODE1..3` 及各 `DESC/T` | 起造人資料 + 棟別/門牌/用途關係 |
| `BMSP02/03/04` | 人員/公司名稱、證照字號組件、事務所/營造業資料、聯絡方式 | 設計、監造、承造與專任工程人員資料 |
| `BM_TEC` | `TEC_ITEM`、`TEC_TYPE`、技師姓名、證書/執照、公司資料 | 技師簽證資料 |
| `BMSSTAIR` | `STORY_CODE`、三組用途碼/說明、面積、層高、陽台/露臺；變更案另含 `_OLD`、拆除案含 `_TEAR` | 樓層面積表；必須允許同樓層多用途列 |
| `BMSPARK` | 五組分類碼 + `NUM`、`AREA`、`AIR_FLAG` | 停車位分類彙總 |
| `BMSMEMO` | `MEMO_SEQ`、`MEMO_SEQ_NAME`、`DESE` | 法定備註代碼與案件實際全文 |
| `BMSWORK` | 名稱、構造、長寬高、面積、數量、說明 | 雜項工作物明細 |
| `BMSSC` | 先以空白/0/N 相容模板處理；實際辦理開竣工時再映射 | B21-2 開竣工查報專用資料 |

## 主鍵、序號與衍生欄位

| 欄位/規則 | 建議 |
|---|---|
| `INDEX_KEY` | 全部 13 表必須一致。本案 `1150101120000` 可高可信度解析為民國 115/06/22 16:25:54；應產生全系統唯一的 13 碼案件鍵。 |
| `PERSON_SEQ` / `person_seq` | 使用正整數；舊匯出器會排除 0 並排序。可依來源列序由 1 遞增，但不要求既有檔一定連號。 |
| `SPOKESMAN` | 重複表通常第一個主要列填 `Y`，其他填 `N`；不要每列都填 `Y`。 |
| `識別碼` | Access AutoNumber，不是跨表關聯鍵。本樣本仍將它匯出。生成新檔時要保留欄位；若目標匯入器允許空白，可讓 DB 自編，否則配置該表內不衝突的正整數。需以新系統實際匯入測試定案。 |
| `*_OLD` | 變更設計前／原核准值。新申請通常空白；變更設計不能一律清空。 |
| `*_TEAR` | 拆除部分資料。沒有拆除時空白。 |
| `*_DESC`、`*_T`、`MEMO_SEQ_NAME` | 顯示冗餘欄位。即使已有代碼仍應一起填，因為報表會直接綁這些文字欄。 |
| 空白數值 | 用 `""` 表示未填/NULL；不可自動補 0，否則報表與計算語意會不同。 |

## 本案目前使用的代碼解碼

| data.txt 欄位 | 原值 | 查碼方式 | 解碼結果 | 信心 |
|---|---:|---|---|---|
| `BMSBASE.BMPAS`, `GOV` | `I80` | `PAS/BUDWD.CODE_SEQ` | 臺中市／臺中市政府 | 高 |
| `BMSBASE.BUILDING_CATEGORY` | `01` | `BIN.CODE_SEQ` | 新建 | 高 |
| `BMSBASE.APPLY_TYPE` | `A31-1` | `APP.CODE_SEQ` | 建造變更設計申請 | 高 |
| `BMSBASE.USE_CATEGORY_CODE1`、`BMSLAN.*` | `0140` | `KIN`: CODE_SEQ=`0140`, SUB_SEQ1=`I80` | 第四種住宅區 | 高 |
| `BMSBASE.USAGE_CODE` | `01` | `BLU.CODE_SEQ` | 住宅 | 高 |
| `BMSBASE.BUILDING_KIND1` | `10` | `STU`: CODE_SEQ=`10`, SUB_SEQ1=`I80` | 鋼筋混凝土造 | 高 |
| `BMSBASE.LAW_01` | `41` | `BMLAW1.CODE_SEQ` | 112 年 5 月 10 日發布建築技術規則版本 | 高 |
| `BMSBASE.LAW_03` | `05` | `BMLAW2.CODE_SEQ` | 內政部 113 年 3 月 1 日耐震設計規範及解說版本 | 高 |
| `BMSBASE.HOUSE_MEMO` | `H2` | `USECOD.CODE_SEQ` | 住宅類場所 | 高 |
| `BMSLAN.DIST` | `436` | `ZON`: CODE_SEQ=`436`, SUB_SEQ1=`I80` | 臺中市清水區 | 高 |
| `BMSP01.O_ADDRADR/H_ADDRADR` | `420` | `ZON`: CODE_SEQ=`420`, SUB_SEQ1=`I80` | 臺中市豐原區 | 高 |
| `BMSLAN.SECTION` | `4662` | 本機靜態 `SEC` 快照無此列；另查臺中市政府地政局 2026-05 官方地段碼表 | 福安段 | 高；官方現行資料已確認 |
| `BMSP01.BLD_CODE1`, `BMSSTAIR.USAGE_CODE1` | `H2` | `USECOD.CODE_SEQ` | 住宅類場所；實際顯示文字由 `*_DESC` 指定為住宅 | 高 |
| `BMSP01.BLD_CODE2`, `BMSSTAIR.USAGE_CODE2` | `00` | `USECOD.CODE_SEQ` | 其他類組；本案 `*_DESC` 指定為停車空間 | 高 |
| `BM_TEC.TEC_ITEM` | `2` | `BMTEC.CODE_SEQ` | 地基調查 | 高 |
| `BM_TEC.TEC_TYPE` | `04` | `TEC.CODE_SEQ` | 大地技師 | 高 |
| `BMSPARK.PARK_KIND` | `1` | `PARKTY.CODE_SEQ` | 平面停車 | 高 |
| `BMSPARK.CAR_KIND` | `1` | `CARTYP.CODE_SEQ` | 小型車 | 高 |
| `BMSPARK.APPL_KIND` | `1` | `APPLTY.CODE_SEQ` | 法定停車 | 高 |
| `BMSPARK.IN_OUT` | `1` | `INOUT.CODE_SEQ` | 室內 | 高 |
| `BMSPARK.UP_DOWN` | `1` | `UPDN.CODE_SEQ` | 地上 | 高 |
| `BMSSTAIR.STORY_CODE` | `U0010`… | `STC.CODE_SEQ` + `STC.SUB_SEQ` | U0010=地上 1 層、U0020=2 層、U0030=3 層、U0040=4 層 | 高 |
| `BMSMEMO.MEMO_SEQ` | `M591` | `RMK.SUB_SEQ` + `RMK.CODE_SEQ` + city I80 | 火災警報器 | 高 |
| `BMSMEMO.MEMO_SEQ` | `M2Q1` | 同上 | 污水用戶 | 高 |
| `BMSMEMO.MEMO_SEQ` | `M161` | 同上 | 地質敏感 | 高 |
| `BMSP04.ARC_REG_CLAS` | `1` | `ARCLS.CODE_SEQ` | 甲等營造業 | 高 |
| `BMSP04.FTENGTYPE` | `1` | `TECTYP.CODE_SEQ` | 主任技師 | 高 |

### 代碼查表的組合規則

| 業務欄位 | Bldcode 比對鍵 |
|---|---|
| 縣市 | `CODE_TYPE=PAS/BUDWD`, `CODE_SEQ=BMPAS` |
| 行政區 | `CODE_TYPE=ZON`, `CODE_SEQ=DIST/ADDRADR`, `SUB_SEQ1=BMPAS` |
| 地段 | 舊庫：`CODE_TYPE=SEC`, `CODE_SEQ=DIST`, `SUB_SEQ=SECTION`, `SUB_SEQ1=BMPAS`；前端另以相同 `DIST/SECTION` 結構合併臺中市政府現行地段碼表 |
| 土地使用分區 | `CODE_TYPE=KIN`, `CODE_SEQ=USE_CATEGORY_CODE*`, `SUB_SEQ1=BMPAS` |
| 構造 | `CODE_TYPE=STU`, `CODE_SEQ=BUILDING_KIND*`, `SUB_SEQ1=BMPAS` |
| 樓層 | `STORY_CODE = STC.CODE_SEQ + STC.SUB_SEQ` |
| 備註 | `MEMO_SEQ = RMK.SUB_SEQ + RMK.CODE_SEQ`，並用 `RMK.SUB_SEQ1=BMPAS` 選縣市版本 |
| 使用類組 | `USECOD.CODE_SEQ` 是大類，`SUB_SEQ` 是細項；本格式常另存 `*_DESC` 作最終顯示 |

## 本案地號組合結果

行政區 `436`=臺中市清水區；地段 `4662`=福安段。地號由 `ROAD_NO1` 母號與非空的 `ROAD_NO2` 子號以 `-` 組合。

| 序 | 地號 | 登記面積㎡ | 使用面積㎡ | 代表列 |
|---:|---|---:|---:|---|
| 1 | 875 | 638.73 | 638.73 | Y |
| 2 | 875-1 | 54.63 | 54.63 | N |
| 3 | 875-2 | 35.97 | 35.97 | N |
| 4 | 875-3 | 46.93 | 46.93 | N |
| 5 | 875-4 | 50.09 | 50.09 | N |
| 6 | 875-5 | 51.74 | 51.74 | N |
| 7 | 875-6 | 53.38 | 53.38 | N |
| 8 | 875-7 | 55.03 | 55.03 | N |
| 9 | 875-8 | 56.67 | 56.67 | N |
| 10 | 875-9 | 46.98 | 46.98 | N |
| 11 | 875-10 | 48.05 | 48.05 | N |
| 12 | 875-11 | 49.12 | 49.12 | N |
| 13 | 875-12 | 50.2 | 50.2 | N |
| 14 | 875-13 | 52.21 | 52.21 | N |
| 15 | 875-14 | 60.04 | 60.04 | N |
| 16 | 875-15 | 55.05 | 55.05 | N |
| 17 | 875-16 | 53.34 | 53.34 | N |
| 18 | 875-17 | 51.63 | 51.63 | N |
| 19 | 875-18 | 51.85 | 51.85 | N |
| 20 | 875-19 | 54.19 | 54.19 | N |
| 21 | 875-20 | 57.94 | 57.94 | N |
| 22 | 875-21 | 94.51 | 94.51 | N |
| 23 | 875-22 | 70.65 | 70.65 | N |
| 24 | 875-23 | 66.43 | 66.43 | N |
| 25 | 875-24 | 67.97 | 67.97 | N |
| 26 | 875-25 | 13.99 | 13.99 | N |
| 27 | 875-26 | 15.19 | 15.19 | N |
| 28 | 875-27 | 2.32 | 2.32 | N |

## 本案樓層/用途列

同一樓層可重複：本案 `U0040` 同時有「住宅」與「樓梯間」兩列，因此 CSV/XML 模型不能把樓層代碼當唯一鍵。

| 列序 | 樓層碼 | 用途 1 | 用途 2 | 面積㎡ | 層高m | 陽台㎡ |
|---:|---|---|---|---:|---:|---:|
| 2 | U0010 | 住宅 | 停車空間 | 966.56 | 3.8 | 0 |
| 3 | U0020 | 住宅 |  | 989.26 | 3.4 | 0 |
| 4 | U0030 | 住宅 |  | 985.86 | 3.4 | 1.15 |
| 5 | U0040 | 住宅 |  | 871.76 | 3.4 | 1.15 |
| 6 | U0040 | 樓梯間 |  | 152.68 | 3 | 0 |

## 地址欄位拆分

`BMSP01` 有三套地址：無前綴是建築物門牌；`O_` 是起造人戶籍/公司地址；`H_` 是通訊地址。三套皆用 `ADDRADR` + `ADDRAD1..9`。已由樣本確定的部分如下：

| 欄位 | 本案例 | 可確定語意 |
|---|---|---|
| `ADDRADR` | `436` | 行政區代碼／郵遞區號式代碼，查 ZON |
| `ADDRAD1` | `臺中市範例區範例路1號` | 里鄰文字 |
| `ADDRAD2` | `星海路` | 路街名稱（樣本也可能把「段」併在此欄） |
| `ADDRAD5` | `72` | 門牌號 |
| `ADDRAD6` | `11` | 「之」後的附號；顯示為 72之11號 |
| 其餘 `ADDRAD3/4/6_1/7/7_1/8/9` | 空白 | 巷、弄、樓、室等細分位置必須用另一筆完整地址或 UI 對照測試確認，不宜只憑此檔猜欄 |

## Bldcode 代碼類型總覽

以下數量是直接以 32 位元 Jet 重新讀取目前專案內 `cpami/Arch2016C/bldcode.mdb` 的結果：共 22,383 筆、43 種實際存在的 `CODE_TYPE`。舊版分析曾混入其他版本碼表的類型與數量，現已改以這一份實體 MDB 為準。

| CODE_TYPE | 筆數 | 用途 | 六欄結構 |
|---|---:|---|---|
| `ALLRPT` | 109 | 報表檔與書表編號 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `APP` | 16 | 申請書表類型 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `APPLTY` | 4 | 停車空間設立類別 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `ARCLS` | 5 | 營造業等級第二碼 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `ARCREG` | 1 | 營造業登記區域 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BIN` | 4 | 新/改/修/增建 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BLU` | 35 | 建築物主要用途 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BMLAW1` | 21 | 建築技術規則適用版本 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BMLAW2` | 4 | 耐震設計規範版本 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BMPECT` | 124 | 施工/勘驗文件項目 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BMSGOV` | 244 | 主管機關組合 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BMTEC` | 6 | 專業技師簽證項目 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BUDARE` | 24 | 建管行政區 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `BUDWD` | 25 | 縣市主管機關 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `C21_3` | 27 | 變更使用檢核項目 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `CARTYP` | 5 | 車種 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `CHSEC` | 13 | 地段名稱相容/轉碼 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `CLS1` | 4 | 營造業登記第一碼 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `CLS3` | 27 | 營造業登記第三碼 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `COSPRI` | 2 | 建設公司/自建 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `FARKIN` | 3 | 農地興建種類 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `FRMMEO` | 4 | 農舍管制註記 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `GROUP` | 7 | 申請文件群組 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `GROUP1` | 7 | 申請類別群組 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `INOUT` | 3 | 室內/室外 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `KIN` | 6,618 | 土地使用分區 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `LANDGE` | 3 | 農地取得時點 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `MEMO` | 45 | 常用備註 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `PAKTYP` | 14 | 升降設備類別 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `PARKTY` | 3 | 停車方式 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `PAS` | 25 | 縣市系統代碼 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `PIC` | 34 | 圖說大類 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `PRTS` | 1 | Unicode 列印相容 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `RPTTYP` | 16 | 報表種類 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `SEC` | 13,234 | 地段；2019 快照 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `STC` | 179 | 樓層 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `STU` | 791 | 構造種類 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `TEC` | 9 | 技師科別 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `UNC` | 15 | 造字/Unicode 對照 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `UPDN` | 3 | 地上/地下 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `USECOD` | 265 | 建築物使用類組 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `WORD` | 36 | 證照字號片語 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |
| `ZON` | 368 | 行政區 | `CODE_TYPE / CODE_SEQ / SUB_SEQ / SUB_SEQ1 / CODE_DESC / MARK` |

目前這份 MDB **沒有** `RMK`、`TECTYP`、`SUBPIC`、`VER`、`OPAPK`、`OPBMS` 等類型；不能把其他版本曾出現的列誤算進來。前端對目前 `data.txt` 已使用、但舊 MDB 缺少的少量值保留明確的相容備援。臺中市地段另合併官方 1,626 筆現行資料，來源見[臺中市政府資料開放平臺](https://opendata.taichung.gov.tw/search/0229777b-4ea4-45ad-92cf-ff7b42a6755a)。

## XML/CSV 轉換實作建議

1. 先建立中介資料模型，不要直接把單一 CSV 每列硬轉成 `@d`。至少要有 `case`、`parcels[]`、`parcelOwners[]`、`applicantBuildings[]`、`designers[]`、`supervisors[]`、`contractors[]`、`engineers[]`、`parking[]`、`floors[]`、`memos[]`、`works[]`。
2. 先做代碼解析，再生成冗餘顯示欄：`code` 與 `*_DESC`/`*_T` 必須成組。
3. 日期統一轉成民國 7 碼；數值用 invariant culture 轉字串；空值輸出 `""`。
4. 依本文件的表順序與附錄欄序輸出；每個子表 `person_seq` 使用正整數，第一代表列設 `SPOKESMAN=Y`。
5. 用 CP950 的 exception fallback 做預檢；任何無法編碼的字先列錯誤，不要產生 `?`。
6. 產生後做四層驗證：語法解析、欄位/型別/長度、代碼組合、匯入副本後表格/報表比對。

### 建議驗證條件

- 每個 `@RecordBegin` 都有 `@RecordEnd`。
- 每表欄位集合與附錄完全一致；文字不得超過 MDB 長度。
- 每列 `INDEX_KEY` 一致；子表 `person_seq > 0`。
- `ROAD_NO1`/`ROAD_NO2`、`DIST`/`SECTION` 不丟前導 0。
- `USE_CATEGORY_CODE*`、`BUILDING_KIND*`、`DIST` 等代碼要帶 `BMPAS` 查碼。
- `*_DESC` 與代碼一致；`BMSMEMO` 的代碼、名稱、全文一致。
- 數值 `""` 與 `"0"` 保持區分。
- 檔案可 CP950 無損往返，且結尾保留 CRLF。

## 風險與尚待用新系統確認的項目

- 新二維系統是否仍接受 CP950 與同一組 13 表欄位；若新版改成 UTF-8/XML API，應保留中介模型，只替換序列化層。
- `識別碼` 在新版匯入時應留空自編或允許顯式值；本檔只證明舊匯出會帶出 AutoNumber。
- `SECTION=4662`（福安段）不存在本機靜態 `Bldcode.SEC` 快照，但已由臺中市政府地政局 2026-05 官方碼表確認；不能把此舊 MDB 當全臺最新地段碼表。
- `ADDRAD3..9` 的完整巷弄樓室拆分，單靠本案空白樣本無法完全定義；應以另一筆含完整地址的匯出檔做差分。
- 值內嵌雙引號與換行沒有樣本，且匯出器只證明會以雙引號包值；自動化時應先禁止或正規化。

## 附錄 A：全部欄位、MDB 型別、長度與本檔樣本

以下欄位順序就是 `data.txt` 的實際順序，也是建議輸出順序。`非空` 是本檔該表所有列的非空筆數。

### `BMSBASE` — 案件主檔／基地與建築總表

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 255 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `BMPAS` | Text | 3 | 1/1 | I80 | 縣市／系統代碼；本案 I80=臺中市 |
| 3 | `BUILDING_CATEGORY` | Text | 2 | 1/1 | 01 | 工程類別代碼；BIN，01=新建 |
| 4 | `BUILDING_NAME` | Text | 50 | 1/1 | 範例集合住宅新建工程 | 工程名稱 |
| 5 | `PUBLIC_CODE` | Text | 1 | 1/1 | N | 是否供公眾使用旗標（Y/N） |
| 6 | `LAND_NUM` | Double | — | 0/1 | （空） | 基地地號彙整文字；本檔留空，地號以 BMSLAN 為準 |
| 7 | `BUILDING_LINE_WORD` | Text | 20 | 1/1 | 中市都測 | 建築線指定文號字別 |
| 8 | `BUILDING_LINE_NO` | Text | 11 | 1/1 | 1120174706 | 建築線指定文號號碼 |
| 9 | `BUILDING_DATE` | Text | 7 | 1/1 | 1120810 | 建築線指定日期；民國 yyyMMdd |
| 10 | `LAW_COVER_RATE` | Decimal | — | 1/1 | 55 | 法定建蔽率（百分比數字，不含 %） |
| 11 | `LAW_SPACE_RATE` | Decimal | — | 1/1 | 200 | 法定容積率（百分比數字，不含 %） |
| 12 | `LAW_COVER_RATE_DESC` | Text | 50 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 13 | `LAW_SPACE_RATE_DESC` | Text | 50 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 14 | `BASE_AREA_ARC` | Decimal | — | 1/1 | 148.04 | 基地面積分類：騎樓地／相關分類面積（依原系統表單） |
| 15 | `BASE_AREA_SHRINK` | Decimal | — | 0/1 | （空） | 基地退縮面積 |
| 16 | `BASE_AREA_OTHER` | Decimal | — | 1/1 | 1957.75 | 基地其他面積分類 |
| 17 | `BASE_AREA_PURPOSE` | Decimal | — | 0/1 | （空） | 基地特定用途面積分類 |
| 18 | `BASE_AREA_TOTAL` | Decimal | — | 1/1 | 2004.83 | 基地面積合計（㎡） |
| 19 | `STATUTORY_OPEN_SPACE` | Decimal | — | 1/1 | 880.99 | 法定空地面積（㎡） |
| 20 | `USE_CATEGORY_CODE1` | Text | 4 | 1/1 | 0140 | 土地使用分區代碼 1；查 KIN，須連同縣市代碼匹配 |
| 21 | `USE_CATEGORY_CODE2` | Text | 4 | 0/1 | （空） | 土地使用分區代碼 2 |
| 22 | `USE_CATEGORY_CODE3` | Text | 4 | 0/1 | （空） | 土地使用分區代碼 3 |
| 23 | `BUIL_AREA_ARC` | Double | — | 1/1 | 47.08 | 建築面積分類：騎樓地／相關分類面積（㎡） |
| 24 | `BUIL_AREA_OTHER` | Double | — | 1/1 | 998.14 | 建築面積其他分類（㎡） |
| 25 | `USAGE_CODE` | Text | 4 | 1/1 | 01 | 建築物主要用途代碼；查 BLU |
| 26 | `USAGE_CODE_DESC` | Text | 100 | 1/1 | 住宅 | 主要用途顯示文字；應與 USAGE_CODE 同步填入 |
| 27 | `BUILDING_HEIGHT` | Double | — | 1/1 | 14 | 構造／建築高度分類值（原表欄位） |
| 28 | `BUILDING_AREA` | Double | — | 0/1 | （空） | 建築面積（原表欄位） |
| 29 | `TOTAL_CONSTRU_AREA` | Double | — | 1/1 | 4013.2 | 總樓地板面積（㎡） |
| 30 | `BUILD_COVER_RATE` | Decimal | — | 1/1 | 50.47 | 實設建蔽率（百分比數字） |
| 31 | `SPACE_RATE` | Decimal | — | 1/1 | 174.87 | 實設容積率（百分比數字） |
| 32 | `PRICE` | Double | — | 1/1 | 28912000 | 工程造價（元） |
| 33 | `BUILDING_KIND1` | Text | 3 | 1/1 | 10 | 構造種類代碼 1；查 STU，須連同縣市代碼匹配 |
| 34 | `BUILDING_KIND2` | Text | 3 | 0/1 | （空） | 構造種類代碼 2 |
| 35 | `BUILDING_KIND3` | Text | 3 | 0/1 | （空） | 構造種類代碼 3 |
| 36 | `BUILDING_BASE_KIND` | Text | 2 | 0/1 | （空） | 基礎構造種類 |
| 37 | `CHWANG_NO` | Double | — | 1/1 | 3 | 幢數 |
| 38 | `BUILDING_NO` | Double | — | 1/1 | 24 | 棟數 |
| 39 | `UP_FLOOR_NO` | Double | — | 1/1 | 4 | 地上層數 |
| 40 | `DN_FLOOR_NO` | Double | — | 1/1 | 0 | 地下層數 |
| 41 | `TOT_HOUSE_NO` | Double | — | 1/1 | 24 | 戶數 |
| 42 | `BUILD_HIHIGHT` | Double | — | 1/1 | 13.85 | 建築物高度（m；原程式拼字 HIHIGHT） |
| 43 | `AIRRAID_U_AREA` | Double | — | 1/1 | 0 | 防空避難地上面積 |
| 44 | `AIRRAID_D_AREA` | Double | — | 1/1 | 0 | 防空避難地下面積 |
| 45 | `LAW_AIRRAID_AREA` | Double | — | 1/1 | 0 | 法定防空避難面積 |
| 46 | `AIRRAID_P_AREA` | Double | — | 1/1 | 0 | 防空避難停車面積 |
| 47 | `OTHERS_NAME` | LongText | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 48 | `OTHERS_PRICE` | Double | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 49 | `OTHERS_MEMO` | Text | 200 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 50 | `BASE_MEMO` | LongText | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 51 | `FILENAME` | Text | 50 | 1/1 | 台中市清水區福安段8758等28筆地號(複製) | 案件檔名／顯示名稱 |
| 52 | `APPLY_TYPE` | Text | 5 | 1/1 | A31-1 | 申請書表類型；查 APP |
| 53 | `FIRST_TIME_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 54 | `FIRST_TIME_Desc` | Text | 40 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 55 | `FIRST_TIME_KNOW_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 56 | `FIRST_TIME_KNOW_DESC` | Text | 40 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 57 | `APPROVE_LICE_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 58 | `IDENTIFY_LICE_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 59 | `IDENTIFY_LICE_OLD_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 60 | `RECEIVE_LICE_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 61 | `RECEIVE_LICE_OLD_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 62 | `VALID_MONTH` | Text | 3 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 63 | `COMPLETE_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 64 | `Complete_permit_date` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 65 | `LICENSE` | Text | 40 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 66 | `LICENSE_OLD` | Text | 40 | 0/1 | （空） | 變更前／原核准值；對應欄位 LICENSE |
| 67 | `Start_work_permit_date` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 68 | `Start_work_pre_date` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 69 | `Worked` | Double | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 70 | `Priced` | Double | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 71 | `SEQ_NO` | Double | — | 1/1 | 1 | 案件版本／序號 |
| 72 | `Noticed_date` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 73 | `Noticed_Desc` | Text | 40 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 74 | `PS_DESC` | Text | 200 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 75 | `LAST_MODIFY` | Text | 15 | 1/1 | 00016 | 最後修改版號（文字、保留前導 0） |
| 76 | `Lices_Flag` | Text | 1 | 0/1 | （空） | 狀態／檢核旗標；通常 Y/N 或空白 |
| 77 | `old_Index_key` | Text | 20 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 78 | `CR_DATE` | Text | 7 | 1/1 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 79 | `UP_DATE` | Text | 7 | 1/1 | 1150713 | 異動日期；民國 yyyMMdd（7 碼） |
| 80 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 81 | `識別碼` | Long AutoNumber | — | 1/1 | 581 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 82 | `CHG_EXP` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 83 | `CHG_PRIN` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 84 | `CHG_PRIN_DESC` | Text | 1 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 85 | `DOC1` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 86 | `DOC2` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 87 | `DOC3` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 88 | `DOC4` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 89 | `GOV` | Text | 3 | 1/1 | I80 | 主管機關縣市代碼；本案 I80=臺中市 |
| 90 | `BUILDING_KIND1_OLD` | Text | 3 | 1/1 | 10 | 變更前／原核准值；對應欄位 BUILDING_KIND1 |
| 91 | `BUILDING_KIND2_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 BUILDING_KIND2 |
| 92 | `BUILDING_KIND3_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 BUILDING_KIND3 |
| 93 | `BUILDING_HEIGHT_OLD` | Double | — | 1/1 | 14 | 變更前／原核准值；對應欄位 BUILDING_HEIGHT |
| 94 | `PRICE_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 PRICE |
| 95 | `OTHERS_PRICE_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 OTHERS_PRICE |
| 96 | `A12_TITTLE` | LongText | — | 1/1 | 茲有（詳土地使用權同意書附表　起造人名冊），鴻山建設有限公司 負責人:王範例擬在下列土地建築地上4層、地下0層，建築物24棟業（本同意書應從同意日起1年內提出申請執照，逾期無… | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 97 | `LICENSE_USE` | Text | 40 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 98 | `IDENTIFY_LICE_DATE_USE` | Text | 7 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 99 | `RECEIVE_LICE_DATE_USE` | Text | 7 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 100 | `LAW_01` | Text | 2 | 1/1 | 41 | 適用法令版本／附加欄位；依 BMLAW1、BMLAW2 及表單版本匹配 |
| 101 | `LAW_02` | Text | 7 | 0/1 | （空） | 適用法令版本／附加欄位；依 BMLAW1、BMLAW2 及表單版本匹配 |
| 102 | `LAW_02_DOC` | Text | 10 | 0/1 | （空） | 適用法令版本／附加欄位；依 BMLAW1、BMLAW2 及表單版本匹配 |
| 103 | `LAW_03` | Text | 2 | 1/1 | 05 | 適用法令版本／附加欄位；依 BMLAW1、BMLAW2 及表單版本匹配 |
| 104 | `IB0_CITY` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 105 | `A12_5TITLE` | Text | 255 | 0/1 | （空） | 顯示／說明文字；與相鄰代碼或主欄位同步 |
| 106 | `LICENSE_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 107 | `P01_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 108 | `LAN_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 109 | `ADDR_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 110 | `LINE_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 111 | `LINK_TYPE` | Text | 1 | 1/1 | N | 連結案件旗標（Y/N） |
| 112 | `HADDR_LINK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 113 | `HADDR_LIKK` | Text | 255 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 114 | `B13_3TYPE` | Text | 1 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 115 | `B13_5TYPE` | Text | 3 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 116 | `LAND_GET_TIME` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 117 | `FARM_MEMO` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 118 | `FARM_BUILD` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 119 | `ADD_Priced` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 120 | `CITY_BUD_KIND_OLD` | Text | 254 | 0/1 | （空） | 變更前／原核准值；對應欄位 CITY_BUD_KIND |
| 121 | `CITY_BUD_KIND` | Text | 254 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 122 | `CITY_PRICE_OLD` | Decimal | — | 0/1 | （空） | 變更前／原核准值；對應欄位 CITY_PRICE |
| 123 | `CITY_PRICE` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 124 | `CITY_BUILDING_HEIGHT` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 125 | `CITY_BUILDING_HEIGHT_OLD` | Decimal | — | 0/1 | （空） | 變更前／原核准值；對應欄位 CITY_BUILDING_HEIGHT |
| 126 | `LICLINK_1` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 127 | `LICLINK_2` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 128 | `TempBuild` | Text | 1 | 1/1 | N | 臨時建築物旗標（Y/N） |
| 129 | `I80BIN_1` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 1 |
| 130 | `I80BIN_2` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 2 |
| 131 | `I80BIN_3` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 3 |
| 132 | `I80BIN_4` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 4 |
| 133 | `I80BIN_5` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 5 |
| 134 | `I80BIN_6` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 6 |
| 135 | `I80BIN_7` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 7 |
| 136 | `I80BIN_8` | Text | 150 | 0/1 | （空） | 臺中市 I80 專用檢核旗標／比例欄位 8 |
| 137 | `I80BIN_9` | Text | 1 | 1/1 | N | 臺中市 I80 專用檢核旗標／比例欄位 9 |
| 138 | `I80BIN_9_PER` | Decimal | — | 0/1 | （空） | 臺中市 I80 專用檢核旗標／比例欄位 9 |
| 139 | `I80BIN_USE1` | Text | 1 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 140 | `I80BIN_USE2` | Text | 1 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 141 | `I80BIN_USE3` | Text | 1 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 142 | `I80BIN_USE4` | Text | 1 | 1/1 | N | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 143 | `FIRESAVETY` | Text | 1 | 1/1 | N | 消防安全相關旗標（Y/N） |
| 144 | `ISOPENAREA` | Text | 1 | 1/1 | N | 開放空間案件旗標（Y/N） |
| 145 | `CHGBUILDAREA` | Text | 1 | 1/1 | N | 是否變更建築面積旗標（Y/N） |
| 146 | `PARKFLOORSUM` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 147 | `GLVALUE` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 148 | `DEVAREA1` | Decimal | — | 0/1 | （空） | 開發面積分類 1 |
| 149 | `DEVAREA2` | Decimal | — | 0/1 | （空） | 開發面積分類 2 |
| 150 | `DEVAREA3` | Decimal | — | 0/1 | （空） | 開發面積分類 3 |
| 151 | `DEVAREA4` | Decimal | — | 0/1 | （空） | 開發面積分類 4 |
| 152 | `DEVAREA5` | Decimal | — | 0/1 | （空） | 開發面積分類 5 |
| 153 | `DEVAREA6` | Decimal | — | 0/1 | （空） | 開發面積分類 6 |
| 154 | `DEVAREA7` | Decimal | — | 0/1 | （空） | 開發面積分類 7 |
| 155 | `DEVAREA8` | Decimal | — | 0/1 | （空） | 開發面積分類 8 |
| 156 | `DEVAREA9` | Decimal | — | 0/1 | （空） | 開發面積分類 9 |
| 157 | `NFAREA1` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 1 |
| 158 | `NFAREA2` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 2 |
| 159 | `NFAREA3` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 3 |
| 160 | `NFAREA4` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 4 |
| 161 | `NFAREA5` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 5 |
| 162 | `NFAREA6` | Decimal | — | 0/1 | （空） | 免計／非計入面積分類 6 |
| 163 | `DX` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 164 | `DY` | Decimal | — | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 165 | `BUILD_ONE_PASS` | Text | 20 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 166 | `HOUSE_MEMO` | Text | 60 | 1/1 | H2 | 使用類組／住宅附註代碼；本案 H2 |

### `BM_TEC` — 專業技師資料

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `PERSON_SEQ` | Double | — | 1/1 | 2 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `TEC_ITEM` | Text | 2 | 1/1 | 2 | 技師簽證項目；BMTEC |
| 4 | `TEC_NAME` | Text | 20 | 1/1 | 王範例 | 技師姓名 |
| 5 | `TEC_TYPE` | Text | 2 | 1/1 | 04 | 技師科別；TEC |
| 6 | `CAPACITY_GET` | Text | 10 | 1/1 | 技執 | 資格取得字別 |
| 7 | `CAPACITY_NO` | Text | 6 | 1/1 | 002577 | 技師證書號碼 |
| 8 | `TRX_NO` | Text | 40 | 1/1 | 內授營建管字第1100800142號 | 核准／換發文號 |
| 9 | `REG_NO` | Text | 6 | 1/1 | 232755 | 執業執照／登記號碼 |
| 10 | `COM_NAME` | Text | 40 | 1/1 | 範例建設股份有限公司 | 工程顧問公司名稱 |
| 11 | `COM_ZIP` | Text | 3 | 1/1 | 540 | 公司／事務所郵遞區號 |
| 12 | `COM_ADDR` | Text | 60 | 1/1 | 臺中市範例區範例路1號 | 工程顧問公司地址 |
| 13 | `COM_TEL` | Text | 20 | 1/1 | 04-00000000 | 工程顧問公司電話 |
| 14 | `COM_FAX` | Text | 20 | 0/1 | （空） | 工程顧問公司傳真 |
| 15 | `PROGRAM` | Text | 100 | 0/1 | （空） | 簽證／設計說明 |
| 16 | `REG_DATE` | Text | 7 | 1/1 | 1130522 | 登記日期；民國 yyyMMdd |
| 17 | `MEMO` | Text | 100 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 18 | `TEC_DATA` | Text | 100 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 19 | `CR_DATE` | Text | 7 | 1/1 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 20 | `UP_DATE` | Text | 7 | 1/1 | 1130522 | 異動日期；民國 yyyMMdd（7 碼） |
| 21 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 22 | `識別碼` | Long AutoNumber | — | 1/1 | 206 | Access AutoNumber 內部識別碼；非業務主鍵 |

### `BMSLAN` — 基地土地清冊（一筆地號一列）

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 28/28 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 28/28 | 1；2；3 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `SPOKESMAN` | Text | 1 | 28/28 | Y；N | 代表列旗標；Y=代表、N=非代表 |
| 4 | `DIST` | Text | 3 | 28/28 | 436 | 行政區／郵遞區號式代碼；查 ZON |
| 5 | `SECTION` | Text | 4 | 28/28 | 4662 | 地段代碼；通常搭配 DIST、BMPAS 查 SEC |
| 6 | `ROAD_NO1` | Text | 4 | 28/28 | 875 | 地號母號 |
| 7 | `ROAD_NO2` | Text | 4 | 27/28 | 1；2；3 | 地號子號；空白代表無子號 |
| 8 | `TOT_AREA` | Decimal | — | 28/28 | 638.73；54.63；35.97 | 土地登記總面積（㎡） |
| 9 | `USE_AREA` | Decimal | — | 28/28 | 638.73；54.63；35.97 | 本案使用面積（㎡） |
| 10 | `USE_CATEGORY_CODE1` | Text | 4 | 28/28 | 0140 | 土地使用分區代碼 1；查 KIN，須連同縣市代碼匹配 |
| 11 | `USE_CATEGORY_CODE2` | Text | 4 | 0/28 | （空） | 土地使用分區代碼 2 |
| 12 | `CR_DATE` | Text | 7 | 28/28 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 13 | `UP_DATE` | Text | 7 | 28/28 | 1150713；1130522；1150623 | 異動日期；民國 yyyMMdd（7 碼） |
| 14 | `OP_USER` | Text | 10 | 0/28 | （空） | 操作使用者代碼 |
| 15 | `識別碼` | Long AutoNumber | — | 28/28 | 3010；3011；3012 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 16 | `SECTION_OLD` | Text | 4 | 0/28 | （空） | 變更前／原核准值；對應欄位 SECTION |
| 17 | `ROAD_NO1_OLD` | Text | 4 | 0/28 | （空） | 變更前／原核准值；對應欄位 ROAD_NO1 |
| 18 | `ROAD_NO2_OLD` | Text | 4 | 0/28 | （空） | 變更前／原核准值；對應欄位 ROAD_NO2 |
| 19 | `TOT_AREA_OLD` | Decimal | — | 0/28 | （空） | 變更前／原核准值；對應欄位 TOT_AREA |
| 20 | `USE_AREA_OLD` | Decimal | — | 0/28 | （空） | 變更前／原核准值；對應欄位 USE_AREA |
| 21 | `USE_CATEGORY_CODE1_OLD` | Text | 4 | 0/28 | （空） | 變更前／原核准值；對應欄位 USE_CATEGORY_CODE1 |
| 22 | `USE_CATEGORY_CODE2_OLD` | Text | 4 | 0/28 | （空） | 變更前／原核准值；對應欄位 USE_CATEGORY_CODE2 |
| 23 | `DIST_OLD` | Text | 3 | 0/28 | （空） | 變更前／原核准值；對應欄位 DIST |
| 24 | `LOCATED` | Text | 1 | 28/28 | N | 是否位於特定範圍旗標（Y/N；原系統欄位） |

### `BMSLANOWNER` — 土地所有權資料（一筆地號－所有權人關係一列）

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 28/28 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `Person_seq` | Double | — | 28/28 | 1；2；3 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `DIST` | Text | 3 | 28/28 | 436 | 行政區／郵遞區號式代碼；查 ZON |
| 4 | `SECTION` | Text | 4 | 28/28 | 4662 | 地段代碼；通常搭配 DIST、BMPAS 查 SEC |
| 5 | `ROAD_NO1` | Text | 4 | 28/28 | 875 | 地號母號 |
| 6 | `ROAD_NO2` | Text | 4 | 27/28 | 1；2；3 | 地號子號；空白代表無子號 |
| 7 | `owner_id` | Text | 10 | 28/28 | A123456789 | 土地所有權人身分證／統編 |
| 8 | `owner` | Text | 70 | 28/28 | 王範例 | 土地所有權人姓名／名稱 |
| 9 | `TOT_AREA_hold` | Double | — | 28/28 | 638.73；54.63；35.97 | 所有權人持有總面積（㎡） |
| 10 | `USE_AREA_hold` | Double | — | 28/28 | 638.73；54.63；35.97 | 所有權人供本案使用面積（㎡） |
| 11 | `owner_birth` | Text | 7 | 28/28 | 0700101 | 所有權人出生日期；民國 yyyMMdd |
| 12 | `owner_add` | Text | 50 | 28/28 | 臺中市範例區範例路1號 | 所有權人地址 |
| 13 | `owner_tel` | Text | 50 | 28/28 | 04-00000000 | 所有權人電話 |
| 14 | `owner_memo` | Text | 200 | 0/28 | （空） | 所有權備註 |
| 15 | `CR_DATE` | Text | 7 | 28/28 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 16 | `UP_DATE` | Text | 7 | 28/28 | 1130603 | 異動日期；民國 yyyMMdd（7 碼） |
| 17 | `OP_USER` | Text | 10 | 0/28 | （空） | 操作使用者代碼 |
| 18 | `識別碼` | Long AutoNumber | — | 28/28 | 2349；2350；2351 | Access AutoNumber 內部識別碼；非業務主鍵 |

### `BMSMEMO` — 案件備註／法定註記事項

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 6/6 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 6/6 | 1；2；3 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `MEMO_SEQ` | Text | 4 | 3/6 | M591；M2Q1；M161 | 備註代碼；RMK 的 SUB_SEQ + CODE_SEQ，例如 M591 |
| 4 | `DESE` | Text | 230 | 6/6 | 本案屬非供公眾使用建築物之五樓以下住宅(公寓)，於竣工查驗前應取得住宅用火災警報器經本府消防局檢查合格之證明文件，始得核發使用執照。；依臺中市政府水利局113年3月19日中市水污營字第1130021936號函內容，本案係屬「用戶排水設備(預設用戶)」，應於建築工程申報開工前，向水利局申請核准。；本案申請基地無位於下水補注質敏感區，依據經濟部105年4月13日經地字第10504601550號令，本案未達規模免檢附。 | 說明／備註全文（原程式拼字） |
| 5 | `CR_DATE` | Text | 7 | 6/6 | 1150622；1150625 | 建立日期；民國 yyyMMdd（7 碼） |
| 6 | `UP_DATE` | Text | 7 | 4/6 | 1130330；1130331；1130520 | 異動日期；民國 yyyMMdd（7 碼） |
| 7 | `OP_USER` | Text | 10 | 0/6 | （空） | 操作使用者代碼 |
| 8 | `識別碼` | Long AutoNumber | — | 6/6 | 2405；2406；2407 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 9 | `MEMO_SEQ_NAME` | Text | 100 | 3/6 | 火災警報器；污水用戶；地質敏感 | 備註代碼顯示名稱；應與 MEMO_SEQ 同步 |

### `BMSP01` — 起造人－棟號／門牌／用途關係

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 24/24 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 24/24 | 1；2；3 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `SPOKESMAN` | Text | 1 | 24/24 | Y；N | 代表列旗標；Y=代表、N=非代表 |
| 4 | `BUILDING_NO` | Text | 20 | 24/24 | A1；A2；A3 | 棟別／單元代號；本案每一棟各建一列起造人關係 |
| 5 | `CHWANG` | Text | 4 | 24/24 | 1 | 幢序號 |
| 6 | `DONG` | Text | 4 | 24/24 | 1 | 棟序號 |
| 7 | `FLOOR` | Text | 4 | 24/24 | 1 | 層序號 |
| 8 | `HOUSE` | Text | 4 | 24/24 | 1 | 戶序號 |
| 9 | `BLD_CODE1` | Text | 2 | 24/24 | H2 | 建築物用途類組 1；查 USECOD |
| 10 | `BLD_CODE2` | Text | 2 | 20/24 | 00 | 建築物用途類組 2；查 USECOD |
| 11 | `BLD_CODE3` | Text | 2 | 0/24 | （空） | 建築物用途類組 3；查 USECOD |
| 12 | `BLD_CODE1_DESC` | Text | 100 | 24/24 | 住宅 門牌:台中市清水區臺中市範例區範例路1號星海路72之11號；住宅 門牌:台中市清水區臺中市範例區範例路1號星海路72之12號；住宅 門牌:台中市清水區臺中市範例區範例路1號星海路72之13號 | 用途 1 顯示全文；本案另包含門牌文字 |
| 13 | `BLD_CODE2_DESC` | Text | 100 | 20/24 | 、停車空間 | 用途 2 顯示全文 |
| 14 | `BLD_CODE3_DESC` | Text | 100 | 0/24 | （空） | 用途 3 顯示全文 |
| 15 | `CNAME` | Text | 70 | 24/24 | 王範例 | 姓名／公司名稱；依所在表為起造人、設計人或監造人 |
| 16 | `BIRTH_DATE` | Text | 7 | 0/24 | （空） | 出生日期；民國 yyyMMdd |
| 17 | `TEL_NO` | Text | 20 | 24/24 | 04-00000000 | 電話 |
| 18 | `Fax_NO` | Text | 20 | 24/24 | 04-00000000 | 傳真 |
| 19 | `eMail` | Text | 50 | 0/24 | （空） | 電子郵件 |
| 20 | `IDENTIFY_NO` | Text | 30 | 24/24 | 00000000 | 身分證號／統一編號 |
| 21 | `Law_represent` | Text | 20 | 0/24 | （空） | 法定代理人／代表人 |
| 22 | `O_ADDRADR` | Text | 3 | 24/24 | 420 | 戶籍／公司地址拆分組件 R；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 23 | `O_ADDRAD1` | Text | 20 | 24/24 | 西湳里 | 戶籍／公司地址拆分組件 1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 24 | `O_ADDRAD2` | Text | 20 | 24/24 | 臺中市範例區範例路1號 | 戶籍／公司地址拆分組件 2；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 25 | `O_ADDRAD3` | Text | 20 | 0/24 | （空） | 戶籍／公司地址拆分組件 3；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 26 | `O_ADDRAD4` | Text | 20 | 0/24 | （空） | 戶籍／公司地址拆分組件 4；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 27 | `O_ADDRAD5` | Text | 4 | 24/24 | 1 | 戶籍／公司地址拆分組件 5；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 28 | `O_ADDRAD6` | Text | 4 | 0/24 | （空） | 戶籍／公司地址拆分組件 6；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 29 | `O_ADDRAD6_1` | Text | 4 | 0/24 | （空） | 戶籍／公司地址拆分組件 6_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 30 | `O_ADDRAD7` | Text | 4 | 0/24 | （空） | 戶籍／公司地址拆分組件 7；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 31 | `O_ADDRAD7_1` | Text | 4 | 0/24 | （空） | 戶籍／公司地址拆分組件 7_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 32 | `O_ADDRAD8` | Text | 4 | 0/24 | （空） | 戶籍／公司地址拆分組件 8；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 33 | `O_ADDRAD9` | Text | 100 | 0/24 | （空） | 戶籍／公司地址拆分組件 9；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 34 | `H_ADDRADR` | Text | 3 | 24/24 | 420 | 通訊地址拆分組件 R；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 35 | `H_ADDRAD1` | Text | 20 | 24/24 | 西湳里 | 通訊地址拆分組件 1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 36 | `H_ADDRAD2` | Text | 20 | 24/24 | 臺中市範例區範例路1號 | 通訊地址拆分組件 2；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 37 | `H_ADDRAD3` | Text | 20 | 0/24 | （空） | 通訊地址拆分組件 3；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 38 | `H_ADDRAD4` | Text | 20 | 0/24 | （空） | 通訊地址拆分組件 4；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 39 | `H_ADDRAD5` | Text | 4 | 24/24 | 1 | 通訊地址拆分組件 5；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 40 | `H_ADDRAD6` | Text | 4 | 0/24 | （空） | 通訊地址拆分組件 6；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 41 | `H_ADDRAD6_1` | Text | 4 | 0/24 | （空） | 通訊地址拆分組件 6_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 42 | `H_ADDRAD7` | Text | 4 | 0/24 | （空） | 通訊地址拆分組件 7；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 43 | `H_ADDRAD7_1` | Text | 4 | 0/24 | （空） | 通訊地址拆分組件 7_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 44 | `H_ADDRAD8` | Text | 4 | 0/24 | （空） | 通訊地址拆分組件 8；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 45 | `H_ADDRAD9` | Text | 100 | 0/24 | （空） | 通訊地址拆分組件 9；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 46 | `ADDRADR` | Text | 3 | 1/24 | 436 | 建築物門牌地址拆分組件 R；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 47 | `ADDRAD1` | Text | 20 | 1/24 | 臺中市範例區範例路1號 | 建築物門牌地址拆分組件 1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 48 | `ADDRAD2` | Text | 20 | 1/24 | 星海路 | 建築物門牌地址拆分組件 2；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 49 | `ADDRAD3` | Text | 20 | 0/24 | （空） | 建築物門牌地址拆分組件 3；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 50 | `ADDRAD4` | Text | 20 | 0/24 | （空） | 建築物門牌地址拆分組件 4；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 51 | `ADDRAD5` | Text | 4 | 1/24 | 72 | 建築物門牌地址拆分組件 5；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 52 | `ADDRAD6` | Text | 4 | 1/24 | 11 | 建築物門牌地址拆分組件 6；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 53 | `ADDRAD6_1` | Text | 4 | 0/24 | （空） | 建築物門牌地址拆分組件 6_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 54 | `ADDRAD7` | Text | 4 | 0/24 | （空） | 建築物門牌地址拆分組件 7；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 55 | `ADDRAD7_1` | Text | 4 | 0/24 | （空） | 建築物門牌地址拆分組件 7_1；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 56 | `ADDRAD8` | Text | 4 | 0/24 | （空） | 建築物門牌地址拆分組件 8；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 57 | `ADDRAD9` | Text | 100 | 0/24 | （空） | 建築物門牌地址拆分組件 9；ADR 為行政區代碼，其餘須依來源地址拆欄 |
| 58 | `CHKMARK` | Text | 1 | 0/24 | （空） | 狀態／檢核旗標；通常 Y/N 或空白 |
| 59 | `CR_DATE` | Text | 7 | 24/24 | 1150622；1150623 | 建立日期；民國 yyyMMdd（7 碼） |
| 60 | `UP_DATE` | Text | 7 | 24/24 | 1150623 | 異動日期；民國 yyyMMdd（7 碼） |
| 61 | `OP_USER` | Text | 10 | 0/24 | （空） | 操作使用者代碼 |
| 62 | `識別碼` | Long AutoNumber | — | 24/24 | 4163；4164；4187 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 63 | `CNAME_OLD` | Text | 70 | 0/24 | （空） | 變更前／原核准值；對應欄位 CNAME |
| 64 | `BIRTH_DATE_OLD` | Text | 7 | 0/24 | （空） | 變更前／原核准值；對應欄位 BIRTH_DATE |
| 65 | `TEL_NO_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 TEL_NO |
| 66 | `FAX_NO_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 FAX_NO |
| 67 | `EMAIL_OLD` | Text | 50 | 0/24 | （空） | 變更前／原核准值；對應欄位 EMAIL |
| 68 | `IDENTIFY_NO_OLD` | Text | 30 | 0/24 | （空） | 變更前／原核准值；對應欄位 IDENTIFY_NO |
| 69 | `O_ADDRADR_OLD` | Text | 3 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRADR |
| 70 | `O_ADDRAD1_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD1 |
| 71 | `O_ADDRAD2_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD2 |
| 72 | `O_ADDRAD3_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD3 |
| 73 | `O_ADDRAD4_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD4 |
| 74 | `O_ADDRAD5_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD5 |
| 75 | `O_ADDRAD6_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD6 |
| 76 | `O_ADDRAD6_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD6_1 |
| 77 | `O_ADDRAD7_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD7 |
| 78 | `O_ADDRAD7_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD7_1 |
| 79 | `O_ADDRAD8_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD8 |
| 80 | `O_ADDRAD9_OLD` | Text | 100 | 0/24 | （空） | 變更前／原核准值；對應欄位 O_ADDRAD9 |
| 81 | `H_ADDRADR_OLD` | Text | 3 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRADR |
| 82 | `H_ADDRAD1_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD1 |
| 83 | `H_ADDRAD2_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD2 |
| 84 | `H_ADDRAD3_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD3 |
| 85 | `H_ADDRAD4_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD4 |
| 86 | `H_ADDRAD5_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD5 |
| 87 | `H_ADDRAD6_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD6 |
| 88 | `H_ADDRAD6_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD6_1 |
| 89 | `H_ADDRAD7_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD7 |
| 90 | `H_ADDRAD7_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD7_1 |
| 91 | `H_ADDRAD8_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD8 |
| 92 | `H_ADDRAD9_OLD` | Text | 100 | 0/24 | （空） | 變更前／原核准值；對應欄位 H_ADDRAD9 |
| 93 | `ADDRADR_OLD` | Text | 3 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRADR |
| 94 | `ADDRAD1_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD1 |
| 95 | `ADDRAD2_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD2 |
| 96 | `ADDRAD3_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD3 |
| 97 | `ADDRAD4_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD4 |
| 98 | `ADDRAD5_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD5 |
| 99 | `ADDRAD6_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD6 |
| 100 | `ADDRAD6_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD6_1 |
| 101 | `ADDRAD7_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD7 |
| 102 | `ADDRAD7_1_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD7_1 |
| 103 | `ADDRAD8_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD8 |
| 104 | `ADDRAD9_OLD` | Text | 100 | 0/24 | （空） | 變更前／原核准值；對應欄位 ADDRAD9 |
| 105 | `BUILDING_NO_OLD` | Text | 20 | 0/24 | （空） | 變更前／原核准值；對應欄位 BUILDING_NO |
| 106 | `CHWANG_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 CHWANG |
| 107 | `DONG_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 DONG |
| 108 | `FLOOR_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 FLOOR |
| 109 | `HOUSE_OLD` | Text | 4 | 0/24 | （空） | 變更前／原核准值；對應欄位 HOUSE |
| 110 | `BLD_CODE1_T` | Text | 2 | 24/24 | H2 | 代碼群組／顯示輔助值；對應欄位 BLD_CODE1 |
| 111 | `BLD_CODE2_T` | Text | 2 | 20/24 | 其他 | 代碼群組／顯示輔助值；對應欄位 BLD_CODE2 |
| 112 | `BLD_CODE3_T` | Text | 2 | 0/24 | （空） | 代碼群組／顯示輔助值；對應欄位 BLD_CODE3 |

### `BMSP02` — 設計人（建築師）

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 1/1 | 1 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `SPOKESMAN` | Text | 1 | 1/1 | Y | 代表列旗標；Y=代表、N=非代表 |
| 4 | `CNAME` | Text | 20 | 1/1 | 王範例 | 姓名／公司名稱；依所在表為起造人、設計人或監造人 |
| 5 | `IDENTIFY_NO` | Text | 10 | 0/1 | （空） | 身分證號／統一編號 |
| 6 | `COM_ID_WORD` | Text | 3 | 1/1 | 109 | 建築師開業證書字號年度／字別組件 |
| 7 | `COM_ID_NO` | Text | 6 | 1/1 | 00000000 | 建築師開業證書號碼組件 |
| 8 | `COM_ID_NO1` | Text | 2 | 0/1 | （空） | 建築師開業證書附加號碼 |
| 9 | `OFFICE_NAME` | Text | 40 | 1/1 | 範例建築師事務所 | 事務所名稱 |
| 10 | `COM_ZIP` | Text | 3 | 1/1 | 403 | 公司／事務所郵遞區號 |
| 11 | `COM_ADDRESS` | Text | 60 | 1/1 | 臺中市範例區範例路1號 | 公司／事務所地址（不含郵遞區號／行政區顯示字） |
| 12 | `TEL_NO` | Text | 20 | 1/1 | 04-00000000 | 電話 |
| 13 | `FAX_NO` | Text | 20 | 1/1 | 04-00000000 | 傳真 |
| 14 | `eMail` | Text | 50 | 0/1 | （空） | 電子郵件 |
| 15 | `CR_DATE` | Text | 7 | 1/1 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 16 | `UP_DATE` | Text | 7 | 0/1 | （空） | 異動日期；民國 yyyMMdd（7 碼） |
| 17 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 18 | `識別碼` | Long AutoNumber | — | 1/1 | 459 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 19 | `COM_ID_AREA` | Text | 1 | 1/1 | M | 建築師開業證書縣市字母代碼；臺中市為 M |

### `BMSP03` — 監造人（建築師）

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 1/1 | 1 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `SPOKESMAN` | Text | 1 | 1/1 | Y | 代表列旗標；Y=代表、N=非代表 |
| 4 | `CNAME` | Text | 20 | 1/1 | 王範例 | 姓名／公司名稱；依所在表為起造人、設計人或監造人 |
| 5 | `IDENTIFY_NO` | Text | 10 | 0/1 | （空） | 身分證號／統一編號 |
| 6 | `COM_ID_WORD` | Text | 3 | 1/1 | 109 | 建築師開業證書字號年度／字別組件 |
| 7 | `COM_ID_NO` | Text | 6 | 1/1 | 00000000 | 建築師開業證書號碼組件 |
| 8 | `COM_ID_NO1` | Text | 2 | 0/1 | （空） | 建築師開業證書附加號碼 |
| 9 | `OFFICE_NAME` | Text | 44 | 1/1 | 範例建築師事務所 | 事務所名稱 |
| 10 | `COM_ZIP` | Text | 3 | 1/1 | 411 | 公司／事務所郵遞區號 |
| 11 | `COM_ADDRESS` | Text | 60 | 1/1 | 臺中市範例區範例路1號 | 公司／事務所地址（不含郵遞區號／行政區顯示字） |
| 12 | `TEL_NO` | Text | 20 | 1/1 | 04-00000000  | 電話 |
| 13 | `FAX_NO` | Text | 20 | 0/1 | （空） | 傳真 |
| 14 | `eMail` | Text | 50 | 0/1 | （空） | 電子郵件 |
| 15 | `CHKMARK` | Text | 1 | 0/1 | （空） | 狀態／檢核旗標；通常 Y/N 或空白 |
| 16 | `CR_DATE` | Text | 7 | 1/1 | 1150625 | 建立日期；民國 yyyMMdd（7 碼） |
| 17 | `UP_DATE` | Text | 7 | 1/1 | 1150625 | 異動日期；民國 yyyMMdd（7 碼） |
| 18 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 19 | `識別碼` | Long AutoNumber | — | 1/1 | 176 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 20 | `COM_ID_AREA` | Text | 1 | 1/1 | M | 建築師開業證書縣市字母代碼；臺中市為 M |
| 21 | `CNAME_OLD` | Text | 20 | 0/1 | （空） | 變更前／原核准值；對應欄位 CNAME |
| 22 | `IDENTIFY_NO_OLD` | Text | 10 | 0/1 | （空） | 變更前／原核准值；對應欄位 IDENTIFY_NO |
| 23 | `COM_ID_WORD_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ID_WORD |
| 24 | `COM_ID_NO_OLD` | Text | 6 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ID_NO |
| 25 | `COM_ID_NO1_OLD` | Text | 2 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ID_NO1 |
| 26 | `OFFICE_NAME_OLD` | Text | 40 | 0/1 | （空） | 變更前／原核准值；對應欄位 OFFICE_NAME |
| 27 | `COM_ZIP_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ZIP |
| 28 | `COM_ADDRESS_OLD` | Text | 60 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ADDRESS |
| 29 | `TEL_NO_OLD` | Text | 20 | 0/1 | （空） | 變更前／原核准值；對應欄位 TEL_NO |
| 30 | `FAX_NO_OLD` | Text | 20 | 0/1 | （空） | 變更前／原核准值；對應欄位 FAX_NO |
| 31 | `EMAIL_OLD` | Text | 50 | 0/1 | （空） | 變更前／原核准值；對應欄位 EMAIL |
| 32 | `COM_ID_AREA_OLD` | Text | 1 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ID_AREA |

### `BMSP04` — 承造人／營造業／專任工程人員

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 1/1 | 1 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `SPOKESMAN` | Text | 1 | 1/1 | Y | 代表列旗標；Y=代表、N=非代表 |
| 4 | `COMPANY_NAME` | Text | 60 | 1/1 | 範例建設股份有限公司 | 營造業公司名稱 |
| 5 | `COM_ZIP` | Text | 3 | 1/1 | 420 | 公司／事務所郵遞區號 |
| 6 | `COM_ADDRESS` | Text | 60 | 1/1 | 臺中市範例區範例路1號 | 公司／事務所地址（不含郵遞區號／行政區顯示字） |
| 7 | `COM_IDNO` | Text | 8 | 1/1 | 00000000 | 營造業統一編號 |
| 8 | `BOSS` | Text | 10 | 1/1 | 王範例 | 營造業負責人 |
| 9 | `ARC_REG_WORD` | Text | 1 | 1/1 | M | 營造業登記縣市字母代碼；臺中市為 M |
| 10 | `ARC_REG_CLAS` | Text | 1 | 1/1 | 1 | 營造業登記等級；ARCLS，1=甲 |
| 11 | `ARC_REG_NO` | Text | 6 | 1/1 | N00162 | 營造業登記字號主體 |
| 12 | `CIV_REG_WORD` | Text | 10 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 13 | `CIV_REG_NO` | Text | 4 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 14 | `CIV_REG_SEQ_NO` | Text | 2 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 15 | `TECH_NAME` | Text | 10 | 1/1 | 王範例 | 專任工程人員姓名 |
| 16 | `TECH_IDNO` | Text | 10 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 17 | `TECH_LIC` | Text | 40 | 1/1 | 範例證字第000001號 | 專任工程人員證書字號 |
| 18 | `TEL_NO` | Text | 20 | 0/1 | （空） | 電話 |
| 19 | `FAX_NO` | Text | 20 | 0/1 | （空） | 傳真 |
| 20 | `eMail` | Text | 50 | 0/1 | （空） | 電子郵件 |
| 21 | `Io_Number` | Text | 20 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 22 | `ARC_REG_PRI` | Text | 3 | 1/1 | 001 | 營造業登記字號前置／序號組件 |
| 23 | `CHKMARK` | Text | 1 | 0/1 | （空） | 狀態／檢核旗標；通常 Y/N 或空白 |
| 24 | `CR_DATE` | Text | 7 | 1/1 | 1150625 | 建立日期；民國 yyyMMdd（7 碼） |
| 25 | `UP_DATE` | Text | 7 | 1/1 | 1150625 | 異動日期；民國 yyyMMdd（7 碼） |
| 26 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 27 | `識別碼` | Long AutoNumber | — | 1/1 | 169 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 28 | `CLSRAN` | Text | 1 | 1/1 | 1 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 29 | `COMPANY_NAME_OLD` | Text | 40 | 0/1 | （空） | 變更前／原核准值；對應欄位 COMPANY_NAME |
| 30 | `COM_ZIP_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ZIP |
| 31 | `COM_ADDRESS_OLD` | Text | 60 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_ADDRESS |
| 32 | `COM_IDNO_OLD` | Text | 8 | 0/1 | （空） | 變更前／原核准值；對應欄位 COM_IDNO |
| 33 | `BOSS_OLD` | Text | 10 | 0/1 | （空） | 變更前／原核准值；對應欄位 BOSS |
| 34 | `CLSRAN_OLD` | Text | 1 | 0/1 | （空） | 變更前／原核准值；對應欄位 CLSRAN |
| 35 | `ARC_REG_WORD_OLD` | Text | 1 | 0/1 | （空） | 變更前／原核准值；對應欄位 ARC_REG_WORD |
| 36 | `ARC_REG_CLAS_OLD` | Text | 1 | 0/1 | （空） | 變更前／原核准值；對應欄位 ARC_REG_CLAS |
| 37 | `ARC_REG_NO_OLD` | Text | 6 | 0/1 | （空） | 變更前／原核准值；對應欄位 ARC_REG_NO |
| 38 | `ARC_REG_PRI_OLD` | Text | 3 | 0/1 | （空） | 變更前／原核准值；對應欄位 ARC_REG_PRI |
| 39 | `TECH_NAME_OLD` | Text | 10 | 0/1 | （空） | 變更前／原核准值；對應欄位 TECH_NAME |
| 40 | `TECH_LIC_OLD` | Text | 40 | 0/1 | （空） | 變更前／原核准值；對應欄位 TECH_LIC |
| 41 | `TEL_NO_OLD` | Text | 20 | 0/1 | （空） | 變更前／原核准值；對應欄位 TEL_NO |
| 42 | `FAX_NO_OLD` | Text | 20 | 0/1 | （空） | 變更前／原核准值；對應欄位 FAX_NO |
| 43 | `EMAIL_OLD` | Text | 50 | 0/1 | （空） | 變更前／原核准值；對應欄位 EMAIL |
| 44 | `SCTNAME` | Text | 50 | 1/1 | 王範例 | 工地主任姓名 |
| 45 | `SCTNO` | Text | 10 | 1/1 | 40H3037174 | 工地主任執業證號 |
| 46 | `FTENGTYPE` | Text | 1 | 1/1 | 1 | 專任工程人員種類代碼；查 TECTYP |
| 47 | `GUILDNO1` | Text | 6 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 48 | `GUILDNO2` | Text | 6 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 49 | `SCTNAME_OLD` | Text | 50 | 0/1 | （空） | 變更前／原核准值；對應欄位 SCTNAME |
| 50 | `SCTNO_OLD` | Text | 10 | 0/1 | （空） | 變更前／原核准值；對應欄位 SCTNO |
| 51 | `FTENGTYPE_OLD` | Text | 1 | 0/1 | （空） | 變更前／原核准值；對應欄位 FTENGTYPE |
| 52 | `GUILDNO1_OLD` | Text | 6 | 0/1 | （空） | 變更前／原核准值；對應欄位 GUILDNO1 |
| 53 | `GUILDNO2_OLD` | Text | 6 | 0/1 | （空） | 變更前／原核准值；對應欄位 GUILDNO2 |

### `BMSPARK` — 停車空間彙總

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 1/1 | 1 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `PARK_KIND` | Text | 1 | 1/1 | 1 | 停車方式；PARKTY，1=平面 |
| 4 | `CAR_KIND` | Text | 1 | 1/1 | 1 | 車種；CARTYP，1=小型車 |
| 5 | `APPL_KIND` | Text | 1 | 1/1 | 1 | 設立類別；APPLTY，1=法定 |
| 6 | `IN_OUT` | Text | 1 | 1/1 | 1 | 室內外別；INOUT，1=室內 |
| 7 | `UP_DOWN` | Text | 1 | 1/1 | 1 | 地上地下別；UPDN，1=地上 |
| 8 | `NUM` | Double | — | 1/1 | 20 | 數量／車位數 |
| 9 | `AREA` | Decimal | — | 1/1 | 275 | 面積（㎡）；BMSWORK 中亦為工作物面積 |
| 10 | `AIR_FLAG` | Text | 1 | 1/1 | N | 是否兼防空避難旗標（Y/N） |
| 11 | `CR_DATE` | Text | 7 | 1/1 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 12 | `UP_DATE` | Text | 7 | 1/1 | 1130409 | 異動日期；民國 yyyMMdd（7 碼） |
| 13 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 14 | `識別碼` | Long AutoNumber | — | 1/1 | 499 | Access AutoNumber 內部識別碼；非業務主鍵 |

### `BMSSC` — 營造業開竣工查報表 B21-2 資料

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `識別碼` | Long AutoNumber | — | 1/1 | 142 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 2 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 3 | `PRSTYLE` | Text | 1 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 4 | `LICENSE_OLD` | Text | 100 | 0/1 | （空） | 變更前／原核准值；對應欄位 LICENSE |
| 5 | `P01_NAME` | Text | 100 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 6 | `P04_NAME` | Text | 100 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 7 | `P04_NO` | Text | 30 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 8 | `COST_PUB` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 9 | `COST_PUB_MAKING` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 10 | `COST_PRI_SELECT` | Text | 20 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 11 | `COST_PRI` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 12 | `ZON_WORKING` | Text | 100 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 13 | `ZON_ZIP` | Text | 5 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 14 | `DATE_WORK_START` | Text | 7 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 15 | `DATE_WORK_END` | Text | 7 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 16 | `DATE_USELIC` | Text | 7 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 17 | `AREA_FLOOR` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 18 | `AREA_UNDER_FLOOR` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 19 | `FLOOR_COST` | Text | 254 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 20 | `FLOOR_NUMBER` | Text | 254 | 0/1 | （空） | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 21 | `PARK_INSIDE` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 22 | `PARK_OUTSIDE` | Double | — | 1/1 | 0 | 原系統相容欄位；以型別、樣本值及相鄰欄位判讀 |
| 23 | `BUC1` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC1（Y/N） |
| 24 | `BUC2` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC2（Y/N） |
| 25 | `BUC3` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC3（Y/N） |
| 26 | `BUC4` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC4（Y/N） |
| 27 | `BUC5` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC5（Y/N） |
| 28 | `BUC6` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC6（Y/N） |
| 29 | `BUC7` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC7（Y/N） |
| 30 | `BUC8` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC8（Y/N） |
| 31 | `BUC9` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUC9（Y/N） |
| 32 | `BUP1` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP1（Y/N） |
| 33 | `BUP2` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP2（Y/N） |
| 34 | `BUP3` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP3（Y/N） |
| 35 | `BUP4` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP4（Y/N） |
| 36 | `BUP5` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP5（Y/N） |
| 37 | `BUP6` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP6（Y/N） |
| 38 | `BUP7` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP7（Y/N） |
| 39 | `BUP8` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP8（Y/N） |
| 40 | `BUP9` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP9（Y/N） |
| 41 | `BUP10` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP10（Y/N） |
| 42 | `BUP11` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUP11（Y/N） |
| 43 | `BUK1` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK1（Y/N） |
| 44 | `BUK2` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK2（Y/N） |
| 45 | `BUK3` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK3（Y/N） |
| 46 | `BUK4` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK4（Y/N） |
| 47 | `BUK5` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK5（Y/N） |
| 48 | `BUK6` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUK6（Y/N） |
| 49 | `BUS1` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUS1（Y/N） |
| 50 | `BUS2` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUS2（Y/N） |
| 51 | `BUS3` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUS3（Y/N） |
| 52 | `BUS4` | Text | 1 | 1/1 | N | B21-2 開竣工查報表選項旗標 BUS4（Y/N） |
| 53 | `PEO_TECH_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |
| 54 | `PEO_PLAIN_DATE` | Text | 7 | 0/1 | （空） | 日期欄位；文字欄通常採民國 yyyMMdd |

### `BMSSTAIR` — 樓層－用途－面積明細

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 5/5 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 5/5 | 2；3；4 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `BUILDING_NO` | Text | 4 | 0/5 | （空） | 棟別代號；空白時表示未再按棟別拆分樓層列 |
| 4 | `STORY_CODE` | Text | 5 | 5/5 | U0010；U0020；U0030 | 樓層代碼；STC 的 CODE_SEQ + SUB_SEQ，例如 U0010 |
| 5 | `USAGE_CODE1` | Text | 2 | 5/5 | H2；00 | 樓層用途類組 1；查 USECOD |
| 6 | `USAGE_CODE2` | Text | 2 | 1/5 | 00 | 樓層用途類組 2；查 USECOD |
| 7 | `USAGE_CODE3` | Text | 2 | 0/5 | （空） | 樓層用途類組 3；查 USECOD |
| 8 | `USAGE_CODE1_DESC` | Text | 50 | 5/5 | 住宅；樓梯間 | 樓層用途 1 顯示文字 |
| 9 | `USAGE_CODE2_DESC` | Text | 50 | 1/5 | 停車空間 | 樓層用途 2 顯示文字 |
| 10 | `USAGE_CODE3_DESC` | Text | 50 | 0/5 | （空） | 樓層用途 3 顯示文字 |
| 11 | `STORY_AREA` | Decimal | — | 5/5 | 966.56；989.26；985.86 | 該樓層／用途列面積（㎡） |
| 12 | `STORY_HEIGHT` | Decimal | — | 5/5 | 3.8；3.4；3 | 該樓層高度（m） |
| 13 | `VERANDA_AREA` | Decimal | — | 5/5 | 0；1.15 | 陽台面積（㎡） |
| 14 | `TERRACE_AREA` | Decimal | — | 0/5 | （空） | 露臺面積（㎡） |
| 15 | `CHKMARK` | Text | 1 | 0/5 | （空） | 狀態／檢核旗標；通常 Y/N 或空白 |
| 16 | `CR_DATE` | Text | 7 | 5/5 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 17 | `UP_DATE` | Text | 7 | 5/5 | 1150623 | 異動日期；民國 yyyMMdd（7 碼） |
| 18 | `OP_USER` | Text | 10 | 0/5 | （空） | 操作使用者代碼 |
| 19 | `識別碼` | Long AutoNumber | — | 5/5 | 3558；3559；3560 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 20 | `BUILDING_NO_OLD` | Text | 4 | 0/5 | （空） | 變更前／原核准值；對應欄位 BUILDING_NO |
| 21 | `STORY_CODE_OLD` | Text | 5 | 5/5 | U0010；U0020；U0030 | 變更前／原核准值；對應欄位 STORY_CODE |
| 22 | `USAGE_CODE1_OLD` | Text | 2 | 5/5 | H2；00 | 變更前／原核准值；對應欄位 USAGE_CODE1 |
| 23 | `USAGE_CODE2_OLD` | Text | 2 | 1/5 | 00 | 變更前／原核准值；對應欄位 USAGE_CODE2 |
| 24 | `USAGE_CODE3_OLD` | Text | 2 | 0/5 | （空） | 變更前／原核准值；對應欄位 USAGE_CODE3 |
| 25 | `STORY_AREA_OLD` | Decimal | — | 5/5 | 966.56；989.26；985.86 | 變更前／原核准值；對應欄位 STORY_AREA |
| 26 | `STORY_HEIGHT_OLD` | Decimal | — | 5/5 | 3.8；3.4；3 | 變更前／原核准值；對應欄位 STORY_HEIGHT |
| 27 | `VERANDA_AREA_OLD` | Decimal | — | 2/5 | 1.15 | 變更前／原核准值；對應欄位 VERANDA_AREA |
| 28 | `TERRACE_AREA_OLD` | Decimal | — | 0/5 | （空） | 變更前／原核准值；對應欄位 TERRACE_AREA |
| 29 | `USAGE_CODE1_DESC_OLD` | Text | 50 | 5/5 | 住宅；樓梯間 | 變更前／原核准值；對應欄位 USAGE_CODE1_DESC |
| 30 | `USAGE_CODE2_DESC_OLD` | Text | 50 | 1/5 | 停車空間 | 變更前／原核准值；對應欄位 USAGE_CODE2_DESC |
| 31 | `USAGE_CODE3_DESC_OLD` | Text | 50 | 0/5 | （空） | 變更前／原核准值；對應欄位 USAGE_CODE3_DESC |
| 32 | `USAGE_CODE1_T` | Text | 2 | 5/5 | H2；其他 | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE1 |
| 33 | `USAGE_CODE2_T` | Text | 2 | 1/5 | 其他 | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE2 |
| 34 | `USAGE_CODE3_T` | Text | 2 | 0/5 | （空） | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE3 |
| 35 | `USAGE_CODE1_OLD_T` | Text | 2 | 5/5 | H2；其他 | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE1_OLD |
| 36 | `USAGE_CODE2_OLD_T` | Text | 2 | 1/5 | 其他 | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE2_OLD |
| 37 | `USAGE_CODE3_OLD_T` | Text | 2 | 0/5 | （空） | 代碼群組／顯示輔助值；對應欄位 USAGE_CODE3_OLD |
| 38 | `BUILDING_NO_TEAR` | Text | 4 | 0/5 | （空） | 拆除部分值；對應欄位 BUILDING_NO |
| 39 | `STORY_CODE_TEAR` | Text | 5 | 0/5 | （空） | 拆除部分值；對應欄位 STORY_CODE |
| 40 | `USAGE_CODE1_TEAR` | Text | 2 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE1 |
| 41 | `USAGE_CODE2_TEAR` | Text | 2 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE2 |
| 42 | `USAGE_CODE3_TEAR` | Text | 2 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE3 |
| 43 | `STORY_AREA_TEAR` | Double | — | 0/5 | （空） | 拆除部分值；對應欄位 STORY_AREA |
| 44 | `STORY_HEIGHT_TEAR` | Double | — | 0/5 | （空） | 拆除部分值；對應欄位 STORY_HEIGHT |
| 45 | `VERANDA_AREA_TEAR` | Double | — | 0/5 | （空） | 拆除部分值；對應欄位 VERANDA_AREA |
| 46 | `TERRACE_AREA_TEAR` | Double | — | 0/5 | （空） | 拆除部分值；對應欄位 TERRACE_AREA |
| 47 | `USAGE_CODE1_DESC_TEAR` | Text | 50 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE1_DESC |
| 48 | `USAGE_CODE2_DESC_TEAR` | Text | 50 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE2_DESC |
| 49 | `USAGE_CODE3_DESC_TEAR` | Text | 50 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE3_DESC |
| 50 | `USAGE_CODE1_T_TEAR` | Text | 10 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE1_T |
| 51 | `USAGE_CODE2_T_TEAR` | Text | 10 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE2_T |
| 52 | `USAGE_CODE3_T_TEAR` | Text | 10 | 0/5 | （空） | 拆除部分值；對應欄位 USAGE_CODE3_T |

### `BMSWORK` — 雜項工作物明細

| # | 欄位 | MDB 型別 | 長度 | 非空/筆數 | 本檔樣本（最多 3 個） | 中文對應／規則 |
|---:|---|---|---:|---:|---|---|
| 1 | `INDEX_KEY` | Text | 20 | 1/1 | 1150101120000 | 案件主鍵；所有表用它關聯 |
| 2 | `person_seq` | Double | — | 1/1 | 1 | 子表列序號；正整數，決定匯出/顯示排序 |
| 3 | `CONSNAME` | Text | 200 | 1/1 | 圍牆 | 雜項工作物名稱 |
| 4 | `BUILDING_KIND` | Text | 30 | 1/1 | RC造 | 雜項工作物構造文字 |
| 5 | `LENGTH` | Double | — | 1/1 | 116.59 | 長度（m） |
| 6 | `HEIGHT` | Double | — | 1/1 | 2 | 高度（m） |
| 7 | `WIDE` | Double | — | 1/1 | 0.15 | 寬度／厚度（m） |
| 8 | `AREA` | Double | — | 1/1 | 233.18 | 面積（㎡）；BMSWORK 中亦為工作物面積 |
| 9 | `CONNUM` | Text | 30 | 0/1 | （空） | 數量 |
| 10 | `DESE` | Text | 100 | 0/1 | （空） | 說明／備註全文（原程式拼字） |
| 11 | `CR_DATE` | Text | 7 | 1/1 | 1150622 | 建立日期；民國 yyyMMdd（7 碼） |
| 12 | `UP_DATE` | Text | 7 | 0/1 | （空） | 異動日期；民國 yyyMMdd（7 碼） |
| 13 | `OP_USER` | Text | 10 | 0/1 | （空） | 操作使用者代碼 |
| 14 | `識別碼` | Long AutoNumber | — | 1/1 | 349 | Access AutoNumber 內部識別碼；非業務主鍵 |
| 15 | `CONSNAME_OLD` | Text | 200 | 0/1 | （空） | 變更前／原核准值；對應欄位 CONSNAME |
| 16 | `BUILDING_KIND_OLD` | Text | 30 | 0/1 | （空） | 變更前／原核准值；對應欄位 BUILDING_KIND |
| 17 | `LENGTH_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 LENGTH |
| 18 | `HEIGHT_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 HEIGHT |
| 19 | `WIDE_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 WIDE |
| 20 | `AREA_OLD` | Double | — | 0/1 | （空） | 變更前／原核准值；對應欄位 AREA |
| 21 | `DESE_OLD` | Text | 100 | 0/1 | （空） | 變更前／原核准值；對應欄位 DESE |

## 附錄 B：反向分析的本機證據

- `data.txt`：首位元組即 `@`，無 BOM；以 CP950 解碼可完整得到繁體中文；檔尾為 CRLF。
- `ARCH2016.exe` 內嵌：`@TableName %s`、`@RecordBegin`、`@d %s %s`、`@RecordEnd`。
- 同一匯出函式內嵌 SQL：`SELECT * FROM %s WHERE INDEX_KEY = %s` 與 `SELECT * FROM %s WHERE INDEX_KEY = %s AND PERSON_SEQ <> 0 ORDER BY PERSON_SEQ`。
- 匯入解析器明確辨識 `@TableName`、`@RecordBegin`、`@d`、`@m`、`@RecordEnd`。本檔只使用 `@d`，沒有 `@m`。
- `Build.mdb` 的 13 個表欄位數與 `data.txt` 完全相同；`識別碼` 為 AutoNumber。
- `fsrp/frxA11_1.fr3` 等報表直接綁定 `BMSBASE`、`BMSLAN`、`BMSP01` 等資料集欄位，證明顯示值由匯入後資料表及代碼查詢共同產生。
