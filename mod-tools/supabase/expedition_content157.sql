-- Independent expedition content configuration. Does not alter accounts,
-- cards, starter decks, scenarios, editor membership or existing run saves.
begin;
do $$ begin
 if to_regprocedure('poc_private.is_editor()') is null or to_regclass('poc_private.cards') is null then
  raise exception 'poc_content_existing_catalog_required';
 end if;
end $$;
create table public.poc_expedition_content157(
 id text primary key check(id='default'),
 version bigint not null check(version between 0 and 9007199254740991),
 document jsonb not null check(jsonb_typeof(document)='object'),
 updated_at timestamptz,
 check((version=0 and updated_at is null) or (version>0 and updated_at is not null))
);
create table poc_private.expedition_content_history157(
 version bigint primary key, document jsonb not null, editor uuid not null,
 updated_at timestamptz not null
);
alter table public.poc_expedition_content157 enable row level security;
alter table poc_private.expedition_content_history157 enable row level security;
revoke all on public.poc_expedition_content157 from public,anon,authenticated;
grant select on public.poc_expedition_content157 to anon,authenticated;
revoke all on poc_private.expedition_content_history157 from public,anon,authenticated;
create policy poc_content_public_read157 on public.poc_expedition_content157 for select to anon,authenticated using(true);

create function poc_private.content_exact157(j jsonb, k text[]) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if j is null or jsonb_typeof(j) is distinct from 'object' then raise exception 'poc_content_shape'; end if;
 if not(j?&k) or (select count(*) from jsonb_object_keys(j))<>cardinality(k) then raise exception 'poc_content_shape'; end if;
