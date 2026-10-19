# El esquema de la base, tal como está

Sacado de la base el 19 de octubre de 2026 con una consulta al
catálogo. Está aquí por una razón concreta: sin él, cada pregunta
sobre la base —¿existe esa función?, ¿cómo se llama esa columna?,
¿qué arrastra un borrado?— era una consulta escrita a ciegas que
alguien tenía que correr y pegar de vuelta. Una mañana entera se fue
en eso.

No se mantiene solo. Si cambia algo importante, se vuelve a sacar con
la consulta del final.

Una base, dos productos: Cada Punto (cadapunto.com) y Hooporia
(hooporia.com) comparten todo esto. `campaigns.product` es lo único
que las separa.

## Lo que arrastra borrar una campaña

Veintiuna tablas llevan `campaign_id`:

- `bm_cards`
- `bm_offers`
- `bm_players`
- `bw_codes`
- `bw_requests`
- `bw_teams`
- `campaign_cards`
- `campaign_locations`
- `campaign_payout`
- `campaign_practice`
- `campaign_tryouts`
- `cards`
- `challenges`
- `coaches`
- `game_pledges`
- `games`
- `licencias`
- `payouts`
- `players`
- `score_reports`
- `sponsors`

Seis de ellas no tienen `id` propio — son tablas de unión o de
acumulado, y por eso `borrar_arbol` comprueba si hay `id` antes de
intentar bajar un nivel más:

`bw_teams`, `campaign_cards`, `campaign_locations`, `campaign_payout`, `campaign_practice`, `campaign_tryouts`


## Las tablas (sin contar las de marcadores)


### `app_admins`

- email text
- added_at timestamp with time zone


### `bm_campaigns`

- id bigint
- slug text
- team_name text
- campaign_name text
- card_price_cents integer
- program_share_cents integer
- coupon_count integer
- goal_cents integer
- published boolean
- created_at timestamp with time zone
- coach_access_code text


### `bm_cards`

- id bigint
- campaign_id bigint
- player_id bigint
- card_token text
- supporter_name text
- purchased_at timestamp with time zone
- stripe_session_id text


### `bm_coupon_states`

- id bigint
- card_id bigint
- position integer
- state smallint
- revealed_at timestamp with time zone
- redeemed_at timestamp with time zone


### `bm_offers`

- id bigint
- campaign_id bigint
- business text
- offer_description text
- coupon_count integer
- sort_order integer


### `bm_players`

- id bigint
- campaign_id bigint
- player_slug text
- display_name text
- created_at timestamp with time zone


### `bw_codes`

- id uuid
- label text
- code_hash text
- active boolean
- made_at timestamp with time zone
- used_at timestamp with time zone
- campaign_id uuid
- can_add_games boolean


### `bw_entries`

- id uuid
- tourney text
- team text
- category text
- coach text
- email text
- phone text
- note text
- status text
- made_at timestamp with time zone


### `bw_gate`

- id integer
- code_hash text


### `bw_requests`

- id uuid
- team_name text
- program text
- coach_name text
- coach_email text
- phone text
- note text
- status text
- campaign_id uuid
- asked_at timestamp with time zone
- decided_at timestamp with time zone
- terms_at timestamp with time zone
- custody_at timestamp with time zone
- license_accepted_at timestamp with time zone
- license_accepted_by text
- license_terms text
- product text


### `bw_scores`

- game_no text
- a_pts integer
- b_pts integer
- by_whom text
- at_time timestamp with time zone
- sets text


### `bw_teams`

- name text
- campaign_id uuid
- claimed_at timestamp with time zone


### `campaign_cards`

- campaign_id uuid
- design_id uuid


### `campaign_locations`

- campaign_id uuid
- location_id uuid


### `campaign_payout`

- campaign_id uuid
- pay_org text
- pay_regno text
- pay_name text
- pay_phone text
- pay_who text
- pay_title text
- pay_at timestamp with time zone
- pay_by text


### `campaign_practice`

- campaign_id uuid
- player_id uuid
- game text
- runs integer
- best_level integer
- updated_at timestamp with time zone


### `campaign_tryouts`

- campaign_id uuid
- player_id uuid
- game text
- best_level integer
- runs integer
- updated_at timestamp with time zone


### `campaigns`

