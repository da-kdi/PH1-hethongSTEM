-- 069. E-learning · “Nội dung cần ôn” (bản mẫu v315 · C5): mỗi nội dung ôn gắn một bài học của chương trình, có các ý chính;
--      câu hỏi trong ngân hàng thuộc nội dung ôn qua question_bank.topic = review_topics.title (giữ cách gắn chủ đề sẵn có). Chạy sau 068.
create table if not exists review_topics (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default public.my_org_id() references organizations(id) on delete cascade,
  curriculum_id  uuid references curricula(id) on delete set null,
  lesson_id      uuid references curriculum_lessons(id) on delete set null,
  subject        text,
  grade          int check (grade between 1 and 12),
  title          text not null check (length(btrim(title)) between 1 and 200),
  points         jsonb not null default '[]'::jsonb check (jsonb_typeof(points) = 'array'),   -- các ý chính (chuỗi)
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by     uuid default auth.uid() references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists review_topics_org on review_topics (org_id, curriculum_id);
create or replace function public.review_topics_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); if tg_op = 'UPDATE' then new.org_id := old.org_id; end if; return new; end $$;
drop trigger if exists review_topics_touch on review_topics;
create trigger review_topics_touch before insert or update on review_topics for each row execute function public.review_topics_touch();
alter table review_topics enable row level security;
drop policy if exists review_topics_read on review_topics;
create policy review_topics_read on review_topics for select to authenticated using (public.ph1_can_read(org_id) or (status = 'published' and public.is_staff()));
drop policy if exists review_topics_write on review_topics;
create policy review_topics_write on review_topics for all to authenticated using (public.ph1_can_work(org_id)) with check (public.ph1_can_work(org_id));
grant select, insert, update, delete on review_topics to authenticated;
