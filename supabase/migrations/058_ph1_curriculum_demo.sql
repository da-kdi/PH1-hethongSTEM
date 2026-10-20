-- 058. PH1 · Dữ liệu mẫu cho Chương trình đào tạo (057). CHỈ chạy khi bật cờ app.seed_demo = on.
-- 9 chương trình của KDI, Sở Hưng Yên và hai trường, đủ CT1–CT5 và đủ trạng thái phiên bản
-- (đang hiệu lực, hết hiệu lực, chờ duyệt, bị trả lại, đã duyệt chờ ban hành, đang soạn), bản kế thừa, danh mục riêng.
-- Chạy lại được: bỏ qua nếu đã có chương trình mã 'DEMO-%'.
-- Kèm một sửa quyền (áp cho mọi CSDL): mục danh mục do KDI (đơn vị chủ nền tảng) thêm là mặc định cho mọi đơn vị, như mục hệ thống.

create or replace function public.curriculum_is_platform_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select is_platform from organizations where id = p_org), false) $$;
grant execute on function public.curriculum_is_platform_org(uuid) to authenticated;
drop policy if exists curriculum_catalog_read on curriculum_catalog;
create policy curriculum_catalog_read on curriculum_catalog for select to authenticated using (
  owner_org_id is null or owner_org_id in (select public.my_scope_orgs()) or owner_org_id in (select public.my_org_tree())
  or public.curriculum_is_platform_org(owner_org_id));

-- Tạo nội dung một phiên bản từ JSON:
--   [{t: tên chủ đề, g: khối, p: số tiết, s: môn chủ đạo, i: [môn tích hợp], r: phòng, d: mô tả,
--     l: [[tên bài, số tiết, yêu cầu cần đạt]], o: [[loại, môn, mô tả, năng lực]]}]
create or replace function pg_temp.ph1_fill(p_version uuid, p_units jsonb) returns void language plpgsql as $$
declare u jsonb; l jsonb; o jsonb; v_unit uuid; v_lesson uuid; i int := 0; j int; k int; n int;
  v_outs uuid[]; v_o uuid; v_rub jsonb; v_plan jsonb; v_steps text[] := array['Xác định vấn đề, nghiên cứu kiến thức nền', 'Đề xuất, lựa chọn giải pháp',
    'Chế tạo mẫu, thử nghiệm và đánh giá', 'Chia sẻ, thảo luận và điều chỉnh'];
