-- Server-only receipts of native iDos completed deals. This table never credits,
-- debits, reserves or settles tokens. Native iDos remains the money authority.
begin;

create table public.card_market_deals (
  title_id text not null check (title_id = 'SI4IPS8B'),
  offer_id text not null check (offer_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  card_id text not null check (card_id ~ '^[a-z0-9-]{1,128}$'),
  quantity bigint not null check (quantity between 1 and 9007199254740991),
  price_imp bigint not null check (price_imp between 1 and 1000000000000),
  completed_at timestamptz not null check (isfinite(completed_at)),
  verified_at timestamptz not null default now(),
  primary key (title_id, offer_id)
);
create index card_market_deals_card_time on public.card_market_deals (title_id, card_id, completed_at);
alter table public.card_market_deals enable row level security;
-- No browser role gets table access; even service_role must use the RPCs.
revoke all on table public.card_market_deals from public, anon, authenticated, service_role;

create function public.card_market_reject_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Verified market deals are immutable' using errcode = '23000';
end;
$$;
revoke all on function public.card_market_reject_mutation() from public, anon, authenticated, service_role;
create trigger card_market_deals_immutable
before update or delete on public.card_market_deals
for each row execute function public.card_market_reject_mutation();

-- A single RPC invocation is one transaction. Insert-on-conflict acquires the
-- unique-key lock; afterwards all receipt facts must match the committed row.
-- A mismatch raises an exception and rolls back every insert in this batch.
create function public.card_market_insert_deals(p_title_id text, p_deals jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal record;
  v_existing public.card_market_deals%rowtype;
  v_inserted boolean;
  v_accepted integer := 0;
begin
  if p_title_id is distinct from 'SI4IPS8B' or p_deals is null or
     pg_catalog.jsonb_typeof(p_deals) is distinct from 'array' then
    raise exception 'Invalid market deal batch' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_deals) > 1000 then
    raise exception 'Market deal batch is too large' using errcode = '22023';
  end if;
  -- Deterministic lock order prevents deadlocks between overlapping reports.
  for v_deal in
    select * from pg_catalog.jsonb_to_recordset(p_deals) as deal(
      offer_id text, card_id text, quantity bigint, price_imp bigint, completed_at timestamptz
    ) order by offer_id
  loop
    v_inserted := false;
    insert into public.card_market_deals (title_id, offer_id, card_id, quantity, price_imp, completed_at)
    values (p_title_id, v_deal.offer_id, v_deal.card_id, v_deal.quantity, v_deal.price_imp, v_deal.completed_at)
    on conflict (title_id, offer_id) do nothing
    returning true into v_inserted;
    if v_inserted then
      v_accepted := v_accepted + 1;
    else
      select * into strict v_existing from public.card_market_deals
        where title_id = p_title_id and offer_id = v_deal.offer_id for update;
      if v_existing.card_id is distinct from v_deal.card_id or
         v_existing.quantity is distinct from v_deal.quantity or
         v_existing.price_imp is distinct from v_deal.price_imp or
         v_existing.completed_at is distinct from v_deal.completed_at then
        raise exception 'Conflicting verified market deal' using errcode = '23000';
      end if;
    end if;
  end loop;
  return v_accepted;
end;
$$;
revoke all on function public.card_market_insert_deals(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.card_market_insert_deals(text, jsonb) to service_role;

create function public.card_market_price_snapshot(p_title_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  if p_title_id is distinct from 'SI4IPS8B' then
    raise exception 'Invalid market title' using errcode = '22023';
  end if;
  with deals as (
    select * from public.card_market_deals where title_id = p_title_id
  ), card_stats as (
    select card_id, count(*) as samples, sum(quantity) as units,
      pg_catalog.rtrim(pg_catalog.rtrim(trunc(sum(price_imp)::numeric / sum(quantity), 6)::text, '0'), '.') as mean_imp,
      pg_catalog.rtrim(pg_catalog.rtrim(trunc(min(price_imp::numeric / quantity), 6)::text, '0'), '.') as min_imp,
      pg_catalog.rtrim(pg_catalog.rtrim(trunc(max(price_imp::numeric / quantity), 6)::text, '0'), '.') as max_imp,
      pg_catalog.to_char(max(completed_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_trade_at
    from deals group by card_id
  )
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'ready', true,
    'coverage', 'verified-reports',
    'currencyID', 'Main',
    'symbol', 'IMP',
    'stats', coalesce((select pg_catalog.jsonb_object_agg(card_id, pg_catalog.jsonb_build_object(
      'sampleSize', samples, 'units', units, 'meanImp', mean_imp,
      'minImp', min_imp, 'maxImp', max_imp, 'lastTradeAt', last_trade_at
    )) from card_stats), '{}'::jsonb),
    'sampleSize', (select count(*) from deals),
    'units', coalesce((select sum(quantity) from deals), 0),
    'updatedAt', (select pg_catalog.to_char(max(verified_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from deals)
  ) into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.card_market_price_snapshot(text) from public, anon, authenticated, service_role;
grant execute on function public.card_market_price_snapshot(text) to service_role;

comment on table public.card_market_deals is 'Minimal verified native card sale receipts; no users, wallets, profiles, tickets or token balances.';
comment on function public.card_market_insert_deals(text, jsonb) is 'Server-only atomic immutable receipt ingestion. Does not move or credit money.';

commit;
