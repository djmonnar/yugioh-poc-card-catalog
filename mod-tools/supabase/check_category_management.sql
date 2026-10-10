-- Real RPC checks inside a rolled-back transaction; no user's tag is changed.
create temporary table category108_before as select
 (select md5(coalesce(jsonb_agg(to_jsonb(a) order by slot),'[]')::text) from public.poc_card_annotations a) annotations,
 (select md5(coalesce(jsonb_agg(to_jsonb(c) order by name),'[]')::text) from public.poc_card_categories c) categories,
 (select md5(coalesce(jsonb_agg(to_jsonb(s) order by id),'[]')::text) from public.poc_stories s) stories,
 (select md5(coalesce(jsonb_agg(to_jsonb(d) order by filename),'[]')::text) from public.poc_ai_decks d) decks;
alter table category108_before enable row level security;
do $$declare
 uid uuid;c poc_private.cards%rowtype;l poc_private.cards%rowtype;dataset text;
 a jsonb;b jsonb;state jsonb;v bigint;rv bigint;name text:='검사108_임시태그';other text:='검사108_다른태그';renamed text:='검사108_이름변경';
begin
 select u.id into uid from auth.users u join poc_private.editors e on lower(u.email)=e.email where u.email_confirmed_at is not null limit 1;
 if uid is null then raise exception 'no existing editor for regression';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 if not poc_private.is_editor() then raise exception 'editor setup failed';end if;
 select * into c from poc_private.cards where not exists(select 1 from public.poc_card_annotations a where a.slot=poc_private.cards.slot) order by slot limit 1;
 select * into l from poc_private.cards where slot<>c.slot order by slot limit 1;
 select catalog.dataset into dataset from poc_private.catalog limit 1;
 if c.slot is null or l.slot is null then raise exception 'no isolated card fixture';end if;
 a:=public.poc_create_card_category(name);v:=(a->>'version')::bigint;
 if public.poc_create_card_category(name)<>a then raise exception 'idempotent create failed';end if;
 perform public.poc_create_card_category(other);
 a:=public.poc_save_card_annotation(dataset,c.slot,c.identity_key,jsonb_build_array(name,other),jsonb_build_array(jsonb_build_object('slot',l.slot,'identity_key',l.identity_key)),0);
 begin perform public.poc_rename_card_category(name,other,v);raise exception 'duplicate rename accepted';exception when others then if sqlerrm<>'poc_category_exists' then raise;end if;end;
 begin perform public.poc_rename_card_category(name,'',v);raise exception 'empty rename accepted';exception when others then if sqlerrm<>'poc_invalid_category' then raise;end if;end;
 state:=public.poc_rename_card_category(name,renamed,v);
 select value into b from jsonb_array_elements(state->'annotations') where (value->>'slot')::integer=c.slot;
 if not b->'tags' @> jsonb_build_array(renamed,other) or b->'tags' @> jsonb_build_array(name) or b->'links'<>a->'links' or b->>'identity_key'<>a->>'identity_key' or (b->>'version')::bigint<=(a->>'version')::bigint then raise exception 'rename propagation failed';end if;
 begin perform public.poc_archive_card_category(name,v);raise exception 'stale category accepted';exception when others then if sqlerrm<>'poc_conflict' then raise;end if;end;
 begin perform public.poc_save_card_annotation(dataset,c.slot,c.identity_key,jsonb_build_array(other),a->'links',(a->>'version')::bigint);raise exception 'stale annotation accepted';exception when others then if sqlerrm<>'poc_conflict' then raise;end if;end;
 select (value->>'version')::bigint into rv from jsonb_array_elements(state->'categories') where value->>'name'=renamed;
 state:=public.poc_archive_card_category(renamed,rv);
 select value into b from jsonb_array_elements(state->'annotations') where (value->>'slot')::integer=c.slot;
 if b->'tags'<>jsonb_build_array(other) or b->'links'<>a->'links' then raise exception 'archive removed other data';end if;
 begin perform public.poc_create_card_category(renamed);raise exception 'deleted name recreated';exception when others then if sqlerrm<>'poc_category_deleted' then raise;end if;end;
 begin perform public.poc_save_card_annotation(dataset,c.slot,c.identity_key,jsonb_build_array(renamed),a->'links',(b->>'version')::bigint);raise exception 'deleted tag saved';exception when others then if sqlerrm<>'poc_invalid_category' then raise;end if;end;
 select (value->>'version')::bigint into rv from jsonb_array_elements(state->'deleted_categories') where value->>'name'=renamed;
 state:=public.poc_restore_card_category(renamed,rv);
 select value into b from jsonb_array_elements(state->'annotations') where (value->>'slot')::integer=c.slot;
 if not b->'tags' @> jsonb_build_array(renamed,other) or b->'links'<>a->'links' or jsonb_array_length(state->'deleted_categories')<>0 then raise exception 'restore bindings failed';end if;
 begin perform public.poc_restore_card_category(renamed,rv);raise exception 'repeated restore accepted';exception when others then if sqlerrm<>'poc_conflict' then raise;end if;end;
 select (value->>'version')::bigint into rv from jsonb_array_elements(state->'categories') where value->>'name'=renamed;
 state:=public.poc_archive_card_category(renamed,rv);
 select (value->>'version')::bigint into rv from jsonb_array_elements(state->'deleted_categories') where value->>'name'=renamed;
 -- Simulate a replaced card. Restoring a tag may not transfer its old binding.
 update public.poc_card_annotations set identity_key=repeat('f',64) where slot=c.slot;
 state:=public.poc_restore_card_category(renamed,rv);
 if exists(select 1 from public.poc_card_annotations where slot=c.slot and tags @> jsonb_build_array(renamed)) then raise exception 'binding transferred to replacement';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 if jsonb_array_length(public.poc_load_card_annotations()->'deleted_categories')<>0 then raise exception 'private trash exposed';end if;
 begin perform public.poc_create_card_category('검사108_비인가');raise exception 'anonymous edit accepted';exception when others then if sqlerrm<>'poc_editor_required' then raise;end if;end;
 raise exception 'fixture rollback completed' using errcode='Z0108';
exception when sqlstate 'Z0108' then null; -- roll back the whole DO subtransaction
end;$$;
do $$begin
 if not exists(select 1 from category108_before b where
 b.annotations=(select md5(coalesce(jsonb_agg(to_jsonb(a) order by slot),'[]')::text) from public.poc_card_annotations a) and
 b.categories=(select md5(coalesce(jsonb_agg(to_jsonb(c) order by name),'[]')::text) from public.poc_card_categories c) and
 b.stories=(select md5(coalesce(jsonb_agg(to_jsonb(s) order by id),'[]')::text) from public.poc_stories s) and
 b.decks=(select md5(coalesce(jsonb_agg(to_jsonb(d) order by filename),'[]')::text) from public.poc_ai_decks d)) then raise exception 'existing authored data changed';end if;
 drop table category108_before;
end;$$;
select 'passed: real tag RPC create/rename/archive/restore, conflicts, identity guard, auth; all fixture edits rolled back; existing tags/links/decks/scenarios unchanged' as result;