- id uuid
- name text
- goal numeric
- admin_code text
- description text
- created_at timestamp without time zone
- updated_at timestamp without time zone
- slug text
- logo_url text
- tryout_one_run boolean
- tryout_game text
- practice_required integer
- scored_games ARRAY
- score_key text
- stripe_account text
- stripe_status text
- stripe_ready_at timestamp with time zone
- product text


### `card_designs`

- id uuid
- merchant_id uuid
- name text
- tab_count integer
- price numeric
- team_share_pct integer
- offer_text text
- terms text
- expires_on date
- active boolean
- created_at timestamp with time zone
- display_name text
- display_logo text
- valid_when text
- kind text
- license_product text
- redeem_url text


### `card_tabs`

- id uuid
- card_id uuid
- tab_number integer
- status text
- peeled_at timestamp with time zone
- redeemed_at timestamp with time zone
- redeemed_by text
- redeemed_location uuid


### `cards`

- id uuid
- design_id uuid
- campaign_id uuid
- player_id uuid
- buyer_name text
- buyer_email text
- price_paid numeric
- team_amount numeric
- platform_amount numeric
- payment_status text
- created_at timestamp with time zone
- card_token text
- stripe_session_id text
- card_index integer
- sponsor_id uuid
- issued_to text
- expires_on date


### `challenge_practice`

- challenge_id uuid
- player_id uuid
- best_level integer
- runs integer
- updated_at timestamp with time zone
- game text


### `challenge_quarters`

- challenge_id uuid
- player_id uuid
- quarter smallint
- level_reached integer
- points integer
- recorded_at timestamp with time zone


### `challenge_runs`

- id uuid
- challenge_id uuid
- player_id uuid
- level_reached integer
- points integer
- time_seconds numeric
- played_at timestamp with time zone
- game text
- attempts integer
- threes integer
- fouls integer


### `challenge_scorer_keys`

- challenge_id uuid
- scorer_key text
- created_at timestamp with time zone


### `challenges`

- id uuid
- campaign_id uuid
- name text
- slug text
- pledge_deadline date
- run_deadline date
- team_share_pct integer
- status text
- created_at timestamp with time zone
- game text
- live boolean
- opens_at timestamp with time zone
- closes_at timestamp with time zone
- billed_at timestamp with time zone


### `cj_admin`

- id uuid
- label text
- code_hash text
- active boolean
- created_at timestamp with time zone


### `cj_licencias`

- id uuid
- site text
- kind text
- code_hash text
- code_hint text
- valid_until date
- active boolean
- created_at timestamp with time zone
- created_by text
- last_seen timestamp with time zone
- seen_count integer


### `coach_chat_usage`

- bucket text
- n integer
- day date


### `coaches`

- id uuid
- campaign_id uuid
- name text
- email text
- access_code text
- unlocked_at timestamp without time zone
- created_at timestamp without time zone
- grade text
- label text


### `dia_coach`

- id integer
- code_hash text
- admin_hash text


### `dia_players`

- id uuid
- name text
- team text
- pin_hash text
- created_at timestamp with time zone


### `dia_progress`

- player_id uuid
- lesson text
- seen_at timestamp with time zone


### `dia_quiz`

- id uuid
- player_id uuid
- set_key text
- correct integer
- total integer
- taken_at timestamp with time zone


### `flash_reaction_leaderboard`

- id bigint
- event_code text
- player_name text
- score integer
- avg_bpm integer
- created_at timestamp with time zone


### `game_pledges`

- id uuid
- game_id uuid
- campaign_id uuid
- padrino_name text
- padrino_email text
- rate numeric
- cap numeric
- points integer
- amount numeric
- platform_amount numeric
- team_amount numeric
- invoice_status text
- stripe_session text
- moved_from uuid
- created_at timestamp with time zone
- paid_at timestamp with time zone
- player_id uuid
- settled_account text
- settled_at timestamp with time zone
- invoiced_at timestamp with time zone
- reminder_count integer
- reminded_at timestamp with time zone


### `games`

- id uuid
- campaign_id uuid
- opponent text
- plays_on date
- tip_time text
- home boolean
- venue text
- status text
- team_points integer
- opp_points integer
- note text
- created_at timestamp with time zone
- tips_at timestamp with time zone
- unlocks_from uuid
- made_by text


### `licencias`

