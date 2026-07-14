-- CPAMI 案件資料庫需使用 UTF8 編碼；CP950 只存在於 data.txt 匯入／匯出邊界。
-- payload 內所有欄位值一律是字串，JSONB 是資料正本，cpami_v_* view 只是查詢投影。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cpami_projects (
    project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    city_code text NOT NULL DEFAULT '',
    license text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cpami_case_documents (
    case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES cpami_projects(project_id),
    form_set text NOT NULL DEFAULT 'A',
    schema_version text NOT NULL,
    index_key text NOT NULL,
    apply_type text NOT NULL DEFAULT '',
    building_name text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft',
    payload jsonb NOT NULL,
    source_file text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_documents_index_key
    ON cpami_case_documents (index_key);
CREATE INDEX IF NOT EXISTS idx_case_documents_project
    ON cpami_case_documents (project_id, form_set);
CREATE INDEX IF NOT EXISTS idx_case_documents_payload
    ON cpami_case_documents USING gin (payload jsonb_path_ops);

CREATE TABLE IF NOT EXISTS cpami_codes (
    code_type text NOT NULL,
    code text NOT NULL,
    sub text NOT NULL DEFAULT '',
    parent text NOT NULL DEFAULT '',
    label text NOT NULL DEFAULT '',
    mark text NOT NULL DEFAULT '',
    source text NOT NULL DEFAULT '',
    PRIMARY KEY (code_type, code, sub, parent)
);

CREATE OR REPLACE FUNCTION cpami_roc_to_date(t text) RETURNS date
IMMUTABLE LANGUAGE sql AS $$
    SELECT CASE WHEN t ~ '^[0-9]{7}$' THEN
        make_date(substr(t, 1, 3)::int + 1911, substr(t, 4, 2)::int, substr(t, 6, 2)::int)
    END
$$;

-- 建立基本結構後，請接著執行 db/views.sql 建立 13 個 JSONB 投影 view。