end $$;
create function poc_private.content_int157(j jsonb, lo bigint, hi bigint) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if j is null or jsonb_typeof(j) is distinct from 'number' or (j#>>'{}') !~ '^[0-9]{1,16}$' then raise exception 'poc_content_integer'; end if;
 if (j#>>'{}')::bigint not between lo and hi then raise exception 'poc_content_integer'; end if;
end $$;
create function poc_private.content_text157(j jsonb, max_len integer) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if j is null or jsonb_typeof(j) is distinct from 'string' or length(btrim(j#>>'{}')) not between 1 and max_len
 or (j#>>'{}') ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'poc_content_text'; end if;
end $$;
create function poc_private.validate_content157(d jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare defaults constant jsonb := $defaults157${"schema_version":1,"kind":"poc-expedition-content","relics":[{"id":"golden_scarab","name":"황금 풍뎅이","description":"전투 승리 시 원정 금화 +20.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"restoring_ankh","name":"재생의 앙크","description":"전투 승리 시 LP 200 회복.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"card_slate","name":"카드의 석판","description":"전투 카드 보상 후보 +1. 기본 5장에서 6장으로 늘어나.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"merchant_seal","name":"상인의 인장","description":"원정 상점 가격 15% 할인.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"life_fragment","name":"생명의 조각","description":"획득 즉시 최대 LP +250. 현재 LP는 그대로야.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"kuriboh_charm","name":"크리보의 부적","description":"매 듀얼 처음 받는 LP 피해를 한 번 막아. LP를 지불하는 비용에는 적용되지 않아.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"destiny_draw","name":"운명의 패","description":"지정한 메인 덱 카드 1장이 처음 받는 4장 안에 반드시 들어와. 패 매수는 늘어나지 않아.","enabled":true,"shop_enabled":true,"weight":1,"price":250}],"events":[{"id":"healing_pool","title":"수호자의 샘","description":"돌 수호자가 별빛이 담긴 샘을 가리킨다. 작은 공물을 놓으면 상처가 아물 듯하다.","name":"금화 50을 바치고 LP 1,000 회복","effect":"원정 금화 -50 · LP +1,000 (최대 LP까지)","enabled":true,"weight":1},{"id":"life_inscription","title":"생명의 비문","description":"빛나는 비문이 맥박에 맞춰 반짝인다. 잠깐의 생명력을 내어주면 생명의 그릇을 넓힐 수 있다.","name":"LP 300을 바치고 최대 LP +500","effect":"현재 LP -300 · 최대 LP +500 (현재 LP 추가 회복 없음)","enabled":true,"weight":1},{"id":"golden_idol","title":"황금 우상의 계약","description":"황금 우상이 동전 한 줌을 내민다. 대가를 치를지, 아무것도 받지 않고 지나갈지는 너의 선택이다.","name":"LP 500을 바치고 금화 120 획득","effect":"현재 LP -500 · 원정 금화 +120","enabled":true,"weight":1},{"id":"mirror_exchange","title":"가능성의 거울","description":"거울 속 카드의 그림이 천천히 바뀐다. 카드 한 장을 비추면 같은 등급의 다른 가능성과 교환할 수 있다.","name":"보유 카드 1장을 같은 등급의 다른 카드로 교환","effect":"선택 카드 1매 영구 반납 · 같은 등급 카드 1매 획득","enabled":true,"weight":1},{"id":"card_reforge","title":"봉인된 연성로","description":"오래된 연성로에 희미한 불꽃이 남아 있다. 카드와 금화를 바치면 한 단계 높은 힘이 깨어난다.","name":"금화 75와 카드 1장을 바치고 등급 상향","effect":"원정 금화 -75 · N→R / R→SR / SR→UR 카드 1매 교환","enabled":true,"weight":1},{"id":"relic_bargain","title":"잊힌 유물의 수집가","description":"방랑하는 수집가가 아직 손에 넣지 못한 유물 하나를 펼쳐 보인다. 그는 동전 대신 생명력을 원한다.","name":"LP 800을 바치고 미보유 유물 획득","effect":"현재 LP -800 · 아직 보유하지 않은 유물 1개 획득","enabled":true,"weight":1},{"id":"card_duplication","title":"복제의 거울","description":"거울 너머에서 네 카드와 똑같은 그림이 빛난다. 카드 한 장을 비추면 그 힘을 한 번 더 손에 넣을 수 있을 듯하다.","name":"보유 카드 1장을 골라 같은 카드 1장 획득","effect":"선택 카드 +1매 · 원정 카드함에 보관 · 덱에는 자동으로 넣지 않아.","enabled":true,"weight":1}],"shop":{"card_count":5,"relic_count":3,"card_pool_mode":"all","card_pool":[],"rarity_weights":{"N":50,"R":42,"SR":6,"UR":2},"card_prices":{"N":50,"R":100,"SR":180,"UR":300},"removal_price":75,"removal_increase":25}}$defaults157$::jsonb;
 row jsonb; def jsonb; j jsonb; s jsonb; k text; seen text[]; weights bigint:=0;
begin
 perform poc_private.content_exact157(d,array['schema_version','kind','relics','events','shop']);
 if octet_length(d::text)>600000 or d->'schema_version' is distinct from '1'::jsonb
 or d->>'kind' is distinct from 'poc-expedition-content' then raise exception 'poc_content_document'; end if;
 if jsonb_typeof(d->'relics') is distinct from 'array' or jsonb_typeof(d->'events') is distinct from 'array' then raise exception 'poc_content_registry'; end if;
 if jsonb_array_length(d->'relics')<>7 or jsonb_array_length(d->'events')<>7 then raise exception 'poc_content_registry'; end if;
 seen:=array[]::text[];
 for row in select value from jsonb_array_elements(d->'relics') loop
  perform poc_private.content_exact157(row,array['id','name','description','enabled','shop_enabled','weight','price']);
  if jsonb_typeof(row->'id') is distinct from 'string' or row->>'id'=any(seen) then raise exception 'poc_content_registry'; end if;
  select value into def from jsonb_array_elements(defaults->'relics') where value->>'id'=row->>'id';
  if not found then raise exception 'poc_content_registry'; end if;
  seen:=array_append(seen,row->>'id');
  perform poc_private.content_text157(row->'name',100);
  perform poc_private.content_text157(row->'description',2000);
  if jsonb_typeof(row->'enabled') is distinct from 'boolean' or jsonb_typeof(row->'shop_enabled') is distinct from 'boolean' then raise exception 'poc_content_boolean'; end if;
  perform poc_private.content_int157(row->'weight',0,10000);
  perform poc_private.content_int157(row->'price',0,2000000000);
 end loop;
 seen:=array[]::text[];
 for row in select value from jsonb_array_elements(d->'events') loop
  perform poc_private.content_exact157(row,array['id','title','description','name','effect','enabled','weight']);
  if jsonb_typeof(row->'id') is distinct from 'string' or row->>'id'=any(seen) then raise exception 'poc_content_registry'; end if;
  select value into def from jsonb_array_elements(defaults->'events') where value->>'id'=row->>'id';
  if not found or row->'effect' is distinct from def->'effect' then raise exception 'poc_content_effect'; end if;
  seen:=array_append(seen,row->>'id');
  perform poc_private.content_text157(row->'title',100);
  perform poc_private.content_text157(row->'description',4000);
  perform poc_private.content_text157(row->'name',250);
  if jsonb_typeof(row->'enabled') is distinct from 'boolean' then raise exception 'poc_content_boolean'; end if;
  perform poc_private.content_int157(row->'weight',0,10000);
 end loop;
 s:=d->'shop';
 perform poc_private.content_exact157(s,array['card_count','relic_count','card_pool_mode','card_pool','rarity_weights','card_prices','removal_price','removal_increase']);
 perform poc_private.content_int157(s->'card_count',1,10);
 perform poc_private.content_int157(s->'relic_count',0,5);
 perform poc_private.content_int157(s->'removal_price',0,2000000000);
 perform poc_private.content_int157(s->'removal_increase',0,2000000000);
 if jsonb_typeof(s->'card_pool_mode') is distinct from 'string' or s->>'card_pool_mode' not in ('all','selected')
 or jsonb_typeof(s->'card_pool') is distinct from 'array' then raise exception 'poc_content_pool'; end if;
 if jsonb_array_length(s->'card_pool')>2047 then raise exception 'poc_content_pool'; end if;
 seen:=array[]::text[];
 for j in select value from jsonb_array_elements(s->'card_pool') loop
  if jsonb_typeof(j) is distinct from 'string' or (j#>>'{}') !~ '^[a-f0-9]{64}$' or (j#>>'{}')=any(seen) then raise exception 'poc_content_pool'; end if;
  if not exists(select 1 from poc_private.cards where identity_key=j#>>'{}' and not special and speed_limit is distinct from 0) then raise exception 'poc_content_pool'; end if;
  seen:=array_append(seen,j#>>'{}');
 end loop;
 perform poc_private.content_exact157(s->'rarity_weights',array['N','R','SR','UR']);
 perform poc_private.content_exact157(s->'card_prices',array['N','R','SR','UR']);
 foreach k in array array['N','R','SR','UR'] loop
  perform poc_private.content_int157(s->'rarity_weights'->k,0,10000);
  perform poc_private.content_int157(s->'card_prices'->k,0,2000000000);
  weights:=weights+(s->'rarity_weights'->>k)::bigint;
 end loop;
 if weights=0 then raise exception 'poc_content_weights'; end if;
end $$;
revoke all on function poc_private.content_exact157(jsonb,text[]) from public,anon,authenticated;
revoke all on function poc_private.content_int157(jsonb,bigint,bigint) from public,anon,authenticated;
revoke all on function poc_private.content_text157(jsonb,integer) from public,anon,authenticated;
revoke all on function poc_private.validate_content157(jsonb) from public,anon,authenticated;

-- Version zero is the full registered default and is not a user-created pack,
-- starter deck or run. Its null date matches the shared editor/worker codec.
insert into public.poc_expedition_content157(id,version,document,updated_at)
values('default',0,$defaults157${"schema_version":1,"kind":"poc-expedition-content","relics":[{"id":"golden_scarab","name":"황금 풍뎅이","description":"전투 승리 시 원정 금화 +20.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"restoring_ankh","name":"재생의 앙크","description":"전투 승리 시 LP 200 회복.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"card_slate","name":"카드의 석판","description":"전투 카드 보상 후보 +1. 기본 5장에서 6장으로 늘어나.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"merchant_seal","name":"상인의 인장","description":"원정 상점 가격 15% 할인.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"life_fragment","name":"생명의 조각","description":"획득 즉시 최대 LP +250. 현재 LP는 그대로야.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"kuriboh_charm","name":"크리보의 부적","description":"매 듀얼 처음 받는 LP 피해를 한 번 막아. LP를 지불하는 비용에는 적용되지 않아.","enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"destiny_draw","name":"운명의 패","description":"지정한 메인 덱 카드 1장이 처음 받는 4장 안에 반드시 들어와. 패 매수는 늘어나지 않아.","enabled":true,"shop_enabled":true,"weight":1,"price":250}],"events":[{"id":"healing_pool","title":"수호자의 샘","description":"돌 수호자가 별빛이 담긴 샘을 가리킨다. 작은 공물을 놓으면 상처가 아물 듯하다.","name":"금화 50을 바치고 LP 1,000 회복","effect":"원정 금화 -50 · LP +1,000 (최대 LP까지)","enabled":true,"weight":1},{"id":"life_inscription","title":"생명의 비문","description":"빛나는 비문이 맥박에 맞춰 반짝인다. 잠깐의 생명력을 내어주면 생명의 그릇을 넓힐 수 있다.","name":"LP 300을 바치고 최대 LP +500","effect":"현재 LP -300 · 최대 LP +500 (현재 LP 추가 회복 없음)","enabled":true,"weight":1},{"id":"golden_idol","title":"황금 우상의 계약","description":"황금 우상이 동전 한 줌을 내민다. 대가를 치를지, 아무것도 받지 않고 지나갈지는 너의 선택이다.","name":"LP 500을 바치고 금화 120 획득","effect":"현재 LP -500 · 원정 금화 +120","enabled":true,"weight":1},{"id":"mirror_exchange","title":"가능성의 거울","description":"거울 속 카드의 그림이 천천히 바뀐다. 카드 한 장을 비추면 같은 등급의 다른 가능성과 교환할 수 있다.","name":"보유 카드 1장을 같은 등급의 다른 카드로 교환","effect":"선택 카드 1매 영구 반납 · 같은 등급 카드 1매 획득","enabled":true,"weight":1},{"id":"card_reforge","title":"봉인된 연성로","description":"오래된 연성로에 희미한 불꽃이 남아 있다. 카드와 금화를 바치면 한 단계 높은 힘이 깨어난다.","name":"금화 75와 카드 1장을 바치고 등급 상향","effect":"원정 금화 -75 · N→R / R→SR / SR→UR 카드 1매 교환","enabled":true,"weight":1},{"id":"relic_bargain","title":"잊힌 유물의 수집가","description":"방랑하는 수집가가 아직 손에 넣지 못한 유물 하나를 펼쳐 보인다. 그는 동전 대신 생명력을 원한다.","name":"LP 800을 바치고 미보유 유물 획득","effect":"현재 LP -800 · 아직 보유하지 않은 유물 1개 획득","enabled":true,"weight":1},{"id":"card_duplication","title":"복제의 거울","description":"거울 너머에서 네 카드와 똑같은 그림이 빛난다. 카드 한 장을 비추면 그 힘을 한 번 더 손에 넣을 수 있을 듯하다.","name":"보유 카드 1장을 골라 같은 카드 1장 획득","effect":"선택 카드 +1매 · 원정 카드함에 보관 · 덱에는 자동으로 넣지 않아.","enabled":true,"weight":1}],"shop":{"card_count":5,"relic_count":3,"card_pool_mode":"all","card_pool":[],"rarity_weights":{"N":50,"R":42,"SR":6,"UR":2},"card_prices":{"N":50,"R":100,"SR":180,"UR":300},"removal_price":75,"removal_increase":25}}$defaults157$::jsonb,null);
select poc_private.validate_content157(document) from public.poc_expedition_content157 where id='default';
create function public.read_poc_expedition_content157() returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('schema',1,'kind','poc-expedition-content-library',
  'version',version,'document',document,'updated_at',updated_at)
 from public.poc_expedition_content157 where id='default';
$$;
revoke all on function public.read_poc_expedition_content157() from public;
grant execute on function public.read_poc_expedition_content157() to anon,authenticated;

-- Narrow authorized writer follows the existing starter/scenario editor API.
-- A definer is needed for private catalog validation and private audit history;
-- no private-schema usage or direct client write privileges are granted.
create function public.save_poc_expedition_content157(p_document jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare old_version bigint; new_version bigint; stamp timestamptz:=now();
begin
 if auth.uid() is null or not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_expected_version is null or p_expected_version not between 0 and 9007199254740990 then raise exception 'poc_content_conflict'; end if;
 perform poc_private.validate_content157(p_document);
 perform pg_advisory_xact_lock(hashtextextended('poc-expedition-content157',0));
 select version into old_version from public.poc_expedition_content157 where id='default';
 if old_version is null or old_version is distinct from p_expected_version then raise exception 'poc_content_conflict'; end if;
 new_version:=old_version+1;
 update public.poc_expedition_content157 set version=new_version,document=p_document,updated_at=stamp where id='default';
 insert into poc_private.expedition_content_history157(version,document,editor,updated_at) values(new_version,p_document,auth.uid(),stamp);
 return jsonb_build_object('schema',1,'kind','poc-expedition-content-library','version',new_version,'document',p_document,'updated_at',stamp);
end $$;
revoke all on function public.save_poc_expedition_content157(jsonb,bigint) from public,anon;
grant execute on function public.save_poc_expedition_content157(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
