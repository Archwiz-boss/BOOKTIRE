# PostgreSQL 對接工具

這一層讓內部系統以「一份完整案件文件」保存 CPAMI 13 表與 B／C／D 系列擴充資料。`cpami_case_documents.payload` 的 JSONB 是正本，包含 `tables` 與 `extraTables`，所有欄位值保持字串；`cpami_v_*` 只投影 data.txt 的 13 表。編輯器本體仍可離線執行，不依賴 PostgreSQL 或 psycopg。

## 前置條件

- PostgreSQL 資料庫編碼必須是 `UTF8`。
- 執行資料庫工具的 Python 安裝 psycopg 3：

```powershell
python -m pip install "psycopg[binary]>=3.2,<4"
```

- 建議用環境變數保存連線字串，避免寫進命令歷程或版控：

```powershell
$env:CPAMI_PG_DSN = "postgresql://cpami_user:password@127.0.0.1:5432/cpami"
```

資料庫 payload 含姓名、身分證字號、地址與電話。正式環境應由內部系統處理權限控管、傳輸加密與備份加密。

## 建立資料庫結構

以下指令都從 `BOOKTIRE` repo 根目錄執行：

```powershell
psql $env:CPAMI_PG_DSN -f .\db\schema.sql
psql $env:CPAMI_PG_DSN -f .\db\views.sql
```

如果 schema 欄位或數字欄定義改變，先重新產生 view 再執行：

```powershell
python -X utf8 .\cpami-form-editor\tools\gen_db_views.py
psql $env:CPAMI_PG_DSN -f .\db\views.sql
```

`schema.sql` 與 `views.sql` 可重複執行。不得替 `index_key` 增加唯一約束；它是可能撞號的業務索引，不是資料庫主鍵。

## 載入代碼庫

先確認筆數，不連線：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_load_codes.py --dry-run
```

實際將 `web/codebook.json` 的全部 `codeTypes`（包含 `ALLRPT`）與官方地段載入 `cpami_codes`：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_load_codes.py --dsn $env:CPAMI_PG_DSN
```

## 匯入案件

匯入前可先用 dry-run 驗證格式。摘要會遮蔽工程名稱、來源檔名與案件鍵，也不顯示 payload 內容：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_import.py `
  --data-txt .\data.txt `
  --form-set A `
  --status draft `
  --dry-run
```

實際匯入 data.txt：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_import.py `
  --dsn $env:CPAMI_PG_DSN `
  --data-txt .\data.txt `
  --form-set A `
  --status draft
```

也可以匯入 UTF-8 案件 JSON 封套：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_import.py `
  --dsn $env:CPAMI_PG_DSN `
  --case-json .\case.json `
  --form-set B `
  --status draft
```

schema `2026-07-14.2` 的完整案件 JSON 可包含 `extraTables.BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO/C21_3/BMELVTR`。`pg_import.py` 會把六組資料連同 13 表一起保存；dry-run 只顯示擴充表筆數，不會印出附件或個資內容。

`status=draft` 時，工具會更新同一 `index_key + form_set` 的最近一份草稿；其他狀態一律新增文件。有驗證錯誤時預設中止；確實需要保留待修草稿才使用 `--allow-invalid`，而且狀態必須是 `draft`。有錯誤的草稿仍不能匯出 data.txt。

## 匯出 data.txt

單一 `INDEX_KEY` 只有一份文件時：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_export.py `
  --dsn $env:CPAMI_PG_DSN `
  --index-key 1150101120000 `
  --out .\export\data.txt
```

同鍵有多份文件時，工具會列出候選 UUID 並要求指定 `--case-id`：

```powershell
python -X utf8 .\cpami-form-editor\tools\pg_export.py `
  --dsn $env:CPAMI_PG_DSN `
  --index-key 1150101120000 `
  --case-id 00000000-0000-0000-0000-000000000000 `
  --out .\export\data.txt
```

匯出一律經 `cpami_core` 驗證與序列化，完整輸出 13 表、596 欄、CP950、CRLF、無 BOM；schema 版本不符、驗證錯誤或 CP950 無法編碼時會中止。`extraTables` 仍保留在資料庫 payload，不會混入舊 data.txt。

## 內部系統對接最小工作清單

1. 執行 `db/schema.sql` 與 `db/views.sql`。
2. 執行 `pg_load_codes.py` 載入代碼與 `ALLRPT` 書表目錄。
3. 逐份執行 `pg_import.py` 將既有 data.txt 或案件 JSON 入庫。
4. 讀取 `cpami_v_*`；寫入時組案件封套，並先用 `cpami_core` 驗證。
5. 需要送回舊系統時，用 `pg_export.py` 產生 data.txt。
6. 若整合線上編輯器，只替換前端 `caseStore` 對接內部 cases API；不要把 DB 依賴放入 `server.py` 或 `web/`。

## 尚未實作：可重用資料範本

目前 `schema.sql` 只包含工程、案件文件與代碼庫，尚未建立起造人、設計／監造建築師、承造人或技師範本資料表。後續會以獨立的 `cpami_data_templates` 與 `templateStore` API 實作，不把範本混入案件 JSONB；欄位 allowlist、排除案件鍵與套用規則見 `../docs/POSTGRES_INTEGRATION_PLAN.md` §3.5。

## 測試

沒有 PostgreSQL 也能執行離線測試：

```powershell
cd .\cpami-form-editor
python -X utf8 .\tests\pg_tools_test.py
```

設定 `CPAMI_PG_DSN` 後，同一指令會額外建立 schema/view、匯入虛構 fixture、匯出並逐位元組比對，再核對代碼筆數。請只對測試或已授權的資料庫執行整合段。
