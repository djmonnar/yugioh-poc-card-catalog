-- Rename, reversible delete and restore. Card identities and related links stay intact.
begin;
create temporary table category108_annotations_before on commit drop as select * from public.poc_card_annotations;
alter table category108_annotations_before enable row level security;
alter table public.poc_card_categories add column if not exists version bigint not null default nextval('poc_private.revision_seq');
create table if not exists poc_private.category_trash(
 name text primary key,created_at timestamptz not null,version bigint not null,
 bindings jsonb not null,deleted_at timestamptz not null default now(),editor uuid not null
);
create table if not exists poc_private.category_history(
 version bigint primary key,action text not null,old_name text not null,new_name text,
 editor uuid not null,updated_at timestamptz not null default now()
);
alter table poc_private.category_trash enable row level security;
alter table poc_private.category_history enable row level security;
revoke all on poc_private.category_trash,poc_private.category_history from public,anon,authenticated;

create or replace function public.poc_load_card_annotations() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select jsonb_build_object(
 'categories',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'version',version) order by name),'[]') from public.poc_card_categories),
 'annotations',(select coalesce(jsonb_agg(to_jsonb(s) order by s.slot),'[]') from public.poc_card_annotations s join poc_private.cards c on c.slot=s.slot and c.internal_id=s.internal_id and c.identity_key=s.identity_key),
 'deleted_categories',case when poc_private.is_editor() then (select coalesce(jsonb_agg(jsonb_build_object('name',name,'version',version) order by deleted_at desc),'[]') from poc_private.category_trash) else '[]'::jsonb end);
$$;