- id uuid
- challenge_id uuid
- campaign_id uuid
- amount_cents integer
- roster integer
- promesas integer
- estado text
- stripe_invoice_id text
- stripe_hosted_url text
- program_email text
- program_name text
- created_at timestamp with time zone
- issued_at timestamp with time zone
- paid_at timestamp with time zone
- due_at timestamp with time zone


### `license_devices`

- id uuid
- license_code text
- product text
- device_id text
- first_seen timestamp with time zone
- last_seen timestamp with time zone


### `licenses`

- id uuid
- code text
- school_name text
- expires_at date
- active boolean
- notes text
- created_at timestamp with time zone
- product text
- max_devices integer


### `merchant_locations`

- id uuid
- merchant_id uuid
- name text
- town text
- address text
- active boolean
- created_at timestamp with time zone
- store_number text


### `merchants`

- id uuid
- name text
- logo_url text
- contact_name text
- contact_email text
- contact_phone text
- active boolean
- created_at timestamp with time zone


### `payouts`

- id uuid
- campaign_id uuid
- amount numeric
- method text
- reference text
- note text
- paid_on date
- created_at timestamp with time zone


### `player_run_keys`

- player_id uuid
- run_key text
- created_at timestamp with time zone


### `players`

- id uuid
- campaign_id uuid
- coach_id uuid
- name text
- email text
- phone text
- status text
- created_at timestamp without time zone
- grade text
- added_by text
- added_at timestamp with time zone
- pin_hash text


### `pledges`

- id uuid
- challenge_id uuid
- player_id uuid
- sponsor_name text
- sponsor_email text
- rate_per_point numeric
- points_at_invoice integer
- amount numeric
- team_amount numeric
- platform_amount numeric
- stripe_invoice_id text
- invoice_status text
- invoiced_at timestamp with time zone
- paid_at timestamp with time zone
- created_at timestamp with time zone
- pay_link_url text
- pay_link_id text
- reminded_at timestamp with time zone
- reminder_count integer
- lang text
- cap numeric


### `program_applications`

- id uuid
- program_name text
- org_type text
- contact_name text
- contact_email text
- contact_phone text
- town text
- players integer
- raising_for text
- payee_name text
- ein text
- attested boolean
- notes text
- status text
- created_at timestamp with time zone


### `score_reports`

- id uuid
- game_id uuid
- campaign_id uuid
- team_points integer
- opp_points integer
- by_whom text
- at_time timestamp with time zone


### `sponsors`

- id uuid
- campaign_id uuid
- name text
- logo_url text
- contact_name text
- contact_email text
- note text
- created_at timestamp with time zone


## Las tablas de marcadores de los juegos

Cuarenta y nueve tablas `*_standings`, una por juego, todas con la
misma forma (`player_name`, `score`, a veces los cuatro cuartos) y
ninguna atada a una campaña. No entran en nada de lo de arriba: un
borrado de campaña no las toca.


- `alley_oop_standings`
- `clutch_basketball_standings`
- `dynamic_memory_fortress_standings`
- `dynamic_memory_quarter_standings`
- `dynamic_memory_standings`
- `eight_direction_standings`
- `flash_basketball_standings`
- `flash_break_standings`
- `hooporia_4qtr_standings`
- `hooporia_basketball_recall_standings`
- `hooporia_basketball_recognition_standings`
- `hooporia_basketball_reflex_standings`
- `hooporia_basketball_replay_standings`
- `hooporia_flash_standings`
- `hooporia_handle_standings`
- `hooporia_swish_standings`
- `magnetic_north_standings`
- `memory_basketball_standings`
- `memory_spheres_standings`
- `number_flash_standings`
- `reaction_velocity_standings`
- `ritnome_mobile_2halves_standings`
- `ritnome_mobile_dynamic_memory_standings`
- `ritnome_mobile_fortress_standings`
- `ritnome_mobile_handle_4qtr_standings`
- `ritnome_mobile_handle_standings`
- `ritnome_mobile_recognition_standings`
- `ritnome_recall_standings`
- `ritnome_reflex_standings`
- `ritnome_standings`
- `shot_decision_standings`
- `the_handle_standings`
- `tres_pointer_standings`
- `tres_tiebreaker_standings`
- `true_north_standings`
- `unstoppable_standings`
- `velo_all_points_standings`
- `velo_flash_reaction_standings`
- `velo_moving_target_standings`
- `vr_buckets_dont_lie_standings`
- `vr_chain_reaction_standings`
- `vr_flashpoint_standings`
- `vr_let_it_fly_standings`
- `vr_make_it_count_standings`
- `vr_reactific_standings`
- `vr_reaction_speed_standings`
- `vr_shoot_it_own_it_standings`
- `vr_swish_basketball_standings`
- `vr_the_handle_standings`


