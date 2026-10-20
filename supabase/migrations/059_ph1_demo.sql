-- 059. PH1 · Dữ liệu mẫu mục 1.1 (057–058). CHỈ chạy khi bật cờ app.seed_demo = on. Bỏ qua nếu đã có chương trình KDI mã CT1.
--   Chương trình KDI CT1–CT6 (CT6 = ví dụ mở rộng), chương trình địa phương của Sở Hưng Yên, bản kế thừa của THCS Phố Hiến;
--   gói Cơ bản / Nâng cao / gói riêng, gói áp dụng cho trường; bộ học liệu có định mức vật tư; kế hoạch phân phối theo tuần
--   (trường A 2 tiết/tuần, trường B 1 tiết/tuần cùng bộ học liệu) có tiến độ, minh chứng; giáo án triển khai; khoá e-learning.

-- Nội dung một phiên bản. p_subjects: [[môn, khối, tổng tiết, tiết/tuần, bắt buộc]]
-- p_units: [{t, g, s, i: [môn tích hợp], r: phòng, d: mô tả, l: [[bài, số tiết, yêu cầu cần đạt]], o: [[loại, môn, mô tả, năng lực]]}]
create or replace function pg_temp.d_fill(p_version uuid, p_subjects jsonb, p_units jsonb) returns void language plpgsql as $$
declare u jsonb; l jsonb; o jsonb; s jsonb; v_unit uuid; v_lesson uuid; i int := 0; j int; k int; n int; v_outs uuid[]; v_o uuid; v_rub jsonb; v_plan jsonb;
  v_steps text[] := array['Xác định vấn đề, nghiên cứu kiến thức nền', 'Đề xuất, lựa chọn giải pháp', 'Chế tạo mẫu, thử nghiệm và đánh giá', 'Chia sẻ, thảo luận và điều chỉnh'];
begin
  k := 0;
  for s in select * from jsonb_array_elements(p_subjects) loop
    k := k + 1;
    insert into curriculum_subjects (version_id, seq, subject, grade, periods_total, periods_per_week, is_required)
      values (p_version, k, s->>0, (s->>1)::int, (s->>2)::int, nullif(s->>3, '')::numeric, coalesce((s->>4)::boolean, true))
    on conflict do nothing;
  end loop;
  select criteria into v_rub from rubrics where org_id is null order by created_at limit 1;
  for u in select * from jsonb_array_elements(p_units) loop
    i := i + 1;
    insert into curriculum_units (version_id, seq, code, title, summary, grade, periods, subject_main, subjects_integrated, room_kind)
      values (p_version, i, 'C' || i, u->>'t', u->>'d', (u->>'g')::int,
              (select coalesce(sum((x->>1)::int), 0) from jsonb_array_elements(coalesce(u->'l', '[]')) x), u->>'s',
              coalesce(array(select jsonb_array_elements_text(u->'i')), '{}'), coalesce(u->>'r', 'stem'))
      returning id into v_unit;
    v_outs := '{}'; k := 0;
    for o in select * from jsonb_array_elements(coalesce(u->'o', '[]')) loop
      k := k + 1;
      insert into curriculum_outcomes (version_id, unit_id, seq, code, kind, subject, description, competency_key)
        values (p_version, v_unit, k, 'YC' || i || '.' || k, o->>0, nullif(o->>1, ''), o->>2, nullif(o->>3, '')) returning id into v_o;
      v_outs := v_outs || v_o;
    end loop;
    j := 0;
    for l in select * from jsonb_array_elements(coalesce(u->'l', '[]')) loop
      j := j + 1; n := greatest(coalesce((l->>1)::int, 1), 1);
      select coalesce(jsonb_agg(jsonb_build_object('title', v_steps[1 + ((x - 1) * 4 / n)], 'minutes', 35) order by x), '[]') into v_plan from generate_series(1, n) x;
      insert into curriculum_lessons (version_id, unit_id, seq, code, title, periods, minutes_per_period, period_plan, summary)
        values (p_version, v_unit, j, 'B' || i || '.' || j, l->>0, n, case when (u->>'g')::int <= 5 then 35 else 45 end, v_plan, l->>2)
        returning id into v_lesson;
      insert into curriculum_outcomes (version_id, unit_id, lesson_id, seq, code, kind, subject, description)
        values (p_version, v_unit, v_lesson, 1, 'YC' || i || '.' || j || 'a', 'kien_thuc', u->>'s', coalesce(l->>2, 'Nêu được kiến thức nền của bài ' || (l->>0) || '.'));
      insert into curriculum_outcomes (version_id, unit_id, lesson_id, seq, code, kind, subject, description)
        values (p_version, v_unit, v_lesson, 2, 'YC' || i || '.' || j || 'b', 'ky_nang', null,
                'Thực hiện được sản phẩm / nhiệm vụ của bài “' || (l->>0) || '” theo tiêu chí, sử dụng dụng cụ an toàn.')
        returning id into v_o;
      v_outs := v_outs || v_o;
    end loop;
    insert into curriculum_assessments (version_id, unit_id, seq, title, method, outcome_ids, rubric_id, criteria, evidence, weight)
      values (p_version, v_unit, 1, 'Sản phẩm của chủ đề ' || (u->>'t'), 'san_pham', v_outs[1:3],
              (select id from rubrics where org_id is null order by created_at limit 1), coalesce(v_rub, '[]'),
              'Ảnh / video sản phẩm của nhóm; phiếu đánh giá theo tiêu chí; nhật ký thiết kế', 60),
             (p_version, v_unit, 2, 'Thuyết trình và phản biện', 'thuyet_trinh', v_outs[1:1], null,
              '[{"name": "Nội dung trình bày", "levels": ["Thiếu ý chính", "Đủ ý nhưng rời rạc", "Rõ ràng, đúng kiến thức", "Rõ ràng, sâu, liên hệ thực tế"]},
                {"name": "Trả lời câu hỏi", "levels": ["Chưa trả lời được", "Trả lời một phần", "Trả lời đúng", "Trả lời đúng, mở rộng vấn đề"]}]',
              'Bài trình bày của đại diện nhóm; phiếu đánh giá đồng đẳng', 40);
  end loop;
end $$;

-- Một chương trình + các phiên bản [{label, status, note, from, to, decision_note}] cũ → mới.
-- Phiên bản cũ bỏ chủ đề cuối để so sánh phiên bản có khác biệt.
create or replace function pg_temp.d_prog(p_org uuid, p_code text, p_name text, p_color text, p_summary text, p_levels text[], p_grades int[],
  p_fields text[], p_scope text, p_subjects jsonb, p_units jsonb, p_versions jsonb, p_approval boolean default false)
