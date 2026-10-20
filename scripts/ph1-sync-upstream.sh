#!/usr/bin/env bash
# Kéo thay đổi mới của repo chính (KDISTEM) vào bản tách PH1 — chỉ các file bản tách còn giữ.
# Dùng: scripts/ph1-sync-upstream.sh <thư mục repo chính đã git pull> [commit, mặc định HEAD]
# Áp dụng 3 chiều (git apply -3) dựa trên commit gốc ghi trong UPSTREAM_BASE; chỗ xung đột để lại dấu <<<<<<< để sửa tay.
set -euo pipefail
cd "$(dirname "$0")/.."
MAIN=$(cd "${1:?Thiếu đường dẫn repo chính}" && pwd); TO=$(git -C "$MAIN" rev-parse "${2:-HEAD}")
FROM=$(cat UPSTREAM_BASE)
[ "$FROM" = "$TO" ] && { echo "Đã ở $TO, không có gì mới."; exit 0; }
git diff --quiet HEAD || { echo "Còn thay đổi chưa commit — commit trước rồi đồng bộ."; exit 1; }
# File của repo chính mà bản tách vẫn giữ (bỏ App.tsx, lib/nav.ts, workflow, wrangler, README — đã chỉnh riêng cho bản tách)
KEEP=$(git ls-files | grep -vxE 'src/App.tsx|src/lib/nav.ts|\.github/workflows/db-tests.yml|wrangler.jsonc|README.md' || true)
# File mới ở repo chính: chỉ lấy nếu nằm ngoài src/pages (màn mới của phân hệ khác không cần)
NEWF=$(git -C "$MAIN" diff --name-only --diff-filter=A "$FROM" "$TO" | grep -v '^src/pages/' || true)
PATCH=$(mktemp)
git -C "$MAIN" diff --binary "$FROM" "$TO" -- $KEEP $NEWF > "$PATCH"
if [ ! -s "$PATCH" ]; then echo "Không có thay đổi ở các file bản tách đang giữ."
else git apply -3 --index "$PATCH" && echo "Đã áp thay đổi $FROM → $TO" || echo "Có xung đột: sửa các chỗ <<<<<<< rồi commit."; fi
echo "$TO" > UPSTREAM_BASE
echo "Xem thêm thay đổi ở App.tsx / lib/nav.ts của repo chính (không tự áp):"
git -C "$MAIN" diff --stat "$FROM" "$TO" -- src/App.tsx src/lib/nav.ts
rm -f "$PATCH"