## Las funciones


### Sueltas

- `add_games(p_code text, p_campaign uuid, p_rows json)`
- `billing_queue()`
- `borrar_arbol(p_tabla text, p_ids uuid[], p_hondo integer DEFAULT 0)`
- `builder_check(p_code text)`
- `campaign_squads(p_campaign uuid)`
- `campana_borrar(p_campana uuid)`
- `campana_cuenta(p_campana uuid)`
- `can_bill(p_campaign uuid)`
- `cancel_game(p_game uuid)`
- `challenge_list(p_code text)`
- `challenge_report(p_code text, p_challenge uuid)`
- `check_access(p_code text, p_product text, p_device text)`
- `check_license(p_code text, p_product text)`
- `coach_chat_bump(p_buckets text[])`
- `game_board(p_campaign uuid)`
- `game_pledge_for_payment(p_id uuid)`
- `game_report(p_code text, p_game uuid)`
- `game_roster(p_campaign uuid)`
- `get_run_key(p_player uuid)`
- `hijos_de(p_tabla text)`
- `is_admin()`
- `is_director_of(p_campaign uuid)`
- `join_competition(p_campaign uuid, p_name text, p_grade text, p_pin text DEFAULT NULL::text)`
- `join_roster(p_campaign uuid, p_name text, p_squad text DEFAULT NULL::text)`
- `licencia_calculo(p_challenge uuid)`
- `licencia_tarifa(p_roster integer)`
- `license_record(p_email text, p_by text, p_terms text)`
- `my_campaign_ids()`
- `my_links(p_campaign uuid, p_player uuid)`
- `payout_check(p_code text)`
- `payout_destinations()`
- `payout_status(p_code text)`
- `player_name(p_id uuid)`
- `player_pledges(p_campaign uuid)`
- `player_state(p_id uuid)`
- `pledge_for_payment(p_pledge uuid)`
- `pledge_game(p_game uuid, p_name text, p_email text, p_rate numeric, p_cap numeric DEFAULT NULL::numeric, p_player uuid DEFAULT NULL::uuid)`
- `practice_state(p_campaign uuid, p_player uuid, p_game text)`
- `record_cashrack_score(p_challenge uuid, p_key text, p_player uuid, p_att integer, p_threes integer, p_fouls integer)`
- `record_official_run(p_challenge uuid, p_player uuid, p_key text, p_level integer, p_points integer, p_time numeric DEFAULT NULL::numeric, p_game text DEFAULT 'fortress'::text)`
- `record_practice(p_campaign uuid, p_player uuid, p_game text, p_level integer)`
- `report_score(p_campaign uuid, p_code text, p_game uuid, p_team integer, p_opp integer)`
- `request_product(p_email text, p_product text)`
- `score_check(p_campaign uuid, p_code text)`
- `score_game(p_game uuid, p_team integer, p_opp integer DEFAULT NULL::integer)`
- `set_payout(p_code text, p_campaign uuid, p_org text, p_regno text, p_name text, p_phone text, p_who text, p_title text, p_is_org boolean DEFAULT false)`
- `set_player_pin(p_player uuid, p_pin text)`
- `student_sign_in(p_campaign uuid, p_pin text, p_name text DEFAULT NULL::text)`

### Las `cp_`

- `cp_game_state(p_challenge uuid, p_player uuid, p_key text)`
- `cp_padrino_view(p_challenge uuid, p_player uuid)`
- `cp_pledge(p_challenge uuid, p_player uuid, p_name text, p_email text, p_rate numeric, p_cap numeric, p_lang text DEFAULT 'es'::text)`
- `cp_quarters(p_challenge uuid, p_player uuid)`
- `cp_record_quarter(p_challenge uuid, p_player uuid, p_key text, p_quarter integer, p_level integer, p_points integer)`
- `cp_reto_vivo(p_campaign uuid)`
- `cp_tablero(p_challenge uuid)`