returns uuid language plpgsql as $$
declare v_cur uuid; v jsonb; n int := 0; v_ver uuid; v_cnt int := jsonb_array_length(p_versions); v_units jsonb; v_status text; v_pub uuid; v_req uuid;
begin
  insert into curricula (owner_org_id, code, name, category, color, summary, issuer, levels, grades, subjects, fields, scope, require_approval)
    values (p_org, p_code, p_name, null, p_color, p_summary, (select name from organizations where id = p_org), p_levels, p_grades,
            coalesce(array(select distinct x->>0 from jsonb_array_elements(p_subjects) x), '{}'), p_fields, p_scope, p_approval)
    returning id into v_cur;
  for v in select * from jsonb_array_elements(p_versions) loop
    n := n + 1; v_status := v->>'status';
    v_units := case when n < v_cnt and jsonb_array_length(p_units) > 1 then p_units - (jsonb_array_length(p_units) - 1) else p_units end;
    perform set_config('app.curriculum_internal', 'on', true);
    insert into curriculum_versions (curriculum_id, org_id, version_no, label, status, change_note, based_on_version_id, created_at)
      values (v_cur, p_org, n, v->>'label', 'draft', v->>'note', v_ver, now() - make_interval(days => (v_cnt - n) * 120 + 10)) returning id into v_ver;
    perform set_config('app.curriculum_internal', 'off', true);
    perform pg_temp.d_fill(v_ver, p_subjects, v_units);
    if v_status in ('pending', 'approved', 'rejected') then
      update curricula set require_approval = true where id = v_cur;
      update curriculum_versions set status = 'pending' where id = v_ver;
      if v_status <> 'pending' then
        select id into v_req from approval_requests where ref_table = 'curriculum_versions' and ref_id = v_ver and status = 'pending';
        insert into approval_actions (request_id, step_no, decision, note) values (v_req, 1, case v_status when 'approved' then 'approve' else 'reject' end, v->>'decision_note');
        update approval_requests set status = v_status, decided_at = now() - interval '1 day' where id = v_req;
        perform set_config('app.approval_engine', 'on', true);
        update curriculum_versions set status = v_status where id = v_ver;
        perform set_config('app.approval_engine', 'off', true);
      end if;
      update curricula set require_approval = p_approval where id = v_cur;
    elsif v_status in ('published', 'superseded') then
      perform set_config('app.curriculum_internal', 'on', true);
      update curriculum_versions set status = v_status, published_at = (v->>'from')::date, effective_from = (v->>'from')::date,
             effective_to = nullif(v->>'to', '')::date, submitted_at = (v->>'from')::date - 7, decided_at = (v->>'from')::date - 3 where id = v_ver;
      perform set_config('app.curriculum_internal', 'off', true);
      if v_status = 'published' then v_pub := v_ver; end if;
    end if;
  end loop;
  perform set_config('app.curriculum_internal', 'on', true);
  update curricula set current_version_id = v_pub where id = v_cur;
  perform set_config('app.curriculum_internal', 'off', true);
  return v_cur;
end $$;

-- Bộ học liệu theo môn / khối của một chương trình: mỗi bài chuẩn → một bài học liệu (bước theo kế hoạch tiết, tệp mẫu)
create or replace function pg_temp.d_set(p_org uuid, p_cur uuid, p_code text, p_name text, p_subject text, p_grade int, p_desc text) returns uuid language plpgsql as $$
declare v_set uuid; v_ver uuid := (select current_version_id from curricula where id = p_cur); l record; v_ml uuid; k int := 0;
begin
  insert into material_sets (owner_org_id, code, name, curriculum_id, version_id, subject, grade, description, status)
    values (p_org, p_code, p_name, p_cur, v_ver, p_subject, p_grade, p_desc, 'published') returning id into v_set;
  for l in select cl.* from curriculum_lessons cl join curriculum_units u on u.id = cl.unit_id
            where cl.version_id = v_ver and u.subject_main = p_subject and u.grade = p_grade order by u.seq, cl.seq loop
    k := k + 1;
    insert into material_lessons (set_id, curriculum_lesson_id, seq, code, title, periods, sessions, objectives, subject_main, product_requirements, steps, criteria)
      values (v_set, l.id, k, l.code, l.title, l.periods, greatest(1, l.periods / 2), l.summary, p_subject,
              'Sản phẩm hoạt động được, đúng yêu cầu của bài; nhóm trình bày được cách làm.',
              (select coalesce(jsonb_agg(jsonb_build_object('session', 1 + (x.o - 1) / 2, 'title', x.v->>'title', 'minutes', (x.v->>'minutes')::int,
                 'teacher', 'Tổ chức, hướng dẫn, làm mẫu thao tác khó', 'student', 'Thảo luận nhóm, thực hiện nhiệm vụ') order by x.o), '[]')
                 from jsonb_array_elements(l.period_plan) with ordinality x(v, o)),
              '[{"name": "Đúng yêu cầu sản phẩm", "levels": ["Chưa đạt", "Đạt một phần", "Đạt", "Đạt, sáng tạo"]},
                {"name": "Hợp tác nhóm", "levels": ["Ít tham gia", "Có tham gia", "Tích cực", "Dẫn dắt nhóm"]}]')
      returning id into v_ml;
    insert into material_files (lesson_id, seq, kind, title, url) values
      (v_ml, 1, 'giao_an', 'Kế hoạch bài dạy – ' || l.title, null),
      (v_ml, 2, 'phieu_hoc_tap', 'Phiếu học tập – ' || l.title, null),
      (v_ml, 3, 'huong_dan', 'Hướng dẫn giáo viên', null);
    insert into material_norms (lesson_id, seq, category, name, spec, unit, qty, basis, consumable) values
      (v_ml, 1, 'vat_tu', 'Giấy bìa cứng', 'Khổ A4', 'tờ', 2, 'per_product', true),
      (v_ml, 2, 'vat_tu', 'Keo dán', 'Lọ 30 ml', 'lọ', 1, 'per_group', true),
      (v_ml, 3, 'dung_cu', 'Kéo', null, 'cái', 2, 'per_group', false);
  end loop;
  return v_set;
end $$;