create or replace function public.poc_create_card_category(p_name text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if p_name is null or length(p_name) not between 1 and 40 or p_name<>btrim(p_name) or p_name~'[[:cntrl:]]' then raise exception 'poc_invalid_category';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 if exists(select 1 from poc_private.category_trash where name=p_name) then raise exception 'poc_category_deleted';end if;
 if not exists(select 1 from public.poc_card_categories where name=p_name) and (select count(*) from public.poc_card_categories)>=128 then raise exception 'poc_category_maximum';end if;
 insert into public.poc_card_categories(name) values(p_name) on conflict do nothing;
 select jsonb_build_object('name',name,'version',version) into result from public.poc_card_categories where name=p_name;
 return result;
end;$$;

create or replace function public.poc_save_card_annotation(p_dataset text,p_slot integer,p_identity_key text,p_tags jsonb,p_links jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c poc_private.cards;r jsonb;oldversion bigint;nextversion bigint;result jsonb;seen integer[]:=array[]::integer[];
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 -- Serialize category changes with saves BEFORE validating names; a stale save
 -- can never bring back a deleted name or race a rename into an orphan tag.
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog';end if;
 select * into c from poc_private.cards where slot=p_slot and identity_key=p_identity_key;
 if not found then raise exception 'poc_identity_changed';end if;
 if jsonb_typeof(p_tags) is distinct from 'array' or jsonb_array_length(p_tags)>12 or jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links)>20 or p_expected_version is null or p_expected_version<0 then raise exception 'poc_invalid_annotation';end if;
 if (select count(*) from jsonb_array_elements(p_tags))<>(select count(distinct value) from jsonb_array_elements(p_tags)) then raise exception 'poc_invalid_annotation';end if;
 for r in select value from jsonb_array_elements(p_tags) loop
  if jsonb_typeof(r)<>'string' or not exists(select 1 from public.poc_card_categories where name=r#>>'{}') then raise exception 'poc_invalid_category';end if;
 end loop;
 for r in select value from jsonb_array_elements(p_links) loop
  if jsonb_typeof(r)<>'object' or (select count(*) from jsonb_object_keys(r))<>2 or not(r?&array['slot','identity_key']) or jsonb_typeof(r->'slot') is distinct from 'number' or r->>'slot'!~'^\d+$' or jsonb_typeof(r->'identity_key') is distinct from 'string' then raise exception 'poc_invalid_annotation';end if;
  if (r->>'slot')::integer=p_slot or (r->>'slot')::integer=any(seen) or not exists(select 1 from poc_private.cards where slot=(r->>'slot')::integer and identity_key=r->>'identity_key') then raise exception 'poc_identity_changed';end if;
  seen:=array_append(seen,(r->>'slot')::integer);
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('poc-annotation:'||p_slot,0));
 select version into oldversion from public.poc_card_annotations where slot=p_slot and identity_key=c.identity_key;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict';end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_annotations values(c.slot,c.internal_id,c.identity_key,p_tags,p_links,nextversion,now()) on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,tags=excluded.tags,links=excluded.links,version=excluded.version,updated_at=excluded.updated_at returning to_jsonb(poc_card_annotations.*) into result;
 insert into poc_private.annotation_history values(nextversion,result,auth.uid(),now());return result;
end;$$;

create or replace function public.poc_rename_card_category(p_name text,p_new_name text,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare current_version bigint;revision bigint;s public.poc_card_annotations%rowtype;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if p_new_name is null or length(p_new_name) not between 1 and 40 or p_new_name<>btrim(p_new_name) or p_new_name~'[[:cntrl:]]' then raise exception 'poc_invalid_category';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 select version into current_version from public.poc_card_categories where name=p_name;
 if current_version is null or p_expected_version is null or current_version is distinct from p_expected_version then raise exception 'poc_conflict';end if;
 if p_name=p_new_name then return public.poc_load_card_annotations();end if;
 if exists(select 1 from public.poc_card_categories where name=p_new_name) then raise exception 'poc_category_exists';end if;
 if exists(select 1 from poc_private.category_trash where name=p_new_name) then raise exception 'poc_category_deleted';end if;
 revision:=nextval('poc_private.revision_seq');
 update public.poc_card_categories set name=p_new_name,version=revision where name=p_name;
 for s in select * from public.poc_card_annotations where tags @> jsonb_build_array(p_name) loop
  update public.poc_card_annotations set tags=(select jsonb_agg(case when value=to_jsonb(p_name) then to_jsonb(p_new_name) else value end order by ord) from jsonb_array_elements(s.tags) with ordinality t(value,ord)),version=nextval('poc_private.revision_seq'),updated_at=now() where slot=s.slot returning to_jsonb(poc_card_annotations.*) into result;
  insert into poc_private.annotation_history values((result->>'version')::bigint,result,auth.uid(),now());
 end loop;
 insert into poc_private.category_history(version,action,old_name,new_name,editor) values(revision,'rename',p_name,p_new_name,auth.uid());
 return public.poc_load_card_annotations();
end;$$;

create or replace function public.poc_archive_card_category(p_name text,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare category public.poc_card_categories%rowtype;revision bigint;s public.poc_card_annotations%rowtype;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 select * into category from public.poc_card_categories where name=p_name;
 if category.name is null or p_expected_version is null or category.version is distinct from p_expected_version then raise exception 'poc_conflict';end if;
 if (select count(*) from poc_private.category_trash)>=128 then raise exception 'poc_category_maximum';end if;
 revision:=nextval('poc_private.revision_seq');
 insert into poc_private.category_trash(name,created_at,version,bindings,editor) values(p_name,category.created_at,revision,(select coalesce(jsonb_agg(jsonb_build_object('slot',slot,'identity_key',identity_key)),'[]') from public.poc_card_annotations where tags @> jsonb_build_array(p_name)),auth.uid());
 for s in select * from public.poc_card_annotations where tags @> jsonb_build_array(p_name) loop
  update public.poc_card_annotations set tags=tags-p_name,version=nextval('poc_private.revision_seq'),updated_at=now() where slot=s.slot returning to_jsonb(poc_card_annotations.*) into result;
  insert into poc_private.annotation_history values((result->>'version')::bigint,result,auth.uid(),now());
 end loop;
 delete from public.poc_card_categories where name=p_name;
 insert into poc_private.category_history(version,action,old_name,editor) values(revision,'archive',p_name,auth.uid());
 return public.poc_load_card_annotations();
end;$$;

create or replace function public.poc_restore_card_category(p_name text,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare category poc_private.category_trash%rowtype;revision bigint;s public.poc_card_annotations%rowtype;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 select * into category from poc_private.category_trash where name=p_name;
 if category.name is null or p_expected_version is null or category.version is distinct from p_expected_version or exists(select 1 from public.poc_card_categories where name=p_name) then raise exception 'poc_conflict';end if;
 if (select count(*) from public.poc_card_categories)>=128 then raise exception 'poc_category_maximum';end if;
 revision:=nextval('poc_private.revision_seq');
 insert into public.poc_card_categories(name,created_at,version) values(p_name,category.created_at,revision);
 -- Restore bindings only to the same current card. Preserve newer tags/links.
 for s in select a.* from public.poc_card_annotations a join poc_private.cards c on c.slot=a.slot and c.identity_key=a.identity_key and c.internal_id=a.internal_id where exists(select 1 from jsonb_array_elements(category.bindings) b where (b->>'slot')::integer=a.slot and b->>'identity_key'=a.identity_key) loop
  if jsonb_array_length(s.tags)>=12 then raise exception 'poc_category_restore_full';end if;
  update public.poc_card_annotations set tags=tags||jsonb_build_array(p_name),version=nextval('poc_private.revision_seq'),updated_at=now() where slot=s.slot returning to_jsonb(poc_card_annotations.*) into result;
  insert into poc_private.annotation_history values((result->>'version')::bigint,result,auth.uid(),now());
 end loop;
 delete from poc_private.category_trash where name=p_name;
 insert into poc_private.category_history(version,action,old_name,editor) values(revision,'restore',p_name,auth.uid());
 return public.poc_load_card_annotations();
end;$$;

revoke all on function public.poc_rename_card_category(text,text,bigint),public.poc_archive_card_category(text,bigint),public.poc_restore_card_category(text,bigint) from public,anon,authenticated;
grant execute on function public.poc_rename_card_category(text,text,bigint),public.poc_archive_card_category(text,bigint),public.poc_restore_card_category(text,bigint) to authenticated;
do $$begin
 if exists((select * from category108_annotations_before except select * from public.poc_card_annotations) union all (select * from public.poc_card_annotations except select * from category108_annotations_before)) then raise exception 'saved annotations changed';end if;
end;$$;
notify pgrst,'reload schema';
commit;
select 'tag rename/delete/restore ready; existing card tags and links preserved' as result,count(*) as categories from public.poc_card_categories;