begin
  select criteria into v_rub from rubrics where org_id is null order by created_at limit 1;
  for u in select * from jsonb_array_elements(p_units) loop
    i := i + 1;
    insert into curriculum_units (version_id, seq, code, title, summary, grade, periods, subject_main, subjects_integrated, room_kind)
      values (p_version, i, 'C' || i, u->>'t', u->>'d', (u->>'g')::int, coalesce((u->>'p')::int, 0), u->>'s',
              coalesce(array(select jsonb_array_elements_text(u->'i')), '{}'), coalesce(u->>'r', 'stem'))
      returning id into v_unit;
    v_outs := '{}';
    k := 0;
    for o in select * from jsonb_array_elements(coalesce(u->'o', '[]')) loop
      k := k + 1;
      insert into curriculum_outcomes (version_id, unit_id, seq, code, kind, subject, description, competency_key)
        values (p_version, v_unit, k, 'YC' || i || '.' || k, o->>0, nullif(o->>1, ''), o->>2, nullif(o->>3, ''))
        returning id into v_o;
      v_outs := v_outs || v_o;
    end loop;
    j := 0;
    for l in select * from jsonb_array_elements(coalesce(u->'l', '[]')) loop
      j := j + 1; n := greatest(coalesce((l->>1)::int, 1), 1);
      select coalesce(jsonb_agg(jsonb_build_object('title', v_steps[1 + ((s - 1) * 4 / n)], 'minutes', 35) order by s), '[]')
        into v_plan from generate_series(1, n) s;
      insert into curriculum_lessons (version_id, unit_id, seq, code, title, periods, minutes_per_period, period_plan, summary)
        values (p_version, v_unit, j, 'B' || i || '.' || j, l->>0, n, 35, v_plan, l->>2)
        returning id into v_lesson;
      insert into curriculum_outcomes (version_id, unit_id, lesson_id, seq, code, kind, subject, description)
        values (p_version, v_unit, v_lesson, 1, 'YC' || i || '.' || j || 'a', 'kien_thuc', u->>'s', coalesce(l->>2, 'Nêu được kiến thức nền của bài ' || (l->>0) || '.'));
      insert into curriculum_outcomes (version_id, unit_id, lesson_id, seq, code, kind, subject, description)
        values (p_version, v_unit, v_lesson, 2, 'YC' || i || '.' || j || 'b', 'ky_nang', null,
                'Thực hiện được sản phẩm / nhiệm vụ của bài “' || (l->>0) || '” theo tiêu chí đã thống nhất, sử dụng dụng cụ an toàn.')
        returning id into v_o;
      v_outs := v_outs || v_o;
    end loop;
    insert into curriculum_assessments (version_id, unit_id, seq, title, method, outcome_ids, rubric_id, criteria, evidence, weight)
      values (p_version, v_unit, 1, 'Sản phẩm của ' || lower(u->>'t'), 'san_pham', v_outs[1:3],
              (select id from rubrics where org_id is null order by created_at limit 1), coalesce(v_rub, '[]'),
              'Ảnh / video sản phẩm của nhóm; phiếu đánh giá theo tiêu chí; nhật ký thiết kế', 60),
             (p_version, v_unit, 2, 'Thuyết trình và phản biện', 'thuyet_trinh', v_outs[1:1], null,
              '[{"name": "Nội dung trình bày", "levels": ["Thiếu ý chính", "Đủ ý nhưng rời rạc", "Rõ ràng, đúng kiến thức", "Rõ ràng, sâu, liên hệ thực tế"]},
                {"name": "Trả lời câu hỏi", "levels": ["Chưa trả lời được", "Trả lời một phần", "Trả lời đúng", "Trả lời đúng, mở rộng vấn đề"]}]',
              'Bài trình bày của đại diện nhóm; phiếu đánh giá đồng đẳng', 40);
  end loop;
end $$;

-- Một chương trình + các phiên bản. p_versions: [{label, status, note, from}] theo thứ tự cũ → mới;
-- phiên bản cũ có ít chủ đề hơn (bỏ chủ đề cuối) để so sánh phiên bản có khác biệt.
create or replace function pg_temp.ph1_cur(p_org uuid, p_code text, p_name text, p_cat text, p_summary text, p_levels text[], p_grades int[],
  p_subjects text[], p_fields text[], p_scope text, p_units jsonb, p_versions jsonb, p_source uuid default null, p_approval boolean default true)
returns uuid language plpgsql as $$
declare v_cur uuid; v jsonb; n int := 0; v_ver uuid; v_cnt int := jsonb_array_length(p_versions); v_units jsonb; v_status text;
  v_pub uuid; v_req uuid; v_src_ver uuid;
begin
  select current_version_id into v_src_ver from curricula where id = p_source;
  insert into curricula (owner_org_id, code, name, category, summary, issuer, levels, grades, subjects, fields, scope, require_approval,
                         source_curriculum_id, source_version_id)
    values (p_org, p_code, p_name, p_cat, p_summary, (select name from organizations where id = p_org), p_levels, p_grades, p_subjects, p_fields,
            p_scope, p_approval, p_source, v_src_ver)
    returning id into v_cur;
  for v in select * from jsonb_array_elements(p_versions) loop
    n := n + 1; v_status := v->>'status';
    v_units := case when n < v_cnt and jsonb_array_length(p_units) > 1 then p_units - (jsonb_array_length(p_units) - 1) else p_units end;
    perform set_config('app.curriculum_internal', 'on', true);
    insert into curriculum_versions (curriculum_id, org_id, version_no, label, status, change_note, based_on_version_id, created_at)
      values (v_cur, p_org, n, v->>'label', 'draft', v->>'note', v_ver, now() - make_interval(days => (v_cnt - n) * 120 + 10))
      returning id into v_ver;
    perform set_config('app.curriculum_internal', 'off', true);
    perform pg_temp.ph1_fill(v_ver, v_units);
    if v_status in ('pending', 'approved', 'rejected') then
      update curriculum_versions set status = 'pending' where id = v_ver;          -- mở hồ sơ trong engine phê duyệt
      if v_status <> 'pending' then
        select id into v_req from approval_requests where ref_table = 'curriculum_versions' and ref_id = v_ver and status = 'pending';
        insert into approval_actions (request_id, step_no, decision, note)
          values (v_req, 1, case v_status when 'approved' then 'approve' else 'reject' end, v->>'decision_note');
        update approval_requests set status = v_status, decided_at = now() - interval '1 day' where id = v_req;
        perform set_config('app.approval_engine', 'on', true);
        update curriculum_versions set status = v_status where id = v_ver;
        perform set_config('app.approval_engine', 'off', true);
      end if;
    elsif v_status in ('published', 'superseded') then
      perform set_config('app.curriculum_internal', 'on', true);
      update curriculum_versions set status = v_status, published_at = (v->>'from')::date, effective_from = (v->>'from')::date,
             effective_to = nullif(v->>'to', '')::date, submitted_at = (v->>'from')::date - 7, decided_at = (v->>'from')::date - 3
       where id = v_ver;
      perform set_config('app.curriculum_internal', 'off', true);
      if v_status = 'published' then v_pub := v_ver; end if;
    end if;
  end loop;
  perform set_config('app.curriculum_internal', 'on', true);
  update curricula set current_version_id = v_pub where id = v_cur;
  perform set_config('app.curriculum_internal', 'off', true);
  return v_cur;
