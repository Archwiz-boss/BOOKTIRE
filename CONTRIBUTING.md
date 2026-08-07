# 參與貢獻

歡迎回報問題、提出建議或送 Pull Request。

## 回報問題

到 [Issues](https://github.com/Archwiz-boss/BOOKTIRE/issues) 開一則，請盡量附上：

- 你用的是**桌面版（exe）**還是**線上試用版**
- 操作步驟（做了什麼 → 預期什麼 → 實際發生什麼）
- 錯誤訊息的截圖或文字

> ⚠️ **絕對不要在 Issue 附上真實案件的 `data.txt` 或 ZIP。**
> 那裡面有身分證字號、地址、電話。
> 需要範例檔時請用虛構資料，或參考
> `cpami-form-editor/tests/fixtures/sample_data.txt`。

## 送 Pull Request

1. 動手前**先讀 [`docs/開發指南.md`](docs/開發指南.md) 與 [`CLAUDE.md`](CLAUDE.md)**。
   格式鐵則違反了，產出的檔案舊系統會直接拒收。
2. 跑對應的測試，並在 PR 說明裡**貼上測試輸出**。
   對照表在[開發指南](docs/開發指南.md#測試與驗收)。
3. 改了行為就**同步改測試斷言**。
4. Commit 訊息用 `feat:` / `fix:` / `refactor:` / `docs:` 前綴。

### PR 檢查清單

- [ ] 沒有夾帶任何真實個資（姓名、身分證字號、地址、電話）
- [ ] 沒有手改 `web/codebook.json`
- [ ] 13 表 596 欄的欄序契約沒有被動到
- [ ] 位元組級 roundtrip 測試通過（`tests/server_roundtrip_test.py`）
- [ ] 測試輸出已貼在 PR 說明裡

## 行為準則

就是一般的專業禮貌：對事不對人，說明理由，接受不同意見。

## 授權

送出 PR 即表示你同意你的貢獻以 [MIT License](LICENSE) 釋出。