do $$
declare v_kdi uuid; v_hy uuid; v_ph uuid; v_lqd uuid; v_dtd uuid; v_at uuid; v_kb uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; chy uuid; c2ph uuid; v_ver uuid; v_new uuid;
  p_cb uuid; p_nc uuid; p_th uuid; p_hy uuid; a_ph uuid; a_lqd uuid; a_dtd uuid;
  s_sc1 uuid; s_k6 uuid; s_rb6 uuid; ml uuid; pl uuid; v_gv uuid; v_course uuid; r record;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if; -- dữ liệu mẫu: chỉ chạy khi bật cờ app.seed_demo
  select id into v_kdi from organizations where is_platform limit 1;
  if v_kdi is null or exists (select 1 from curricula where owner_org_id = v_kdi and code = 'CT1') then return; end if;
  select id into v_hy from organizations where code = 'SO-HY';
  select id into v_ph from organizations where code = 'THCS-PH';
  select id into v_lqd from organizations where code = 'THCS-LQD';
  select id into v_dtd from organizations where code = 'TH-DTD';
  select id into v_at from organizations where code = 'THCS-AT';
  select id into v_kb from organizations where code = 'THCS-KB';
  if v_hy is null or v_ph is null then return; end if;

  -- Danh mục riêng
  insert into curriculum_catalog (owner_org_id, kind, code, name, description, color, sort) values
    (v_kdi, 'field', 'iot', 'Internet vạn vật (IoT)', null, null, 7),
    (v_hy, 'field', 'nong_nghiep', 'Nông nghiệp công nghệ cao', 'Lĩnh vực ưu tiên của Hưng Yên', null, 10),
    (v_hy, 'assessment_method', 'trien_lam', 'Triển lãm sản phẩm cấp cụm', null, null, 10),
    (v_ph, 'subject', 'clb_robot', 'CLB Robotics', 'Môn tự chọn của trường', null, 30)
  on conflict do nothing;
  insert into curriculum_catalog_hidden (org_id, item_id)
    select v_ph, id from curriculum_catalog where owner_org_id is null and code in ('mamnon', 'thpt') on conflict do nothing;

  -- ===== Chương trình giáo dục của KDI =====
  c1 := pg_temp.d_prog(v_kdi, 'CT1', 'Tích hợp nội môn', '#64748b', 'STEM lồng ghép trong tiết Toán, Khoa học: đo lường, dữ liệu, vật liệu, năng lượng.',
    '{tieuhoc}', '{4,5}', '{stem}', 'public',
    '[["toan", 4, 8, 1, true], ["khoa_hoc", 4, 8, 1, true], ["toan", 5, 5, 1, true], ["khoa_hoc", 5, 8, 1, true]]',
    '[{"t": "Đo lường quanh em", "g": 4, "s": "toan", "i": ["khoa_hoc"], "d": "Đơn vị đo, ước lượng và đo thực tế.",
       "l": [["Thước đo tự chế", 2, "Sử dụng được đơn vị đo độ dài, ước lượng và đo chính xác đến cm."], ["Cân thăng bằng", 2, "So sánh được khối lượng bằng cân đòn tự làm."]],
       "o": [["nang_luc", "toan", "Vận dụng đo lường để giải quyết tình huống thực tế.", "toan_hoc"]]},
      {"t": "Hình học trong kiến trúc", "g": 4, "s": "toan", "i": ["mi_thuat"], "d": "Hình khối, đối xứng, độ bền kết cấu.",
       "l": [["Cầu giấy chịu lực", 2, "Nhận biết được hình tam giác giúp kết cấu vững."], ["Nhà mô hình từ khối hộp", 2, "Vẽ được hình khai triển của khối hộp chữ nhật."]],
       "o": [["ky_nang", "toan", "Nhận dạng và vẽ được các hình cơ bản.", "toan_hoc"]]},
      {"t": "Vật liệu và tính chất", "g": 4, "s": "khoa_hoc", "i": ["mi_thuat"], "d": "Tính thấm nước, dẫn nhiệt của vật liệu.",
       "l": [["Chiếc ô chống thấm", 2, "Nêu được vật liệu thấm và không thấm nước."], ["Cốc giữ nhiệt", 2, "So sánh được khả năng dẫn nhiệt của các vật liệu."]],
       "o": [["nang_luc", "khoa_hoc", "Tìm hiểu tự nhiên qua thí nghiệm đơn giản.", "khoa_hoc"]]},
      {"t": "Nước và sự sống", "g": 4, "s": "khoa_hoc", "i": [], "d": "Vòng tuần hoàn, làm sạch nước.",
       "l": [["Máy lọc nước mini", 2, "Mô tả được cách làm sạch nước đơn giản."], ["Vòng tuần hoàn của nước", 2, "Vẽ được sơ đồ vòng tuần hoàn của nước."]],
       "o": [["pham_chat", null, "Có ý thức tiết kiệm và bảo vệ nguồn nước.", ""]]},
      {"t": "Biểu đồ dữ liệu lớp em", "g": 5, "s": "toan", "i": ["tin_hoc"], "d": "Thu thập, biểu diễn dữ liệu.",
       "l": [["Khảo sát món ăn yêu thích", 1, "Thu thập và ghi lại được dữ liệu bằng bảng kiểm."], ["Biểu đồ cột bằng giấy màu", 2, "Biểu diễn được dữ liệu bằng biểu đồ cột."]],
       "o": [["ky_nang", "toan", "Đọc và nhận xét được biểu đồ đơn giản.", "toan_hoc"]]},
      {"t": "Năng lượng mặt trời", "g": 5, "s": "khoa_hoc", "i": ["cong_nghe"], "d": "Năng lượng sạch và ứng dụng.",
       "l": [["Lò sấy năng lượng mặt trời", 2, "Giải thích được vì sao màu tối hấp thụ nhiệt tốt."], ["Xe năng lượng mặt trời", 2, "Lắp được mạch pin mặt trời – động cơ đơn giản."]],
       "o": [["pham_chat", null, "Có ý thức tiết kiệm năng lượng, bảo vệ môi trường.", ""]]},
      {"t": "Mạch điện đơn giản", "g": 5, "s": "khoa_hoc", "i": ["cong_nghe"], "d": "Mạch kín, công tắc, vật dẫn điện.",
       "l": [["Đèn pin tự chế", 2, "Lắp được mạch điện kín gồm pin, công tắc, bóng đèn."], ["Chuông báo khách", 2, "Giải thích được vai trò của công tắc trong mạch."]],
       "o": [["nang_luc", "khoa_hoc", "An toàn khi sử dụng điện.", "khoa_hoc"]]}]',
    '[{"label": "2025–2026", "status": "superseded", "note": "Bản đầu tiên", "from": "2025-08-20", "to": "2026-08-14"},
      {"label": "2026–2027", "status": "published", "note": "Thêm chủ đề Mạch điện đơn giản; cập nhật tiêu chí sản phẩm", "from": "2026-08-15"}]');

  c2 := pg_temp.d_prog(v_kdi, 'CT2', 'Liên môn', '#2e95f2', 'Chủ đề STEM liên môn Vật lí – Hoá học – Sinh học – Công nghệ cho THCS.',
    '{thcs}', '{6,7,8,9}', '{stem,sang_tao}', 'public',
    '[["khtn", 6, 14, 2, true], ["khtn", 7, 9, 1, true], ["khtn", 8, 5, 1, true], ["cong_nghe", 8, 4, 1, false], ["khtn", 9, 5, 1, true]]',
    '[{"t": "Lọc nước sạch", "g": 6, "s": "khtn", "i": ["cong_nghe"], "d": "Hỗn hợp, tách chất, xử lý nước.",
       "l": [["Bình lọc nước nhiều lớp", 2, "Giải thích được vai trò của từng lớp vật liệu lọc."], ["Kiểm tra độ trong của nước", 2, "Đo và so sánh được độ đục trước và sau lọc."]],
       "o": [["nang_luc", "khtn", "Vận dụng kiến thức tách chất để giải quyết vấn đề nước sạch.", "khoa_hoc"]]},
      {"t": "Tế bào và kính hiển vi", "g": 6, "s": "khtn", "i": ["toan"], "d": "Quan sát tế bào, phóng đại.",
       "l": [["Kính lúp từ giọt nước", 2, "Giải thích được nguyên lý phóng đại của thấu kính."], ["Quan sát tế bào vảy hành", 2, "Làm được tiêu bản và vẽ được tế bào quan sát."]],
       "o": [["ky_nang", "khtn", "Sử dụng được kính hiển vi quang học.", "khoa_hoc"]]},
      {"t": "Đo nhiệt độ", "g": 6, "s": "khtn", "i": ["toan"], "d": "Thang nhiệt độ, sự nở vì nhiệt.",
       "l": [["Nhiệt kế chất lỏng tự chế", 3, "Chế tạo và chia vạch được nhiệt kế đơn giản."], ["Biểu đồ nhiệt độ một ngày", 3, "Ghi và vẽ được đồ thị nhiệt độ theo giờ."]],
       "o": [["nang_luc", "toan", "Xử lý số liệu đo được.", "toan_hoc"]]},
      {"t": "Nhà ở tiết kiệm năng lượng", "g": 7, "s": "khtn", "i": ["toan", "cong_nghe"], "d": "Truyền nhiệt, cách nhiệt, chiếu sáng.",
       "l": [["Mô hình nhà cách nhiệt", 3, "Giải thích được ba hình thức truyền nhiệt."], ["Đèn LED tiết kiệm điện", 2, "Tính được điện năng tiêu thụ của thiết bị."]],
       "o": [["nang_luc", "cong_nghe", "Thiết kế giải pháp kỹ thuật đơn giản cho ngôi nhà.", "cong_nghe"]]},
      {"t": "Âm thanh quanh ta", "g": 7, "s": "khtn", "i": ["am_nhac"], "d": "Dao động, tần số, độ cao của âm.",
       "l": [["Đàn ống nước", 2, "Giải thích được độ cao của âm phụ thuộc tần số."], ["Điện thoại dây", 2, "Nêu được âm truyền qua chất rắn."]],
       "o": [["ky_nang", "khtn", "Thiết kế thí nghiệm về âm thanh.", "khoa_hoc"]]},
      {"t": "Phân loại rác thông minh", "g": 8, "s": "cong_nghe", "i": ["khtn", "tin_hoc"], "d": "Phân loại, tái chế; cảm biến cơ bản.",
       "l": [["Thùng rác phân loại", 2, "Phân loại được rác hữu cơ, tái chế, nguy hại."], ["Phân compost mini", 2, "Mô tả được quá trình phân huỷ hữu cơ."]],
       "o": [["pham_chat", null, "Có trách nhiệm với môi trường sống của cộng đồng.", ""]]},
      {"t": "Áp suất", "g": 8, "s": "khtn", "i": ["toan"], "d": "Áp suất chất lỏng, chất khí.",
       "l": [["Tên lửa nước", 3, "Giải thích được chuyển động của tên lửa nước."], ["Bình thông nhau", 2, "Nêu được nguyên lý bình thông nhau."]],
       "o": [["nang_luc", "khtn", "Vận dụng áp suất giải thích hiện tượng thực tế.", "khoa_hoc"]]},
      {"t": "Điện gió quy mô nhỏ", "g": 9, "s": "khtn", "i": ["toan", "cong_nghe"], "d": "Cảm ứng điện từ, máy phát điện.",
       "l": [["Tua-bin gió mini", 3, "Giải thích được nguyên lý máy phát điện xoay chiều."], ["Đo công suất tua-bin", 2, "Đo và vẽ được đồ thị công suất theo tốc độ gió."]],
       "o": [["nang_luc", "toan", "Xử lý số liệu thực nghiệm, rút ra kết luận.", "toan_hoc"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Bản đầu tiên", "from": "2026-08-15"}]');

  c3 := pg_temp.d_prog(v_kdi, 'CT3', 'Đổi mới sáng tạo', '#7c3aed', 'Thiết kế – chế tạo sản phẩm từ vật liệu sẵn có (Sáng chế tiểu học) và tư duy thiết kế, khởi nghiệp (THCS).',
    '{tieuhoc,thcs}', '{1,2,3,8,9}', '{sang_tao,stem}', 'public',
    '[["sang_che", 1, 8, 1, true], ["sang_che", 2, 4, 1, true], ["sang_che", 3, 4, 1, true], ["hdtn", 8, 3, 1, false], ["hdtn", 9, 4, 1, false]]',
    '[{"t": "An toàn giao thông", "g": 1, "s": "sang_che", "i": ["toan", "tnxh", "mi_thuat"], "d": "Đèn hiệu, vị trí trong không gian, mô hình giao thông.",
       "l": [["Cột đèn giao thông xoay", 2, "Nêu tên và ý nghĩa của đèn hiệu; xác định vị trí trên – dưới, phải – trái; chế tạo được cột đèn."], ["Mô hình ngã tư an toàn", 2, "Kể được tình huống nguy hiểm và cách đi đường an toàn."]],
       "o": [["pham_chat", null, "Có trách nhiệm với công việc được giao ở lớp; chia sẻ, trình diễn và cải tiến sản phẩm.", ""]]},
      {"t": "Đồ chơi từ giấy", "g": 1, "s": "sang_che", "i": ["mi_thuat"], "d": "Gấp, cắt, dán, chuyển động quay.",
       "l": [["Chong chóng giấy", 2, "Làm được chong chóng quay khi có gió."], ["Con quay giấy", 2, "So sánh được thời gian quay của các con quay."]],
       "o": [["ky_nang", "mi_thuat", "Sử dụng công cụ an toàn, phù hợp vật liệu.", ""]]},
      {"t": "Đồ chơi chuyển động", "g": 2, "s": "sang_che", "i": ["toan", "mi_thuat"], "d": "Đòn bẩy, trục quay.",
       "l": [["Xe đẩy bằng dây chun", 2, "Giải thích được dây chun tích năng lượng."], ["Con lật đật", 2, "Nêu được vì sao con lật đật không đổ."]],
       "o": [["nang_luc", null, "Giải quyết vấn đề và sáng tạo.", "gqvd"]]},
      {"t": "Ngôi nhà thông minh", "g": 3, "s": "sang_che", "i": ["tnxh"], "d": "Tiện ích trong nhà từ vật liệu tái chế.",
       "l": [["Cửa tự đóng", 2, "Chế tạo được cửa tự đóng bằng dây chun."], ["Hộp bút xoay", 2, "Thiết kế được hộp bút xoay từ lõi giấy."]],
       "o": [["nang_luc", null, "Hợp tác nhóm hoàn thành sản phẩm.", "giao_tiep"]]},
      {"t": "Tư duy thiết kế", "g": 8, "s": "hdtn", "i": ["cong_nghe"], "r": "classroom", "d": "Thấu cảm, xác định vấn đề, ý tưởng.",
       "l": [["Phỏng vấn người dùng", 1, "Thu thập được nhu cầu người dùng qua phỏng vấn."], ["Bão não ý tưởng", 2, "Đề xuất và chọn được ý tưởng khả thi."]],
       "o": [["nang_luc", null, "Giải quyết vấn đề và sáng tạo.", "gqvd"]]},
      {"t": "Nguyên mẫu và gọi vốn", "g": 9, "s": "hdtn", "i": ["toan"], "d": "Nguyên mẫu, chi phí, thuyết trình gọi vốn.",
       "l": [["Làm nguyên mẫu", 2, "Chế tạo được nguyên mẫu thử nghiệm với người dùng."], ["Thuyết trình gọi vốn", 2, "Trình bày được giá trị sản phẩm và chi phí."]],
       "o": [["nang_luc", "toan", "Tính toán chi phí, lợi nhuận đơn giản.", "toan_hoc"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Bản đầu tiên", "from": "2026-08-15"}]');

  c4 := pg_temp.d_prog(v_kdi, 'CT4', 'Robotics / AI', '#dc2626', 'Lập trình khối với micro:bit, cảm biến, robot (THCS) và trí tuệ nhân tạo (THPT).',
    '{thcs,thpt}', '{6,7,8,10,11}', '{robotics,lap_trinh,ai,iot}', 'public',
    '[["robotics", 6, 5, 1, true], ["robotics", 7, 4, 1, true], ["robotics", 8, 6, 1, true], ["ai", 10, 8, 1, false], ["ai", 11, 3, 1, false]]',
    '[{"t": "Làm quen micro:bit", "g": 6, "s": "robotics", "i": ["tin_hoc"], "d": "Màn LED, nút bấm, vòng lặp, điều kiện.",
       "l": [["Bảng tên LED", 1, "Lập trình được hiển thị chữ và hình trên màn LED."], ["Xúc xắc điện tử", 2, "Sử dụng được biến và số ngẫu nhiên."], ["Trò chơi phản xạ", 2, "Dùng được câu lệnh điều kiện với nút bấm."]],
       "o": [["nang_luc", "tin_hoc", "Biểu diễn thuật toán bằng chương trình khối.", "tin_hoc"]]},
      {"t": "Cảm biến quanh ta", "g": 7, "s": "robotics", "i": ["khtn"], "d": "Cảm biến ánh sáng, nhiệt độ, gia tốc.",
       "l": [["Đèn ngủ tự động", 2, "Đọc được giá trị cảm biến ánh sáng và điều khiển LED."], ["Nhiệt kế cảnh báo", 2, "Đặt được ngưỡng cảnh báo theo dữ liệu nhiệt độ."]],
       "o": [["ky_nang", "khtn", "Thu thập dữ liệu môi trường bằng cảm biến.", "khoa_hoc"]]},
      {"t": "Robot di chuyển", "g": 8, "s": "robotics", "i": ["cong_nghe", "toan"], "d": "Động cơ, bánh xe, dò line.",
       "l": [["Lắp ráp xe robot", 2, "Lắp được khung xe, động cơ và mạch điều khiển."], ["Robot dò line", 2, "Lập trình được robot đi theo vạch đen."], ["Robot tránh vật cản", 2, "Sử dụng được cảm biến siêu âm để tránh vật cản."]],
       "o": [["nang_luc", "cong_nghe", "Thiết kế, chế tạo và cải tiến sản phẩm kỹ thuật.", "cong_nghe"]]},
      {"t": "Nhận dạng hình ảnh", "g": 10, "s": "ai", "i": ["toan"], "r": "classroom", "d": "Dữ liệu huấn luyện, mô hình phân loại, đạo đức AI.",
       "l": [["AI trong đời sống", 1, "Kể được ứng dụng AI và rủi ro khi sử dụng."], ["Thu thập bộ ảnh", 2, "Chuẩn bị được bộ dữ liệu ảnh có nhãn."], ["Huấn luyện mô hình phân loại", 3, "Huấn luyện và đánh giá được độ chính xác mô hình."], ["Tranh biện: AI và việc làm", 2, "Lập luận được quan điểm về tác động của AI."]],
       "o": [["pham_chat", null, "Sử dụng AI trung thực, có trách nhiệm.", ""]]},
      {"t": "Chatbot hỏi đáp", "g": 11, "s": "ai", "i": ["ngu_van"], "r": "classroom", "d": "Xử lý ngôn ngữ tự nhiên cơ bản.",
       "l": [["Chatbot hỏi đáp nội quy trường", 3, "Xây dựng được chatbot trả lời câu hỏi theo kịch bản."]],
       "o": [["nang_luc", "tin_hoc", "Giải quyết vấn đề bằng công cụ AI.", "tin_hoc"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Bản đầu tiên", "from": "2026-08-15"},
      {"label": "2026–2027 · bổ sung", "status": "pending", "note": "Bổ sung chủ đề Chatbot hỏi đáp cho lớp 11"}]', true);

  c5 := pg_temp.d_prog(v_kdi, 'CT5', 'Nghiên cứu khoa học', '#16a34a', 'Quy trình nghiên cứu khoa học, đề cương, thực nghiệm, báo cáo theo hướng dẫn cuộc thi KHKT.',
    '{thcs,thpt}', '{8,9,10}', '{khkt}', 'public',
    '[["khkt", 8, 3, 1, false], ["khkt", 9, 4, 1, false], ["khkt", 10, 4, 1, false]]',
    '[{"t": "Đặt câu hỏi nghiên cứu", "g": 8, "s": "khkt", "i": ["ngu_van"], "r": "classroom", "d": "Quan sát, xác định vấn đề, giả thuyết.",
       "l": [["Từ quan sát đến câu hỏi", 1, "Đặt được câu hỏi nghiên cứu từ hiện tượng thực tế."], ["Viết giả thuyết", 2, "Phát biểu được giả thuyết có thể kiểm chứng."]],
       "o": [["nang_luc", "khtn", "Tìm hiểu tự nhiên theo phương pháp khoa học.", "khoa_hoc"]]},
      {"t": "Thiết kế thực nghiệm", "g": 9, "s": "khkt", "i": ["toan"], "r": "lab", "d": "Biến số, nhóm đối chứng, sai số.",
       "l": [["Biến độc lập và phụ thuộc", 2, "Xác định được các biến trong thí nghiệm."], ["Ghi chép và xử lý số liệu", 2, "Tính được trung bình, sai số và vẽ đồ thị."]],
       "o": [["ky_nang", "toan", "Xử lý và trình bày số liệu thực nghiệm.", "toan_hoc"]]},
      {"t": "Báo cáo và trình bày", "g": 10, "s": "khkt", "i": ["tin_hoc"], "r": "classroom", "d": "Báo cáo, poster, trả lời ban giám khảo.",
       "l": [["Viết báo cáo KHKT", 2, "Viết được báo cáo đúng cấu trúc hướng dẫn."], ["Poster và thuyết trình", 2, "Trình bày được dự án trong 5 phút, trả lời câu hỏi."]],
       "o": [["nang_luc", null, "Giao tiếp và hợp tác trong nhóm nghiên cứu.", "giao_tiep"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Theo hướng dẫn cuộc thi KHKT năm học hiện hành", "from": "2026-09-01"}]');

  -- CT6: ví dụ mở rộng — thêm chương trình mới chỉ là thêm dữ liệu
  c6 := pg_temp.d_prog(v_kdi, 'CT6', 'Câu lạc bộ STEM', '#0891b2', 'Hoạt động ngoài giờ chuẩn bị thi Robotics, KHKT; ví dụ chương trình mở rộng ngoài CT1–CT5.',
    '{thcs}', '{7,8,9}', '{robotics}', 'public',
    '[["robotics", 8, 6, 2, false]]',
    '[{"t": "Robot thi đấu", "g": 8, "s": "robotics", "i": ["tin_hoc", "cong_nghe"], "d": "Luật thi, chiến thuật, tối ưu robot.",
       "l": [["Luật thi Robotics", 2, "Nêu được luật thi và tiêu chí chấm điểm."], ["Tối ưu tốc độ dò line", 2, "Điều chỉnh được thông số để robot chạy ổn định."], ["Thi đấu thử", 2, "Phối hợp được trong đội thi."]],
       "o": [["nang_luc", null, "Hợp tác và giao tiếp trong đội thi.", "giao_tiep"]]}]',
    '[{"label": "Dự thảo", "status": "draft", "note": "Đang biên soạn"}]');

  -- ===== Sở Hưng Yên: chương trình địa phương =====
  chy := pg_temp.d_prog(v_hy, 'HY1', 'STEM địa phương: Nông nghiệp thông minh', '#ca8a04', 'Chủ đề gắn với cây nhãn, rau an toàn và tưới tiêu tiết kiệm của Hưng Yên.',
    '{thcs}', '{7,8,9}', '{stem,nong_nghiep,iot}', 'children',
    '[["cong_nghe", 7, 4, 1, true], ["tin_hoc", 8, 5, 1, true], ["khtn", 9, 4, 1, true]]',
    '[{"t": "Vườn rau an toàn", "g": 7, "s": "cong_nghe", "i": ["khtn"], "r": "outdoor", "d": "Đất, giá thể, chăm sóc rau.",
       "l": [["Giá thể trồng rau", 2, "So sánh được độ ẩm và độ tơi của các loại giá thể."], ["Nhật ký sinh trưởng", 2, "Ghi chép và biểu diễn được sự sinh trưởng của cây."]],
       "o": [["nang_luc", "cong_nghe", "Vận dụng kỹ thuật trồng trọt vào thực tế gia đình.", "cong_nghe"]]},
      {"t": "Tưới cây tự động", "g": 8, "s": "tin_hoc", "i": ["cong_nghe", "khtn"], "d": "Cảm biến độ ẩm đất, máy bơm mini.",
       "l": [["Đo độ ẩm đất", 2, "Đọc được giá trị cảm biến độ ẩm và hiệu chuẩn."], ["Hệ thống tưới tự động", 3, "Lập trình được bơm tự bật khi đất khô."]],
       "o": [["nang_luc", "tin_hoc", "Ứng dụng IoT giải quyết vấn đề nông nghiệp.", "tin_hoc"]]},
      {"t": "Bảo quản nhãn lồng Hưng Yên", "g": 9, "s": "khtn", "i": ["cong_nghe", "ls_dl"], "d": "Hô hấp tế bào, sấy, bảo quản lạnh.",
       "l": [["Vì sao quả nhanh hỏng?", 2, "Giải thích được ảnh hưởng của nhiệt độ đến bảo quản."], ["Máy sấy nhãn mini", 2, "Thiết kế được buồng sấy có kiểm soát nhiệt độ."]],
       "o": [["pham_chat", null, "Yêu quê hương, quý trọng sản vật địa phương.", ""]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Sở ban hành theo kế hoạch STEM năm học", "from": "2026-09-05"}]');

  -- ===== THCS Phố Hiến kế thừa CT2 và điều chỉnh =====
  insert into curricula (owner_org_id, code, name, color, summary, issuer, levels, grades, subjects, fields, scope, require_approval, source_curriculum_id, source_version_id)
    select v_ph, 'CT2-PH', 'Liên môn – THCS Phố Hiến', color, 'Kế thừa CT2 của KDI, rút gọn chủ đề lớp 7 theo kế hoạch giáo dục nhà trường.',
           (select name from organizations where id = v_ph), levels, grades, subjects, fields, 'own', false, id, current_version_id
      from curricula where id = c2 returning id into c2ph;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, label, status, change_note, published_at, effective_from)
    values (c2ph, v_ph, 1, '2026–2027', 'draft', 'Kế thừa từ CT2 · KDI', now(), date '2026-09-05') returning id into v_new;
  perform public.curriculum_copy_content((select current_version_id from curricula where id = c2), v_new);
  update curriculum_units set periods = 3, summary = 'Rút gọn còn 3 tiết do trùng lịch kiểm tra.' where version_id = v_new and title = 'Nhà ở tiết kiệm năng lượng';
  update curriculum_versions set status = 'published' where id = v_new;
  update curricula set current_version_id = v_new where id = c2ph;
  perform set_config('app.curriculum_internal', 'off', true);

  -- ===== Gói chương trình =====
  insert into program_packages (owner_org_id, code, name, tier, description, conditions, status, created_by)
    values (v_kdi, 'GOI-CB-THCS', 'Gói Cơ bản THCS', 'co_ban', 'Hai chương trình, ít môn học: Liên môn KHTN lớp 6–7 và Robotics lớp 6.',
            'Có phòng học bộ môn hoặc phòng STEM tối thiểu; 1 GV đã tập huấn STEM.', 'active', null) returning id into p_cb;
  insert into program_package_items (package_id, seq, curriculum_id, subject, grades) values
    (p_cb, 1, c2, 'khtn', '{6,7}'), (p_cb, 2, c4, 'robotics', '{6}');
  insert into program_packages (owner_org_id, code, name, tier, description, conditions, status, based_on_id, created_by)
    values (v_kdi, 'GOI-NC-THCS', 'Gói Nâng cao THCS', 'nang_cao', 'Bổ sung môn, chương trình và thời lượng so với gói Cơ bản: KHTN 6–9, Công nghệ 8, Robotics 6–8, KHKT 8–9.',
            'Phòng STEM nâng cao; bộ thiết bị Robotics; ≥ 2 GV đã tập huấn.', 'active', p_cb, null) returning id into p_nc;
  insert into program_package_items (package_id, seq, curriculum_id, subject, grades, periods_total, notes) values
    (p_nc, 1, c2, 'khtn', '{6,7,8,9}', null, null), (p_nc, 2, c2, 'cong_nghe', '{8}', null, null),
    (p_nc, 3, c4, 'robotics', '{6,7,8}', 18, 'Tăng thời lượng so với quy định để luyện thi'), (p_nc, 4, c5, 'khkt', '{8,9}', null, null);
  insert into program_packages (owner_org_id, code, name, tier, description, status, created_by)
    values (v_kdi, 'GOI-CB-TH', 'Gói Cơ bản Tiểu học', 'co_ban', 'Tích hợp nội môn Toán – Khoa học lớp 4–5 và Sáng chế lớp 1–3.', 'active', null) returning id into p_th;
  insert into program_package_items (package_id, seq, curriculum_id, subject, grades) values
    (p_th, 1, c1, null, '{4,5}'), (p_th, 2, c3, 'sang_che', '{1,2,3}');
  insert into program_packages (owner_org_id, code, name, tier, description, status, created_by)
    values (v_hy, 'GOI-HY-2627', 'Gói STEM Hưng Yên 2026–2027', 'rieng', 'Chương trình địa phương + Liên môn của KDI cho trường THCS trong tỉnh.', 'proposed', null) returning id into p_hy;
  insert into program_package_items (package_id, seq, curriculum_id, subject, grades) values
    (p_hy, 1, chy, null, '{7,8,9}'), (p_hy, 2, c2, 'khtn', '{6,7}');
  -- Áp dụng cho trường
  insert into program_package_schools (package_id, org_id, school_year, grades, status, starts_on, ends_on)
    values (p_nc, v_ph, '2026-2027', '{6,7,8,9}', 'active', '2026-09-05', '2027-05-31') returning id into a_ph;
  if v_lqd is not null then
    insert into program_package_schools (package_id, org_id, school_year, grades, status, starts_on, ends_on)
      values (p_cb, v_lqd, '2026-2027', '{6,7}', 'active', '2026-09-05', '2027-05-31') returning id into a_lqd;
  end if;
  if v_dtd is not null then
    insert into program_package_schools (package_id, org_id, school_year, grades, status, starts_on, ends_on)
      values (p_th, v_dtd, '2026-2027', '{1,2,3,4,5}', 'active', '2026-09-05', '2027-05-31') returning id into a_dtd;
  end if;
  if v_at is not null then
    insert into program_package_schools (package_id, org_id, school_year, grades, status, note)
      values (p_cb, v_at, '2026-2027', '{6}', 'proposed', 'Trường đề xuất, chờ Sở xem xét');
  end if;
  if v_kb is not null then
    insert into program_package_schools (package_id, org_id, school_year, grades, status, starts_on, ends_on)
      values (p_nc, v_kb, '2026-2027', '{6,7,8}', 'active', '2026-09-05', '2027-05-31');
  end if;

  -- ===== Học liệu =====
  s_sc1 := pg_temp.d_set(v_kdi, c3, 'HL-SC1', 'Bộ học liệu Sáng chế lớp 1', 'sang_che', 1, 'Bài học, phiếu học tập, video và định mức vật tư cho chương trình Sáng chế lớp 1.');
  s_k6 := pg_temp.d_set(v_kdi, c2, 'HL-KHTN6', 'Bộ học liệu Liên môn KHTN 6', 'khtn', 6, 'Dùng cho cả gói Cơ bản và Nâng cao.');
  s_rb6 := pg_temp.d_set(v_kdi, c4, 'HL-RB6', 'Bộ học liệu Robotics 6 (micro:bit)', 'robotics', 6, 'Kèm danh mục thiết bị dùng chung theo nhóm.');
  perform pg_temp.d_set(v_kdi, c4, 'HL-RB8', 'Bộ học liệu Robotics 8', 'robotics', 8, null);
  perform pg_temp.d_set(v_kdi, c1, 'HL-KH5', 'Bộ học liệu Khoa học 5', 'khoa_hoc', 5, null);
  update material_sets set status = 'review' where code = 'HL-RB8' and owner_org_id = v_kdi;
  -- Bài mẫu đầy đủ: "Cột đèn giao thông xoay" (2 buổi, hoạt động, bảng vật tư theo KHBD mẫu)
  select id into ml from material_lessons where set_id = s_sc1 and title = 'Cột đèn giao thông xoay';
  update material_lessons set sessions = 2,
    objectives = 'Nêu tên và ý nghĩa của đèn hiệu giao thông; kể được tình huống nguy hiểm khi tham gia giao thông; xác định được vị trí trên – dưới, phải – trái, trước – sau, ở giữa; chế tạo được cột đèn giao thông.',
    subjects_integrated = '{toan,tnxh,mi_thuat}',
    product_requirements = 'Có ba đèn ứng với 3 màu đỏ, vàng, xanh; mỗi đèn 2 mặt (sáng / tắt); xếp đúng vị trí đỏ – vàng – xanh; đèn xoay được quanh trụ.',
    steps = '[{"session": 1, "title": "Xác định vấn đề — trò chơi “Đây là gì nhỉ?”, tình trạng ùn tắc giao thông", "minutes": 5, "teacher": "Tổ chức trò chơi, đặt câu hỏi dẫn dắt", "student": "Quan sát hình, nêu tên vật"},
              {"session": 1, "title": "Nghiên cứu kiến thức nền — màu sắc, ý nghĩa, vị trí các đèn", "minutes": 15, "teacher": "Giao nhiệm vụ 1–3, đúc kết vị trí ngang / dọc", "student": "Điền tên đèn, nối tín hiệu, nêu tình huống nguy hiểm"},
              {"session": 1, "title": "Đề xuất giải pháp, chế tạo mẫu", "minutes": 13, "teacher": "Nhắc yêu cầu sản phẩm, phát vật tư, làm mẫu thao tác khó", "student": "Thảo luận, bắt đầu chế tạo"},
              {"session": 1, "title": "Tổng kết", "minutes": 2, "teacher": "Đặt câu hỏi tổng kết", "student": "Trả lời, lên kế hoạch nhóm"},
              {"session": 2, "title": "Ôn tập", "minutes": 5, "teacher": "Hỏi ôn kiến thức buổi 1", "student": "Trả lời câu hỏi"},
              {"session": 2, "title": "Hoàn thiện sản phẩm, thử nghiệm", "minutes": 15, "teacher": "Quan sát, hỗ trợ nhóm", "student": "Hoàn thiện, thử xoay đèn"},
              {"session": 2, "title": "Chia sẻ, thảo luận và điều chỉnh", "minutes": 13, "teacher": "Hướng dẫn thuyết trình 3 phần, tổ chức đánh giá chéo", "student": "Thuyết trình, tick tiêu chí ở phiếu học tập"},
              {"session": 2, "title": "Tổng kết", "minutes": 2, "teacher": "Nhận xét sản phẩm", "student": "Chia sẻ khó khăn, ý tưởng cải tiến"}]',
    criteria = '[{"name": "Đủ 3 đèn đúng màu và vị trí", "levels": ["Thiếu đèn hoặc sai vị trí", "Đủ đèn, sai 1 vị trí", "Đủ đèn, đúng vị trí", "Đủ, đúng, trang trí sáng tạo"]},
                 {"name": "Đèn xoay được quanh trụ", "levels": ["Không xoay", "Xoay khó", "Xoay được", "Xoay trơn, bền"]},
                 {"name": "Thuyết trình sản phẩm", "levels": ["Chưa trình bày", "Trình bày một phần", "Đủ 3 phần", "Tự tin, trả lời câu hỏi"]}]'
   where id = ml;
  delete from material_norms where lesson_id = ml;
  insert into material_norms (lesson_id, seq, category, name, spec, unit, qty, basis, consumable, substitute) values
    (ml, 1, 'vat_tu', 'Giấy carton', '1/8 tấm lớn, 20 cm × 10 cm', 'miếng', 1, 'per_product', true, 'Bìa hộp giấy tái chế'),
    (ml, 2, 'vat_tu', 'Que nhọn / que xiên tre', 'Dài 20 cm', 'cái', 1, 'per_product', true, 'Ống hút cứng'),
    (ml, 3, 'vat_tu', 'Giấy trắng cứng', 'Khổ A4', 'tờ', 1, 'per_product', true, null),
    (ml, 4, 'vat_tu', 'Băng keo 2 mặt xốp', 'Bản 2,5 cm', 'cm', 10, 'per_product', true, 'Keo nến'),
    (ml, 5, 'dung_cu', 'Kéo', null, 'cái', 4, 'per_group', false, null),
    (ml, 6, 'dung_cu', 'Màu', null, 'bộ', 1, 'per_group', false, null);
  delete from material_files where lesson_id = ml;
  insert into material_files (lesson_id, seq, kind, title, url) values
    (ml, 1, 'giao_an', 'KHBD Cột đèn giao thông xoay (2 tiết)', null),
    (ml, 2, 'phieu_hoc_tap', 'Phiếu học tập: điền tên đèn, nối tín hiệu, tiêu chí đánh giá chéo', null),
    (ml, 3, 'hinh_anh', 'Ảnh sản phẩm gợi ý', null),
    (ml, 4, 'video', 'Lịch sử đèn giao thông (London 1868)', 'https://www.youtube.com/results?search_query=traffic+light+history'),
    (ml, 5, 'huong_dan', 'Hướng dẫn kỹ thuật thuyết trình 3 phần', null);
  -- Robotics: thiết bị dùng chung theo nhóm
  update material_norms set category = 'thiet_bi', name = 'Bộ micro:bit V2', spec = 'Kèm cáp USB, hộp pin', unit = 'bộ', qty = 1, basis = 'per_group', consumable = false
   where lesson_id in (select id from material_lessons where set_id = s_rb6) and seq = 1;
  update material_norms set name = 'Pin AAA', spec = null, unit = 'viên', qty = 2, basis = 'per_group'
   where lesson_id in (select id from material_lessons where set_id = s_rb6) and seq = 2;
  -- KHTN 6: bình lọc nước
  select id into ml from material_lessons where set_id = s_k6 and title = 'Bình lọc nước nhiều lớp';
  delete from material_norms where lesson_id = ml;
  insert into material_norms (lesson_id, seq, category, name, spec, unit, qty, basis, consumable) values
    (ml, 1, 'vat_tu', 'Chai nhựa', '1,5 lít', 'chai', 1, 'per_product', true),
    (ml, 2, 'vat_tu', 'Cát mịn', null, 'kg', 0.5, 'per_product', true),
    (ml, 3, 'vat_tu', 'Sỏi nhỏ', null, 'kg', 0.5, 'per_product', true),
    (ml, 4, 'vat_tu', 'Than hoạt tính', null, 'g', 100, 'per_product', true),
    (ml, 5, 'vat_tu', 'Bông gòn', null, 'g', 20, 'per_product', true),
    (ml, 6, 'dung_cu', 'Dao rọc giấy', null, 'cái', 1, 'per_group', false),
    (ml, 7, 'thiet_bi', 'Máy đo độ đục', null, 'cái', 1, 'per_class', false);

  -- ===== Phân phối chương trình =====
  -- Trường A (THCS Phố Hiến): KHTN 6 — 2 tiết/tuần; Robotics 6 — 1 tiết/tuần. Trường B (THCS Lê Quý Đôn): KHTN 6 — 1 tiết/tuần, cùng bộ học liệu.
  select id into v_gv from teachers where org_id = v_ph order by full_name limit 1;
  insert into ppct_plans (org_id, package_school_id, curriculum_id, material_set_id, title, subject, grade, class_ids, school_year, start_date, periods_per_week, status, notes)
    values (v_ph, a_ph, c2, s_k6, 'KHTN 6 – Liên môn (2 tiết/tuần)', 'khtn', 6,
            coalesce(array(select id from classes where org_id = v_ph and grade = 6 order by name), '{}'), '2026-2027', '2026-09-07', 2, 'published',
            'Dạy vào tiết 4–5 thứ Năm tại phòng STEM') returning id into pl;
  perform public.ppct_build(pl);
  update ppct_items set teacher_id = v_gv, room_kind = 'stem' where plan_id = pl;
  insert into ppct_plans (org_id, package_school_id, curriculum_id, material_set_id, title, subject, grade, class_ids, school_year, start_date, periods_per_week, status)
    values (v_ph, a_ph, c4, s_rb6, 'Robotics 6 (1 tiết/tuần)', 'robotics', 6,
            coalesce(array(select id from classes where org_id = v_ph and grade = 6 order by name limit 2), '{}'), '2026-2027', '2026-09-07', 1, 'published');
  perform public.ppct_build((select id from ppct_plans where org_id = v_ph and subject = 'robotics'));
  insert into ppct_plans (org_id, package_school_id, curriculum_id, material_set_id, title, subject, grade, class_ids, school_year, start_date, periods_per_week, status)
    values (v_ph, a_ph, c5, null, 'KHKT 8 (học kỳ II)', 'khkt', 8,
            coalesce(array(select id from classes where org_id = v_ph and grade = 8 order by name limit 1), '{}'), '2026-2027', '2027-01-11', 1, 'draft');
  perform public.ppct_build((select id from ppct_plans where org_id = v_ph and subject = 'khkt'));
  if v_lqd is not null then
    insert into ppct_plans (org_id, package_school_id, curriculum_id, material_set_id, title, subject, grade, class_ids, school_year, start_date, periods_per_week, status)
      values (v_lqd, a_lqd, c2, s_k6, 'KHTN 6 – Liên môn (1 tiết/tuần)', 'khtn', 6,
              coalesce(array(select id from classes where org_id = v_lqd and grade = 6 order by name), '{}'), '2026-2027', '2026-09-07', 1, 'published');
    perform public.ppct_build((select id from ppct_plans where org_id = v_lqd and subject = 'khtn'));
  end if;
  if v_dtd is not null then
    insert into ppct_plans (org_id, package_school_id, curriculum_id, material_set_id, title, subject, grade, class_ids, school_year, start_date, periods_per_week, status)
      values (v_dtd, a_dtd, c3, s_sc1, 'Sáng chế lớp 1', 'sang_che', 1,
              coalesce(array(select id from classes where org_id = v_dtd and grade = 1 order by name), '{}'), '2026-2027', '2026-09-07', 1, 'published');
    perform public.ppct_build((select id from ppct_plans where org_id = v_dtd and subject = 'sang_che'));
  end if;
  -- Tiến độ thực tế đến 20/10/2026: đã dạy, kèm minh chứng & mức đạt; vài mục chậm / dời lịch
  for r in select i.id, i.planned_date, row_number() over (partition by i.plan_id order by i.seq) n, p.org_id
             from ppct_items i join ppct_plans p on p.id = i.plan_id
            where p.status = 'published' and i.planned_date < date '2026-10-20' loop
    if r.n % 5 = 0 then
      update ppct_items set status = 'moved', note = 'Dời lịch do kiểm tra giữa kỳ' where id = r.id;
    elsif r.n % 7 = 3 and r.org_id = v_lqd then
      null;   -- chưa ghi nhận → chậm tiến độ
    else
      update ppct_items set status = 'done', done_on = r.planned_date + 3,
        evidence_url = case when r.n % 2 = 0 then 'https://drive.google.com/demo-minh-chung' end,
        evidence_note = case when r.n % 2 = 0 then 'Ảnh sản phẩm các nhóm' end,
        achieved_pct = 60 + (r.n * 7) % 35 where id = r.id;
    end if;
  end loop;

  -- ===== Giáo án triển khai =====
  for r in select ml2.*, s.owner_org_id from material_lessons ml2 join material_sets s on s.id = ml2.set_id
            where s.id in (s_k6) order by ml2.seq limit 2 loop
    insert into lesson_designs (org_id, teacher_id, material_lesson_id, curriculum_lesson_id, title, subject, grade, status, objectives, sessions, norms, criteria, notes)
      values (v_ph, v_gv, r.id, r.curriculum_lesson_id, r.title || ' – lớp 6A', 'khtn', 6, case when r.seq = 1 then 'published' else 'draft' end, r.objectives,
              jsonb_build_array(jsonb_build_object('title', 'Buổi 1', 'minutes', 90, 'activities',
                (select coalesce(jsonb_agg(jsonb_build_object('title', x->>'title', 'minutes', (x->>'minutes')::int, 'teacher', x->>'teacher', 'student', x->>'student', 'product', '')), '[]') from jsonb_array_elements(r.steps) x))),
              (select coalesce(jsonb_agg(jsonb_build_object('name', n.name, 'spec', n.spec, 'unit', n.unit, 'qty', case when n.basis = 'per_product' then n.qty * 0.8 else n.qty end, 'basis', n.basis, 'category', n.category) order by n.seq), '[]')
                 from material_norms n where n.lesson_id = r.id),
              r.criteria, 'Điều chỉnh: giảm 20% vật tư theo sản phẩm vì lớp làm theo cặp; dùng chai 0,5 lít.');
  end loop;
  if v_dtd is not null then
    select id into ml from material_lessons where set_id = s_sc1 and title = 'Cột đèn giao thông xoay';
    insert into lesson_designs (org_id, material_lesson_id, curriculum_lesson_id, title, subject, grade, status, objectives, sessions, norms, criteria)
      select v_dtd, m.id, m.curriculum_lesson_id, 'Cột đèn giao thông xoay – lớp 1A', 'sang_che', 1, 'published', m.objectives,
             (select jsonb_agg(jsonb_build_object('title', 'Buổi ' || ss, 'minutes', 35, 'activities',
                (select coalesce(jsonb_agg(jsonb_build_object('title', x->>'title', 'minutes', (x->>'minutes')::int, 'teacher', x->>'teacher', 'student', x->>'student', 'product', '')), '[]')
                   from jsonb_array_elements(m.steps) x where (x->>'session')::int = ss)) order by ss) from generate_series(1, 2) ss),
             (select jsonb_agg(jsonb_build_object('name', n.name, 'spec', n.spec, 'unit', n.unit, 'qty', n.qty, 'basis', n.basis, 'category', n.category) order by n.seq) from material_norms n where n.lesson_id = m.id),
             m.criteria
        from material_lessons m where m.id = ml;
  end if;

  -- ===== E-learning gắn chương trình =====
  insert into courses (org_id, title, description, subject, grade, status, shared, curriculum_id, package_id, material_set_id)
    values (v_kdi, 'Ôn tập Liên môn KHTN 6', 'Khoá ôn tập trực tuyến theo bộ học liệu KHTN 6, dùng cho gói Cơ bản và Nâng cao.', 'KHTN', 6, 'published', true, c2, p_cb, s_k6)
    returning id into v_course;
  insert into course_lessons (course_id, position, title, kind, body, duration_min)
    select v_course, ml2.seq, ml2.title, 'reading', coalesce(ml2.objectives, ml2.title), 15 from material_lessons ml2 where ml2.set_id = s_k6;
  insert into courses (org_id, title, description, subject, grade, status, shared, curriculum_id, material_set_id)
    values (v_kdi, 'Robotics 6 – học trước tại nhà', 'Video và bài đọc chuẩn bị cho tiết Robotics.', 'Tin học', 6, 'published', true, c4, s_rb6) returning id into v_course;
  insert into course_lessons (course_id, position, title, kind, body, duration_min)
    select v_course, ml2.seq, ml2.title, 'reading', coalesce(ml2.objectives, ml2.title), 10 from material_lessons ml2 where ml2.set_id = s_rb6;
end $$;