end $$;

do $$
declare v_kdi uuid; v_hy uuid; v_ph uuid; v_kb uuid; v_ns uuid; v_rb uuid; v_hidden uuid;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if; -- dữ liệu mẫu: chỉ chạy khi bật cờ app.seed_demo
  if to_regclass('public.curricula') is null or exists (select 1 from curricula where code like 'DEMO-%') then return; end if;
  select id into v_kdi from organizations where is_platform limit 1;
  select id into v_hy from organizations where code = 'SO-HY';
  select id into v_ph from organizations where code = 'THCS-PH';
  select id into v_kb from organizations where code = 'THCS-KB';
  if v_kdi is null or v_hy is null or v_ph is null then return; end if;

  -- Danh mục riêng: KDI thêm loại chương trình, Sở thêm lĩnh vực địa phương, trường thêm môn CLB và ẩn cấp học không dùng
  insert into curriculum_catalog (owner_org_id, kind, code, name, description, color, sort) values
    (v_kdi, 'category', 'CLB', 'Câu lạc bộ STEM', 'Hoạt động ngoài giờ theo chủ đề', '#0891b2', 6),
    (v_kdi, 'field', 'iot', 'Internet vạn vật (IoT)', null, null, 7),
    (v_hy, 'field', 'nong_nghiep', 'Nông nghiệp công nghệ cao', 'Lĩnh vực ưu tiên của Hưng Yên', null, 10),
    (v_hy, 'assessment_method', 'trien_lam', 'Triển lãm sản phẩm cấp cụm', null, null, 10),
    (v_ph, 'subject', 'clb_robot', 'CLB Robotics', 'Môn tự chọn của trường', null, 30)
  on conflict do nothing;
  insert into curriculum_catalog_hidden (org_id, item_id)
    select v_ph, id from curriculum_catalog where owner_org_id is null and code in ('mamnon', 'thpt')
  on conflict do nothing;

  -- ===== KDI Education (phát hành công khai) =====
  perform pg_temp.ph1_cur(v_kdi, 'DEMO-CT1-TH', 'STEM tích hợp Toán – Khoa học lớp 4–5', 'CT1',
    'Lồng ghép hoạt động STEM vào tiết Toán và Khoa học: đo lường, dữ liệu, vật liệu, năng lượng.',
    '{tieuhoc}', '{4,5}', '{toan,khoa_hoc}', '{stem}', 'public',
    '[{"t": "Đo lường quanh em", "g": 4, "p": 4, "s": "toan", "i": ["khoa_hoc"], "d": "Đơn vị đo, ước lượng và đo thực tế.",
       "l": [["Thước đo tự chế", 2, "Sử dụng được đơn vị đo độ dài, ước lượng và đo chính xác đến cm."], ["Cân thăng bằng", 2, "So sánh được khối lượng bằng cân đòn tự làm."]],
       "o": [["nang_luc", "toan", "Vận dụng đo lường để giải quyết tình huống thực tế.", "toan_hoc"]]},
      {"t": "Vật liệu và tính chất", "g": 4, "p": 4, "s": "khoa_hoc", "i": ["mi_thuat"], "d": "Tính chất thấm nước, dẫn nhiệt của vật liệu.",
       "l": [["Chiếc ô chống thấm", 2, "Nêu được vật liệu thấm và không thấm nước."], ["Cốc giữ nhiệt", 2, "So sánh được khả năng dẫn nhiệt của các vật liệu."]],
       "o": [["nang_luc", "khoa_hoc", "Tìm hiểu tự nhiên qua thí nghiệm đơn giản.", "khoa_hoc"]]},
      {"t": "Biểu đồ dữ liệu lớp em", "g": 5, "p": 3, "s": "toan", "i": ["tin_hoc"], "d": "Thu thập, biểu diễn dữ liệu.",
       "l": [["Khảo sát món ăn yêu thích", 1, "Thu thập và ghi lại được dữ liệu bằng bảng kiểm."], ["Biểu đồ cột bằng giấy màu", 2, "Biểu diễn được dữ liệu bằng biểu đồ cột."]],
       "o": [["ky_nang", "toan", "Đọc và nhận xét được biểu đồ đơn giản.", "toan_hoc"]]},
      {"t": "Năng lượng mặt trời", "g": 5, "p": 4, "s": "khoa_hoc", "i": ["cong_nghe"], "d": "Năng lượng sạch và ứng dụng.",
       "l": [["Lò sấy năng lượng mặt trời", 2, "Giải thích được vì sao màu tối hấp thụ nhiệt tốt."], ["Xe năng lượng mặt trời", 2, "Lắp được mạch pin mặt trời – động cơ đơn giản."]],
       "o": [["pham_chat", null, "Có ý thức tiết kiệm năng lượng, bảo vệ môi trường.", ""]]}]',
    '[{"label": "2025–2026", "status": "superseded", "note": "Bản đầu tiên", "from": "2025-08-20", "to": "2026-08-14"},
      {"label": "2026–2027", "status": "published", "note": "Thêm chủ đề Năng lượng mặt trời; cập nhật tiêu chí sản phẩm", "from": "2026-08-15"}]');

  v_ns := pg_temp.ph1_cur(v_kdi, 'DEMO-CT2-THCS', 'Liên môn STEM THCS: Năng lượng & Môi trường', 'CT2',
    'Chủ đề liên môn Vật lí – Hoá học – Sinh học – Công nghệ về năng lượng, nước và rác thải.',
    '{thcs}', '{6,7,8,9}', '{khtn,cong_nghe,toan}', '{stem,sang_tao}', 'public',
    '[{"t": "Lọc nước sạch", "g": 6, "p": 4, "s": "khtn", "i": ["cong_nghe"], "d": "Hỗn hợp, tách chất, xử lý nước.",
       "l": [["Bình lọc nước nhiều lớp", 2, "Giải thích được vai trò của từng lớp vật liệu lọc."], ["Kiểm tra độ trong của nước", 2, "Đo và so sánh được độ đục trước và sau lọc."]],
       "o": [["nang_luc", "khtn", "Vận dụng kiến thức tách chất để giải quyết vấn đề nước sạch.", "khoa_hoc"]]},
      {"t": "Nhà ở tiết kiệm năng lượng", "g": 7, "p": 5, "s": "khtn", "i": ["toan", "cong_nghe"], "d": "Truyền nhiệt, cách nhiệt, chiếu sáng.",
       "l": [["Mô hình nhà cách nhiệt", 3, "Giải thích được ba hình thức truyền nhiệt."], ["Đèn LED tiết kiệm điện", 2, "Tính được điện năng tiêu thụ của thiết bị."]],
       "o": [["nang_luc", "cong_nghe", "Thiết kế giải pháp kỹ thuật đơn giản cho ngôi nhà.", "cong_nghe"]]},
      {"t": "Phân loại rác thông minh", "g": 8, "p": 4, "s": "cong_nghe", "i": ["khtn", "tin_hoc"], "d": "Phân loại, tái chế; cảm biến cơ bản.",
       "l": [["Thùng rác phân loại", 2, "Phân loại được rác hữu cơ, tái chế, nguy hại."], ["Phân compost mini", 2, "Mô tả được quá trình phân huỷ hữu cơ."]],
       "o": [["pham_chat", null, "Có trách nhiệm với môi trường sống của cộng đồng.", ""]]},
      {"t": "Điện gió quy mô nhỏ", "g": 9, "p": 5, "s": "khtn", "i": ["toan", "cong_nghe"], "d": "Cảm ứng điện từ, máy phát điện.",
       "l": [["Tua-bin gió mini", 3, "Giải thích được nguyên lý máy phát điện xoay chiều."], ["Đo công suất tua-bin", 2, "Đo và vẽ được đồ thị công suất theo tốc độ gió."]],
       "o": [["nang_luc", "toan", "Xử lý số liệu thực nghiệm, rút ra kết luận.", "toan_hoc"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Bản đầu tiên", "from": "2026-08-15"}]');

  v_rb := pg_temp.ph1_cur(v_kdi, 'DEMO-CT4-MB', 'Robotics cơ bản với micro:bit', 'CT4',
    'Lập trình khối với micro:bit, cảm biến và động cơ; dự án robot giải quyết vấn đề.',
    '{thcs}', '{6,7,8}', '{tin_hoc,cong_nghe}', '{robotics,lap_trinh,iot}', 'public',
    '[{"t": "Làm quen micro:bit", "g": 6, "p": 3, "s": "tin_hoc", "i": ["cong_nghe"], "r": "stem", "d": "Màn LED, nút bấm, vòng lặp, điều kiện.",
       "l": [["Bảng tên LED", 1, "Lập trình được hiển thị chữ và hình trên màn LED."], ["Xúc xắc điện tử", 2, "Sử dụng được biến và số ngẫu nhiên."]],
       "o": [["nang_luc", "tin_hoc", "Biểu diễn thuật toán bằng chương trình khối.", "tin_hoc"]]},
      {"t": "Cảm biến quanh ta", "g": 7, "p": 4, "s": "tin_hoc", "i": ["khtn"], "d": "Cảm biến ánh sáng, nhiệt độ, gia tốc.",
       "l": [["Đèn ngủ tự động", 2, "Đọc được giá trị cảm biến ánh sáng và điều khiển LED."], ["Nhiệt kế cảnh báo", 2, "Đặt được ngưỡng cảnh báo theo dữ liệu nhiệt độ."]],
       "o": [["ky_nang", "khtn", "Thu thập dữ liệu môi trường bằng cảm biến.", "khoa_hoc"]]},
      {"t": "Robot di chuyển", "g": 8, "p": 6, "s": "cong_nghe", "i": ["tin_hoc", "toan"], "d": "Động cơ, bánh xe, dò line.",
       "l": [["Lắp ráp xe robot", 2, "Lắp được khung xe, động cơ và mạch điều khiển."], ["Robot dò line", 2, "Lập trình được robot đi theo vạch đen."], ["Robot tránh vật cản", 2, "Sử dụng được cảm biến siêu âm để tránh vật cản."]],
       "o": [["nang_luc", "cong_nghe", "Thiết kế, chế tạo và cải tiến sản phẩm kỹ thuật.", "cong_nghe"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Bản đầu tiên", "from": "2026-08-15"},
      {"label": "2026–2027 · bổ sung", "status": "pending", "note": "Bổ sung chủ đề Robot di chuyển, thêm bài tránh vật cản"}]');

  perform pg_temp.ph1_cur(v_kdi, 'DEMO-CT4-AI', 'Trí tuệ nhân tạo cho học sinh THPT', 'CT4',
    'Học máy cơ bản, nhận dạng hình ảnh, đạo đức AI; dự án AI giải quyết vấn đề địa phương.',
    '{thpt}', '{10,11}', '{tin_hoc,toan}', '{ai,lap_trinh}', 'public',
    '[{"t": "AI là gì?", "g": 10, "p": 3, "s": "tin_hoc", "i": ["ngu_van"], "r": "classroom", "d": "Khái niệm, ứng dụng, đạo đức AI.",
       "l": [["AI trong đời sống", 1, "Kể được ứng dụng AI và rủi ro khi sử dụng."], ["Tranh biện: AI và việc làm", 2, "Lập luận được quan điểm về tác động của AI."]],
       "o": [["pham_chat", null, "Sử dụng AI trung thực, có trách nhiệm.", ""]]},
      {"t": "Nhận dạng hình ảnh", "g": 10, "p": 5, "s": "tin_hoc", "i": ["toan"], "d": "Dữ liệu huấn luyện, mô hình phân loại.",
       "l": [["Thu thập bộ ảnh", 2, "Chuẩn bị được bộ dữ liệu ảnh có nhãn."], ["Huấn luyện mô hình phân loại", 3, "Huấn luyện và đánh giá được độ chính xác mô hình."]],
       "o": [["nang_luc", "tin_hoc", "Giải quyết vấn đề bằng mô hình học máy.", "tin_hoc"]]}]',
    '[{"label": "Bản thử nghiệm", "status": "draft", "note": "Đang biên soạn, chưa gửi duyệt"}]');

  perform pg_temp.ph1_cur(v_kdi, 'DEMO-CT5-KHKT', 'Nghiên cứu khoa học kỹ thuật (KHKT) THCS–THPT', 'CT5',
    'Quy trình nghiên cứu khoa học, viết đề cương, thực nghiệm, báo cáo theo hướng dẫn cuộc thi KHKT của Bộ.',
    '{thcs,thpt}', '{8,9,10,11,12}', '{khtn,vat_li,hoa_hoc,sinh_hoc}', '{khkt}', 'public',
    '[{"t": "Đặt câu hỏi nghiên cứu", "g": 8, "p": 3, "s": "khtn", "i": ["ngu_van"], "r": "classroom", "d": "Quan sát, xác định vấn đề, giả thuyết.",
       "l": [["Từ quan sát đến câu hỏi", 1, "Đặt được câu hỏi nghiên cứu từ hiện tượng thực tế."], ["Viết giả thuyết", 2, "Phát biểu được giả thuyết có thể kiểm chứng."]],
       "o": [["nang_luc", "khtn", "Tìm hiểu tự nhiên theo phương pháp khoa học.", "khoa_hoc"]]},
      {"t": "Thiết kế thực nghiệm", "g": 9, "p": 4, "s": "khtn", "i": ["toan"], "r": "lab", "d": "Biến số, nhóm đối chứng, sai số.",
       "l": [["Biến độc lập và phụ thuộc", 2, "Xác định được các biến trong thí nghiệm."], ["Ghi chép và xử lý số liệu", 2, "Tính được trung bình, sai số và vẽ đồ thị."]],
       "o": [["ky_nang", "toan", "Xử lý và trình bày số liệu thực nghiệm.", "toan_hoc"]]},
      {"t": "Báo cáo và trình bày", "g": 10, "p": 4, "s": "ngu_van", "i": ["tin_hoc"], "r": "classroom", "d": "Báo cáo, poster, trả lời ban giám khảo.",
       "l": [["Viết báo cáo KHKT", 2, "Viết được báo cáo đúng cấu trúc hướng dẫn."], ["Poster và thuyết trình", 2, "Trình bày được dự án trong 5 phút, trả lời câu hỏi."]],
       "o": [["nang_luc", null, "Giao tiếp và hợp tác trong nhóm nghiên cứu.", "giao_tiep"]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Theo hướng dẫn cuộc thi KHKT năm học hiện hành", "from": "2026-09-01"}]');

  -- ===== Sở GD&ĐT Hưng Yên (phát hành cho trường trực thuộc) =====
  perform pg_temp.ph1_cur(v_hy, 'DEMO-HY-NN', 'STEM địa phương Hưng Yên: Nông nghiệp thông minh', 'CT2',
    'Chủ đề gắn với cây nhãn, rau an toàn và tưới tiêu tiết kiệm của địa phương.',
    '{thcs}', '{7,8,9}', '{khtn,cong_nghe,tin_hoc}', '{stem,nong_nghiep,iot}', 'children',
    '[{"t": "Vườn rau an toàn", "g": 7, "p": 4, "s": "cong_nghe", "i": ["khtn"], "r": "outdoor", "d": "Đất, giá thể, chăm sóc rau.",
       "l": [["Giá thể trồng rau", 2, "So sánh được độ ẩm và độ tơi của các loại giá thể."], ["Nhật ký sinh trưởng", 2, "Ghi chép và biểu diễn được sự sinh trưởng của cây."]],
       "o": [["nang_luc", "cong_nghe", "Vận dụng kỹ thuật trồng trọt vào thực tế gia đình.", "cong_nghe"]]},
      {"t": "Tưới cây tự động", "g": 8, "p": 5, "s": "tin_hoc", "i": ["cong_nghe", "khtn"], "d": "Cảm biến độ ẩm đất, máy bơm mini.",
       "l": [["Đo độ ẩm đất", 2, "Đọc được giá trị cảm biến độ ẩm và hiệu chuẩn."], ["Hệ thống tưới tự động", 3, "Lập trình được bơm tự bật khi đất khô."]],
       "o": [["nang_luc", "tin_hoc", "Ứng dụng IoT giải quyết vấn đề nông nghiệp.", "tin_hoc"]]},
      {"t": "Bảo quản nhãn lồng Hưng Yên", "g": 9, "p": 4, "s": "khtn", "i": ["cong_nghe", "ls_dl"], "d": "Hô hấp tế bào, sấy, bảo quản lạnh.",
       "l": [["Vì sao quả nhanh hỏng?", 2, "Giải thích được ảnh hưởng của nhiệt độ đến bảo quản."], ["Máy sấy nhãn mini", 2, "Thiết kế được buồng sấy có kiểm soát nhiệt độ."]],
       "o": [["pham_chat", null, "Yêu quê hương, quý trọng sản vật địa phương.", ""]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Sở ban hành theo kế hoạch STEM năm học", "from": "2026-09-05"}]');

  perform pg_temp.ph1_cur(v_hy, 'DEMO-HY-KN', 'Đổi mới sáng tạo – Khởi nghiệp học đường', 'CT3',
    'Tư duy thiết kế, nguyên mẫu, mô hình kinh doanh đơn giản cho học sinh THCS.',
    '{thcs}', '{8,9}', '{cong_nghe,hdtn}', '{sang_tao}', 'children',
    '[{"t": "Tư duy thiết kế", "g": 8, "p": 3, "s": "hdtn", "i": ["cong_nghe"], "r": "classroom", "d": "Thấu cảm, xác định vấn đề, ý tưởng.",
       "l": [["Phỏng vấn người dùng", 1, "Thu thập được nhu cầu người dùng qua phỏng vấn."], ["Bão não ý tưởng", 2, "Đề xuất và chọn được ý tưởng khả thi."]],
       "o": [["nang_luc", null, "Giải quyết vấn đề và sáng tạo.", "gqvd"]]},
      {"t": "Nguyên mẫu và gọi vốn", "g": 9, "p": 4, "s": "cong_nghe", "i": ["toan"], "d": "Nguyên mẫu, chi phí, thuyết trình gọi vốn.",
       "l": [["Làm nguyên mẫu", 2, "Chế tạo được nguyên mẫu thử nghiệm với người dùng."], ["Thuyết trình gọi vốn", 2, "Trình bày được giá trị sản phẩm và chi phí."]],
       "o": [["nang_luc", "toan", "Tính toán chi phí, lợi nhuận đơn giản.", "toan_hoc"]]}]',
    '[{"label": "Dự thảo", "status": "rejected", "note": "Gửi lấy ý kiến các trường",
       "decision_note": "Bổ sung tiêu chí đánh giá nguyên mẫu và thời lượng cho lớp 9"}]');

  -- ===== Trường THCS Phố Hiến =====
  perform pg_temp.ph1_cur(v_ph, 'DEMO-PH-NL', 'Năng lượng & Môi trường – THCS Phố Hiến', 'CT2',
    'Kế thừa chương trình KDI, điều chỉnh thời lượng theo kế hoạch giáo dục nhà trường.',
    '{thcs}', '{6,7,8,9}', '{khtn,cong_nghe,toan}', '{stem}', 'own',
    '[{"t": "Lọc nước sạch", "g": 6, "p": 4, "s": "khtn", "i": ["cong_nghe"], "d": "Giữ nguyên theo KDI.",
       "l": [["Bình lọc nước nhiều lớp", 2, "Giải thích được vai trò của từng lớp vật liệu lọc."], ["Kiểm tra độ trong của nước", 2, "Đo và so sánh được độ đục trước và sau lọc."]],
       "o": [["nang_luc", "khtn", "Vận dụng kiến thức tách chất để giải quyết vấn đề nước sạch.", "khoa_hoc"]]},
      {"t": "Nhà ở tiết kiệm năng lượng", "g": 7, "p": 3, "s": "khtn", "i": ["toan"], "d": "Rút gọn còn 3 tiết do trùng lịch kiểm tra.",
       "l": [["Mô hình nhà cách nhiệt", 3, "Giải thích được ba hình thức truyền nhiệt."]],
       "o": [["nang_luc", "cong_nghe", "Thiết kế giải pháp kỹ thuật đơn giản cho ngôi nhà.", "cong_nghe"]]},
      {"t": "Phân loại rác tại trường", "g": 8, "p": 4, "s": "cong_nghe", "i": ["khtn"], "d": "Gắn với phong trào Trường học xanh của trường.",
       "l": [["Khảo sát rác thải sân trường", 2, "Thống kê được loại rác phát sinh trong một tuần."], ["Thùng rác phân loại", 2, "Phân loại được rác hữu cơ, tái chế, nguy hại."]],
       "o": [["pham_chat", null, "Có trách nhiệm với môi trường nhà trường.", ""]]}]',
    '[{"label": "2026–2027", "status": "published", "note": "Kế thừa từ KDI, điều chỉnh theo trường", "from": "2026-09-05"}]',
    v_ns);

  perform pg_temp.ph1_cur(v_ph, 'DEMO-PH-CLB', 'CLB Robotics THCS Phố Hiến', 'CLB',
    'Câu lạc bộ ngoài giờ chuẩn bị cho cuộc thi Robotics cấp tỉnh.',
    '{thcs}', '{7,8,9}', '{clb_robot,tin_hoc}', '{robotics}', 'own',
    '[{"t": "Robot thi đấu", "g": 8, "p": 6, "s": "clb_robot", "i": ["tin_hoc", "cong_nghe"], "d": "Luật thi, chiến thuật, tối ưu robot.",
       "l": [["Luật thi Robotics", 2, "Nêu được luật thi và tiêu chí chấm điểm."], ["Tối ưu tốc độ dò line", 2, "Điều chỉnh được thông số để robot chạy ổn định."], ["Thi đấu thử", 2, "Phối hợp được trong đội thi."]],
       "o": [["nang_luc", null, "Hợp tác và giao tiếp trong đội thi.", "giao_tiep"]]}]',
    '[{"label": "2026–2027", "status": "approved", "note": "Kế hoạch CLB học kỳ I", "decision_note": "Đồng ý, ban hành từ tuần 5"}]');

  -- ===== Trường THCS Kim Bảng (Bắc Ninh): kế thừa Robotics của KDI, đang soạn =====
  if v_kb is not null then
    perform pg_temp.ph1_cur(v_kb, 'DEMO-KB-RB', 'Robotics micro:bit – THCS Kim Bảng', 'CT4',
      'Kế thừa chương trình KDI, đang điều chỉnh cho lớp 7–8.',
      '{thcs}', '{7,8}', '{tin_hoc,cong_nghe}', '{robotics}', 'own',
      '[{"t": "Cảm biến quanh ta", "g": 7, "p": 4, "s": "tin_hoc", "i": ["khtn"], "d": "Theo KDI.",
         "l": [["Đèn ngủ tự động", 2, "Đọc được giá trị cảm biến ánh sáng và điều khiển LED."], ["Nhiệt kế cảnh báo", 2, "Đặt được ngưỡng cảnh báo theo dữ liệu nhiệt độ."]],
         "o": [["ky_nang", "khtn", "Thu thập dữ liệu môi trường bằng cảm biến.", "khoa_hoc"]]}]',
      '[{"label": "2026–2027", "status": "draft", "note": "Kế thừa từ KDI"}]', v_rb);
  end if;

  -- Gắn chủ đề chuẩn vào gói STEM / bài giảng sẵn có (điểm nối), nếu tên khớp
  update class_topics t set curriculum_unit_id = u.id
    from curriculum_units u join curricula c on c.current_version_id = u.version_id
   where c.code = 'DEMO-PH-NL' and t.org_id = v_ph and t.curriculum_unit_id is null and t.title ilike '%' || split_part(u.title, ' ', 1) || '%';
end $$;
