-- Same independent content row and CAS lock as157. Only new runs use v2.
begin;
create function poc_private.defaults158() returns jsonb
language sql immutable security invoker set search_path=pg_catalog as $$
 select $content158${"schema_version":2,"kind":"poc-expedition-content","relics":[{"id":"golden_scarab","name":"황금 풍뎅이","description":"전투 승리 시 원정 금화 +20.","rarity":"R","params":{"gold":20},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"restoring_ankh","name":"재생의 앙크","description":"전투 승리 시 LP 200 회복.","rarity":"R","params":{"lp":200},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"card_slate","name":"카드의 석판","description":"전투 카드 보상 후보 +1. 기본 5장에서 6장으로 늘어나.","rarity":"SR","params":{"extra_choices":1},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"merchant_seal","name":"상인의 인장","description":"원정 상점 가격 15% 할인.","rarity":"R","params":{"discount_percent":15},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"life_fragment","name":"생명의 조각","description":"획득 즉시 최대 LP +250. 현재 LP는 그대로야.","rarity":"N","params":{"max_lp":250},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"kuriboh_charm","name":"크리보의 부적","description":"매 듀얼 처음 받는 LP 피해를 한 번 막아. LP를 지불하는 비용에는 적용되지 않아.","rarity":"SR","params":{},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"destiny_draw","name":"운명의 패","description":"지정한 메인 덱 카드 1장이 처음 받는 4장 안에 반드시 들어와. 패 매수는 늘어나지 않아.","rarity":"UR","params":{},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"field_legacy","name":"태고의 지형","description":"획득한 뒤 허용된 지형 중 하나를 고르면 이후 듀얼을 그 필드 마법과 함께 시작해.","rarity":"SR","params":{"fields":["mountain","sogen","yami","umi","forest","wasteland"]},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"draw_scroll","name":"드로우 두루마리","description":"원정 중 원하는 듀얼에서 사용할 수 있는 드로우 1회분.","rarity":"R","params":{"charges":1,"draw":1},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"draw_tome","name":"드로우 마도서","description":"원정 중 원하는 듀얼에서 나누어 사용할 수 있는 드로우 2회분.","rarity":"SR","params":{"charges":2,"draw":1},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"healing_potion","name":"생명의 물약","description":"듀얼 중 LP를 500 회복하는 원정 소모품.","rarity":"N","params":{"charges":1,"heal":500},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"greater_healing_potion","name":"상급 생명의 물약","description":"듀얼 중 LP를 1,000 회복하는 원정 소모품.","rarity":"R","params":{"charges":1,"heal":1000},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"rare_cache","name":"희귀 카드 보급함","description":"획득 즉시 무작위 R 카드 2장을 원정 카드함에 받아.","rarity":"R","params":{"count":2,"rarity":"R"},"enabled":true,"shop_enabled":true,"weight":1,"price":250},{"id":"fusion_cache","name":"융합술사의 보급함","description":"융합 마법 1장, 무작위 정식 융합 몬스터 1장과 그 정식 소재를 각각 2장 받아.","rarity":"SR","params":{"material_copies":2},"enabled":true,"shop_enabled":true,"weight":1,"price":250}],"events":[{"id":"healing_pool","title":"수호자의 샘","description":"돌 수호자가 별빛이 담긴 샘을 가리킨다. 작은 공물을 놓으면 상처가 아물 듯하다.","name":"금화 50을 바치고 LP 1,000 회복","effect":"원정 금화 -50 · LP +1,000 (최대 LP까지)","params":{},"enabled":true,"weight":1},{"id":"life_inscription","title":"생명의 비문","description":"빛나는 비문이 맥박에 맞춰 반짝인다. 잠깐의 생명력을 내어주면 생명의 그릇을 넓힐 수 있다.","name":"LP 300을 바치고 최대 LP +500","effect":"현재 LP -300 · 최대 LP +500 (현재 LP 추가 회복 없음)","params":{},"enabled":true,"weight":1},{"id":"golden_idol","title":"황금 우상의 계약","description":"황금 우상이 동전 한 줌을 내민다. 대가를 치를지, 아무것도 받지 않고 지나갈지는 너의 선택이다.","name":"LP 500을 바치고 금화 120 획득","effect":"현재 LP -500 · 원정 금화 +120","params":{},"enabled":true,"weight":1},{"id":"mirror_exchange","title":"가능성의 거울","description":"거울 속 카드의 그림이 천천히 바뀐다. 카드 한 장을 비추면 같은 등급의 다른 가능성과 교환할 수 있다.","name":"보유 카드 1장을 같은 등급의 다른 카드로 교환","effect":"선택 카드 1매 영구 반납 · 같은 등급 카드 1매 획득","params":{},"enabled":true,"weight":1},{"id":"card_reforge","title":"봉인된 연성로","description":"오래된 연성로에 희미한 불꽃이 남아 있다. 카드와 금화를 바치면 한 단계 높은 힘이 깨어난다.","name":"금화 75와 카드 1장을 바치고 등급 상향","effect":"원정 금화 -75 · N→R / R→SR / SR→UR 카드 1매 교환","params":{},"enabled":true,"weight":1},{"id":"relic_bargain","title":"잊힌 유물의 수집가","description":"방랑하는 수집가가 아직 손에 넣지 못한 유물 하나를 펼쳐 보인다. 그는 동전 대신 생명력을 원한다.","name":"LP 800을 바치고 미보유 유물 획득","effect":"현재 LP -800 · 아직 보유하지 않은 유물 1개 획득","params":{},"enabled":true,"weight":1},{"id":"card_duplication","title":"복제의 거울","description":"거울 너머에서 네 카드와 똑같은 그림이 빛난다. 카드 한 장을 비추면 그 힘을 한 번 더 손에 넣을 수 있을 듯하다.","name":"보유 카드 1장을 골라 같은 카드 1장 획득","effect":"선택 카드 +1매 · 원정 카드함에 보관 · 덱에는 자동으로 넣지 않아.","params":{},"enabled":true,"weight":1},{"id":"race_blessing","title":"종족의 수호 문장","description":"오래된 문장이 여러 종족의 모습으로 바뀐다. 앞으로 함께할 몬스터의 종족을 골라보자.","name":"종족을 고르고 이후 몬스터 카드 보상에서 더 자주 만나기","effect":"선택 종족의 몬스터 카드 보상 가중치 상승 · 새 선택으로 이전 선택 교체","params":{"multiplier":3},"enabled":true,"weight":1},{"id":"challenge_duel","title":"선택받은 자의 결투","description":"봉인된 문 너머에서 도전자가 기다린다. 승리하면 특별한 SR 보상을 받지만, 평소 전투 보상은 얻지 못한다.","name":"상대를 골라 특별 결투에 도전","effect":"특별 전투 승리 시 SR 후보 3장 중 1장 · 일반 전투 보상 없음 · 도전 거절 가능","params":{"encounter_key":null},"enabled":true,"weight":1},{"id":"relic_recovery","title":"잊힌 제단의 공양","description":"제단이 네 유물 하나를 요구한다. 그 힘을 돌려주면 지친 생명력을 모두 되찾을 수 있다.","name":"보유 유물 1개를 잃고 LP 전부 회복","effect":"선택 유물 1개 영구 제거 · LP를 최대 LP까지 회복","params":{},"enabled":true,"weight":1},{"id":"twin_sacrifice","title":"쌍둥이 카드의 제단","description":"제단의 두 홈이 비어 있다. 덱에 담긴 카드 두 장을 바치면 더 강한 가능성을 고를 수 있다.","name":"덱 카드 2장을 바치고 SR 후보 5장 중 1장 선택","effect":"활성 덱 카드 정확히 2매 영구 제거 · SR 후보 5장 중 1장 · 메인 덱 최소 20장 유지","params":{"remove_count":2,"reward_count":5,"rarity":"SR"},"enabled":true,"weight":1}],"shop":{"card_count":5,"relic_count":3,"card_pool_mode":"all","card_pool":[],"rarity_weights":{"N":50,"R":42,"SR":6,"UR":2},"card_prices":{"N":50,"R":100,"SR":180,"UR":300},"removal_price":75,"removal_increase":25,"fixed_cards":[],"fixed_relics":[],"fusion_pair_count":1,"ritual_pair_count":1}}$content158$::jsonb;
