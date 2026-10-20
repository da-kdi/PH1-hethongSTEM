#!/usr/bin/env bash
# Xuất toàn bộ phần việc PH1 thành một file patch để áp vào repo chính (KDISTEM).
# Patch = mọi thay đổi so với bản gốc (tag upstream-base), TRỪ:
#   • file bị xoá khi tách (--diff-filter=d: repo chính vẫn giữ các màn đó);
#   • các file chỉ dành cho bản tách (danh sách SHELL_ONLY bên dưới).
# Dùng: scripts/ph1-export-patch.sh [file_ra]   (mặc định ph1.patch)
# Áp vào repo chính: xem docs/GHEP-VE-REPO-CHINH.md
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-ph1.patch}
SHELL_ONLY=(src/App.tsx src/lib/nav.ts .github/workflows/db-tests.yml wrangler.jsonc README.md
  vite.config.ts .env.example .github/workflows/pages.yml .github/workflows/ph1-db.yml supabase/tests/run.sh supabase/ph1-reset.txt docs/GHEP-VE-REPO-CHINH.md docs/ghep-lan-dau.diff scripts/ph1-export-patch.sh scripts/ph1-sync-upstream.sh UPSTREAM_BASE)
EXCL=(); for f in "${SHELL_ONLY[@]}"; do EXCL+=(":(exclude)$f"); done

git diff --quiet HEAD || { echo "Còn thay đổi chưa commit — commit trước rồi xuất patch."; exit 1; }
# Cảnh báo nếu đã sửa file chỉ dành cho bản tách: phần sửa đó KHÔNG đi theo patch, phải ghép tay
CHANGED=$(git diff --name-only ph1-start HEAD -- "${SHELL_ONLY[@]}" | grep -vE '^(docs/GHEP|scripts/ph1-|UPSTREAM_BASE)' || true)
[ -z "$CHANGED" ] || { echo "⚠ Đã sửa file khung (không nằm trong patch, cần ghép tay):"; echo "$CHANGED" | sed 's/^/   /'; }

git diff --binary --diff-filter=d upstream-base HEAD -- . "${EXCL[@]}" > "$OUT"
echo "Đã xuất $OUT (gốc: $(cat UPSTREAM_BASE))"
git diff --stat --diff-filter=d upstream-base HEAD -- . "${EXCL[@]}" | tail -n 25
# Migration mới của PH1: nhắc kiểm tra trùng số với repo chính
NEW_SQL=$(git diff --name-only --diff-filter=A upstream-base HEAD -- supabase/migrations || true)
[ -z "$NEW_SQL" ] || { echo; echo "Migration mới (đổi số nếu repo chính đã dùng số này):"; echo "$NEW_SQL" | sed 's/^/   /'; }