### Las `roster_`

- `roster_active(p_code text, p_campaign uuid, p_player uuid, p_on boolean)`
- `roster_add(p_code text, p_campaign uuid, p_names text[], p_squad text DEFAULT NULL::text)`
- `roster_decide(p_code text, p_campaign uuid, p_player uuid, p_yes boolean)`
- `roster_edit(p_code text, p_campaign uuid, p_player uuid, p_name text, p_squad text DEFAULT NULL::text)`
- `roster_list(p_code text, p_campaign uuid)`
- `roster_remove(p_code text, p_campaign uuid, p_player uuid)`
- `roster_who(p_code text, p_campaign uuid)`

### Las `bw_`

- `bw_approve_request(p_id uuid)`
- `bw_board()`
- `bw_check(p_code text)`
- `bw_claim_team(p_code text, p_name text, p_campaign uuid)`
- `bw_clear_score(p_code text, p_game text)`
- `bw_code_add(p_label text, p_code text, p_campaign uuid DEFAULT NULL::uuid, p_build boolean DEFAULT false)`
- `bw_code_del(p_id uuid)`
- `bw_code_off(p_id uuid)`
- `bw_code_ok(p_code text)`
- `bw_code_on(p_id uuid)`
- `bw_codes_list()`
- `bw_ensure_game(p_code text, p_team text, p_foe text, p_on date, p_time text, p_note text DEFAULT NULL::text)`
- `bw_enter(p_tourney text, p_team text, p_category text, p_coach text, p_email text, p_phone text DEFAULT NULL::text, p_note text DEFAULT NULL::text)`
- `bw_entry_counts(p_tourney text)`
- `bw_entry_drop(p_id uuid)`
- `bw_entry_list(p_tourney text)`
- `bw_link_team(p_name text, p_campaign uuid)`
- `bw_links()`
- `bw_request_states()`
- `bw_request_team(p_team text, p_program text, p_name text, p_email text, p_phone text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_terms boolean DEFAULT false, p_custody boolean DEFAULT false)`
- `bw_requests_pending()`
- `bw_set_score(p_code text, p_game text, p_a integer, p_b integer, p_team_a text DEFAULT NULL::text, p_team_b text DEFAULT NULL::text, p_on date DEFAULT NULL::date, p_by text DEFAULT NULL::text, p_sets text DEFAULT NULL::text)`
- `bw_teams_board()`
- `bw_unlink_team(p_name text)`
- `bw_who(p_code text)`

### Las `dia_`

- `dia_coach_add(p_code text, p_name text, p_team text, p_pin text)`
- `dia_coach_pin(p_code text, p_player uuid, p_pin text)`
- `dia_coach_remove(p_code text, p_player uuid)`
- `dia_is_admin(p_code text)`
- `dia_is_coach(p_code text)`
- `dia_join(p_name text, p_team text, p_pin text)`
- `dia_score(p_player uuid, p_set text, p_correct integer, p_total integer)`
- `dia_seen(p_player uuid, p_lesson text)`
- `dia_set_admin(p_code text, p_new text)`
- `dia_set_code(p_code text, p_new text)`
- `dia_sign_in(p_pin text, p_name text DEFAULT NULL::text)`
- `dia_who(p_code text)`

### Las `cj_`

- `cj_admin_id(p_admin text)`
- `cj_code_add(p_admin text, p_site text, p_kind text, p_days integer DEFAULT NULL::integer)`
- `cj_code_check(p_code text)`
- `cj_code_off(p_admin text, p_id uuid)`
- `cj_code_renew(p_admin text, p_id uuid, p_days integer DEFAULT 365)`
- `cj_codes_list(p_admin text)`


## Cómo se vuelve a sacar

```sql
select json_build_object(
  'tablas', (select json_agg(json_build_object('t', table_name, 'c', cols))
               from (select c.table_name,
                            json_agg(c.column_name || ' ' || c.data_type order by c.ordinal_position) as cols
                       from information_schema.columns c
                       join information_schema.tables t
                         on t.table_name = c.table_name and t.table_schema = c.table_schema
                      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
                      group by c.table_name) x),
  'funciones', (select json_agg(p.proname || '(' || pg_get_function_arguments(p.oid) || ')' order by p.proname)
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind = 'f')
) as esquema;
```