$$;
revoke all on function poc_private.defaults158() from public,anon,authenticated;

create function poc_private.params158(id text,p jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare k text; hi bigint; lo bigint:=0; item jsonb; seen text[]:=array[]::text[];
begin
 case id
 when 'golden_scarab' then k:='gold';hi:=2000000000;
 when 'restoring_ankh' then k:='lp';hi:=60000;
 when 'card_slate' then k:='extra_choices';hi:=5;
 when 'merchant_seal' then k:='discount_percent';hi:=100;
 when 'life_fragment' then k:='max_lp';hi:=60000;
 when 'race_blessing' then k:='multiplier';lo:=1;hi:=100;
 else k:=null;
 end case;
 if k is not null then
  perform poc_private.content_exact157(p,array[k]);perform poc_private.content_int157(p->k,lo,hi);return;
 end if;
 if id in ('kuriboh_charm','destiny_draw','healing_pool','life_inscription','golden_idol','mirror_exchange','card_reforge','relic_bargain','card_duplication','relic_recovery') then
  perform poc_private.content_exact157(p,array[]::text[]);return;
 elsif id='field_legacy' then
  perform poc_private.content_exact157(p,array['fields']);
  if jsonb_typeof(p->'fields') is distinct from 'array' then raise exception 'poc_content_field';end if;
  if jsonb_array_length(p->'fields') not between 1 and 6 then raise exception 'poc_content_field';end if;
  for item in select value from jsonb_array_elements(p->'fields') loop
   if jsonb_typeof(item) is distinct from 'string' or item#>>'{}' not in ('mountain','sogen','yami','umi','forest','wasteland') or item#>>'{}'=any(seen) then raise exception 'poc_content_field';end if;
   seen:=array_append(seen,item#>>'{}');
  end loop;
 elsif id in ('draw_scroll','draw_tome') then
  perform poc_private.content_exact157(p,array['charges','draw']);perform poc_private.content_int157(p->'charges',1,10);
  if p->'draw' is distinct from '1'::jsonb then raise exception 'poc_content_draw';end if;
 elsif id in ('healing_potion','greater_healing_potion') then
  perform poc_private.content_exact157(p,array['charges','heal']);perform poc_private.content_int157(p->'charges',1,10);perform poc_private.content_int157(p->'heal',1,60000);
 elsif id='rare_cache' then
  perform poc_private.content_exact157(p,array['count','rarity']);perform poc_private.content_int157(p->'count',1,10);
  if p->'rarity' is distinct from '"R"'::jsonb then raise exception 'poc_content_rarity';end if;
 elsif id='fusion_cache' then
  perform poc_private.content_exact157(p,array['material_copies']);perform poc_private.content_int157(p->'material_copies',1,3);
 elsif id='challenge_duel' then
  perform poc_private.content_exact157(p,array['encounter_key']);
  if p->'encounter_key' is distinct from 'null'::jsonb and (jsonb_typeof(p->'encounter_key') is distinct from 'string' or p->>'encounter_key' !~ '^[A-Za-z0-9_:-]{1,210}$') then raise exception 'poc_content_encounter';end if;
 elsif id='twin_sacrifice' then
  if p is distinct from '{"remove_count":2,"reward_count":5,"rarity":"SR"}'::jsonb then raise exception 'poc_content_sacrifice';end if;
 else raise exception 'poc_content_effect';
 end if;
end $$;
revoke all on function poc_private.params158(text,jsonb) from public,anon,authenticated;

create function poc_private.eligible_card158(k text) returns boolean
language sql stable security invoker set search_path=pg_catalog as $$
 select exists(select 1 from poc_private.cards c
  left join public.poc_card_limits l on l.slot=c.slot and l.internal_id=c.internal_id and l.identity_key=c.identity_key
  left join public.poc_card_settings s on s.slot=c.slot and s.internal_id=c.internal_id and s.identity_key=c.identity_key
  where c.identity_key=k and not c.special
   and (case when l.slot is not null then l.speed_limit else c.speed_limit end) is distinct from 0
   and coalesce(l.normal_limit,c.limited,3)<>0
   and coalesce(s.rarity,'N') in ('N','R','SR','UR') and s.draw_enabled is distinct from false);
$$;
revoke all on function poc_private.eligible_card158(text) from public,anon,authenticated;

create function poc_private.validate_content158(d jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare defaults jsonb:=poc_private.defaults158(); row jsonb; def jsonb; j jsonb; s jsonb; seen text[]; old jsonb;
 old_relics jsonb:='[]';old_events jsonb:='[]';
 legacy_ids text[]:=array['golden_scarab','restoring_ankh','card_slate','merchant_seal','life_fragment','kuriboh_charm','destiny_draw'];
 legacy_events text[]:=array['healing_pool','life_inscription','golden_idol','mirror_exchange','card_reforge','relic_bargain','card_duplication'];
begin
 perform poc_private.content_exact157(d,array['schema_version','kind','relics','events','shop']);
 if octet_length(d::text)>600000 or d->'schema_version' is distinct from '2'::jsonb or d->>'kind' is distinct from 'poc-expedition-content'
 or jsonb_typeof(d->'relics') is distinct from 'array' or jsonb_typeof(d->'events') is distinct from 'array' then raise exception 'poc_content_document';end if;
 if jsonb_array_length(d->'relics')<>14 or jsonb_array_length(d->'events')<>11 then raise exception 'poc_content_registry';end if;
 seen:=array[]::text[];
 for row in select value from jsonb_array_elements(d->'relics') loop
  perform poc_private.content_exact157(row,array['id','name','description','enabled','shop_enabled','weight','price','rarity','params']);
  select value into def from jsonb_array_elements(defaults->'relics') where value->>'id'=row->>'id';
  if not found or row->>'id'=any(seen) then raise exception 'poc_content_registry';end if;
  seen:=array_append(seen,row->>'id');
  perform poc_private.content_text157(row->'name',100);perform poc_private.content_text157(row->'description',2000);
  perform poc_private.content_int157(row->'weight',0,10000);perform poc_private.content_int157(row->'price',0,2000000000);
  if jsonb_typeof(row->'enabled') is distinct from 'boolean' or jsonb_typeof(row->'shop_enabled') is distinct from 'boolean' or jsonb_typeof(row->'rarity') is distinct from 'string' or row->>'rarity' not in ('N','R','SR','UR') then raise exception 'poc_content_type';end if;
  perform poc_private.params158(row->>'id',row->'params');
  if row->>'id'=any(legacy_ids) then old_relics:=old_relics||jsonb_build_array(row-'rarity'-'params');end if;
 end loop;
 seen:=array[]::text[];
 for row in select value from jsonb_array_elements(d->'events') loop
  perform poc_private.content_exact157(row,array['id','title','description','name','effect','enabled','weight','params']);
  select value into def from jsonb_array_elements(defaults->'events') where value->>'id'=row->>'id';
  if not found or row->>'id'=any(seen) or row->'effect' is distinct from def->'effect' then raise exception 'poc_content_effect';end if;
  seen:=array_append(seen,row->>'id');
  perform poc_private.content_text157(row->'title',100);perform poc_private.content_text157(row->'description',4000);perform poc_private.content_text157(row->'name',250);
  if jsonb_typeof(row->'enabled') is distinct from 'boolean' then raise exception 'poc_content_type';end if;
  perform poc_private.content_int157(row->'weight',0,10000);perform poc_private.params158(row->>'id',row->'params');
  if row->>'id'=any(legacy_events) then old_events:=old_events||jsonb_build_array(row-'params');end if;
 end loop;
 s:=d->'shop';perform poc_private.content_exact157(s,array['card_count','relic_count','card_pool_mode','card_pool','rarity_weights','card_prices','removal_price','removal_increase','fixed_cards','fixed_relics','fusion_pair_count','ritual_pair_count']);
 if s->'fusion_pair_count' is distinct from '1'::jsonb or s->'ritual_pair_count' is distinct from '1'::jsonb then raise exception 'poc_content_pair';end if;
 if jsonb_typeof(s->'fixed_cards') is distinct from 'array' or jsonb_typeof(s->'fixed_relics') is distinct from 'array' then raise exception 'poc_content_fixed';end if;
 if jsonb_array_length(s->'fixed_cards')>100 or jsonb_array_length(s->'fixed_relics')>14 then raise exception 'poc_content_fixed';end if;
 seen:=array[]::text[];
 for j in select value from jsonb_array_elements(s->'fixed_cards') loop
  if jsonb_typeof(j) is distinct from 'string' or j#>>'{}' !~ '^[a-f0-9]{64}$' or j#>>'{}'=any(seen) then raise exception 'poc_content_fixed';end if;
  if not poc_private.eligible_card158(j#>>'{}') then raise exception 'poc_content_fixed';end if;
  seen:=array_append(seen,j#>>'{}');
 end loop;
 seen:=array[]::text[];
 for j in select value from jsonb_array_elements(s->'fixed_relics') loop
  if jsonb_typeof(j) is distinct from 'string' or j#>>'{}'=any(seen) or not exists(select 1 from jsonb_array_elements(defaults->'relics') where value->'id'=j) then raise exception 'poc_content_fixed';end if;
  seen:=array_append(seen,j#>>'{}');
 end loop;
 -- Reuse the frozen validator for all unchanged157 prose, pool/price/weight
 -- rules. This never modifies the legacy validator or its existing content.
 old:=jsonb_build_object('schema_version',1,'kind','poc-expedition-content','relics',old_relics,'events',old_events,'shop',s-'fixed_cards'-'fixed_relics'-'fusion_pair_count'-'ritual_pair_count');
 perform poc_private.validate_content157(old);
 for j in select value from jsonb_array_elements(s->'card_pool') loop
  if not poc_private.eligible_card158(j#>>'{}') then raise exception 'poc_content_pool';end if;
 end loop;
end $$;
revoke all on function poc_private.validate_content158(jsonb) from public,anon,authenticated;

create table poc_private.expedition_content_history158(
 version bigint primary key,document jsonb not null,previous_document jsonb not null,
 editor uuid,source text not null check(source in ('migration157','editor')),
 updated_at timestamptz not null,check(source='migration157' or editor is not null)
);
alter table poc_private.expedition_content_history158 enable row level security;
revoke all on poc_private.expedition_content_history158 from public,anon,authenticated;

-- The exact old writer lock prevents a concurrent157 save from being lost.
select pg_advisory_xact_lock(hashtextextended('poc-expedition-content157',0));
do $$
declare old jsonb; migrated jsonb:=poc_private.defaults158(); current_version bigint; stamp timestamptz:=now();
begin
 select document,version into strict old,current_version from public.poc_expedition_content157 where id='default' for update;
 perform poc_private.validate_content157(old);
 if current_version>=9007199254740991 then raise exception 'poc_content_version_full';end if;
 migrated:=jsonb_set(migrated,'{relics}',(select jsonb_agg(def||coalesce(prior,'{}'::jsonb) order by ord)
  from jsonb_array_elements(migrated->'relics') with ordinality a(def,ord)
  left join lateral (select value prior from jsonb_array_elements(old->'relics') where value->>'id'=def->>'id') p on true));
 migrated:=jsonb_set(migrated,'{events}',(select jsonb_agg(def||coalesce(prior,'{}'::jsonb) order by ord)
  from jsonb_array_elements(migrated->'events') with ordinality a(def,ord)
  left join lateral (select value prior from jsonb_array_elements(old->'events') where value->>'id'=def->>'id') p on true));
 migrated:=jsonb_set(migrated,'{shop}',(migrated->'shop')||(old->'shop'));
 perform poc_private.validate_content158(migrated);
 insert into poc_private.expedition_content_history158 values(current_version+1,migrated,old,null,'migration157',stamp);
 update public.poc_expedition_content157 set version=current_version+1,document=migrated,updated_at=stamp where id='default';
end $$;
revoke execute on function public.save_poc_expedition_content157(jsonb,bigint) from public,anon,authenticated;

create function public.read_poc_expedition_content158() returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('schema',1,'kind','poc-expedition-content-library','version',version,'document',document,'updated_at',updated_at)
 from public.poc_expedition_content157 where id='default';
$$;
revoke all on function public.read_poc_expedition_content158() from public;
grant execute on function public.read_poc_expedition_content158() to anon,authenticated;

create function public.save_poc_expedition_content158(p_document jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare old_version bigint; previous jsonb; new_version bigint; stamp timestamptz:=now();
begin
 if auth.uid() is null or not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if p_expected_version is null or p_expected_version not between 0 and 9007199254740990 then raise exception 'poc_content_conflict';end if;
 perform poc_private.validate_content158(p_document);
 perform pg_advisory_xact_lock(hashtextextended('poc-expedition-content157',0));
 select version,document into old_version,previous from public.poc_expedition_content157 where id='default';
 if old_version is null or old_version is distinct from p_expected_version then raise exception 'poc_content_conflict';end if;
 new_version:=old_version+1;
 update public.poc_expedition_content157 set version=new_version,document=p_document,updated_at=stamp where id='default';
 insert into poc_private.expedition_content_history158 values(new_version,p_document,previous,auth.uid(),'editor',stamp);
 return jsonb_build_object('schema',1,'kind','poc-expedition-content-library','version',new_version,'document',p_document,'updated_at',stamp);
end $$;
revoke all on function public.save_poc_expedition_content158(jsonb,bigint) from public,anon;
grant execute on function public.save_poc_expedition_content158(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
