# AGENTS.md

本專案**唯一的原則文件是根目錄的 [`CLAUDE.md`](CLAUDE.md)**。

- 開始任何分析或改動之前，先完整閱讀 `CLAUDE.md`。
- 本檔永遠不放規則。要新增或修改規則時，一律寫進 `CLAUDE.md`，保持單一版本、避免兩份文件漂移。
- 工作指令（逐項可執行的 prompt 與驗收標準）：`docs/CODEX_PROMPTS.md`。
- PostgreSQL 對接規劃：`docs/POSTGRES_INTEGRATION_PLAN.md`。
- 欄位與代碼語意依據：`CPAMI_data_txt_欄位與代碼對應表.md`、`CPAMI_指定書表_實用數據對應表.md`。

特別提醒（詳見 `CLAUDE.md`，此處僅防呆）：根目錄 `data.txt` 與 `cpami/` 含真實個資與第三方程式，不得提交進版控、不得修改、不得外傳。
