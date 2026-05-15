-- Demo User A seed (idempotent).
-- Run via: pnpm -w run db:seed:demo
--
-- Creates a sample profile for product demos / development. Tagged is_demo=true
-- on every row so a future "demo cleanup" query can purge cleanly.
--
-- Credentials (after seeding):
--   email:    demo@recompiq.app
--   password: DemoUser!2026
--
-- Demo persona — male, ~42, 5'10.5", 265 lb → 190-200 lb in 26 weeks,
-- T2D + HTN + chronic L foot numbness/weakness + lumbar disc hx + foot-drop hx,
-- deconditioned, not currently lifting. Phase-1 core stack:
-- Retatrutide + AOD-9604 + KLOW + walking/mobility/high-protein.

do $$
declare
  v_user_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_email   constant text := 'demo@recompiq.app';
  v_pwd     constant text := 'DemoUser!2026';
begin
  -- 1. auth.users (idempotent — only insert if missing)
  if not exists (select 1 from auth.users where id = v_user_id) then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_pwd, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('demo', true),
      false,
      '', '', '', ''
    );
    -- auth.identities row (Supabase needs this for password login to work)
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text,
      now(), now(), now()
    );
  end if;

  -- 2. profile (handle_new_user trigger may have already created it)
  insert into public.profiles (
    user_id, display_name, dob, sex, height_in, unit_weight, unit_length,
    is_demo, onboarding_done
  ) values (
    v_user_id, 'Demo User A', '1984-06-15', 'male', 70.5, 'lb', 'in', true, true
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    dob = excluded.dob,
    sex = excluded.sex,
    height_in = excluded.height_in,
    is_demo = true,
    onboarding_done = true;

  -- 3. user_settings — Claude Vision per CLAUDE.md default
  insert into public.user_settings (user_id, vision_provider)
  values (v_user_id, 'anthropic')
  on conflict (user_id) do update set vision_provider = 'anthropic';

  -- 4. goal — 265 → 190-200 lb over 26 weeks, 160-190g protein/day, Phase 1
  delete from public.goals where user_id = v_user_id;
  insert into public.goals (
    user_id, start_weight_lb, goal_weight_lb_min, goal_weight_lb_max,
    timeline_weeks, phase,
    protein_target_g_min, protein_target_g_max, is_demo
  ) values (
    v_user_id, 265, 190, 200, 26, 'P1', 160, 190, true
  );

  -- 5. conditions
  delete from public.conditions where user_id = v_user_id;
  insert into public.conditions (user_id, name, detail, active, is_demo) values
    (v_user_id, 'Type 2 diabetes',                      'Established diagnosis. Glycemic control + fat loss are primary aims.', true, true),
    (v_user_id, 'Stage 1 hypertension',                  'Per recent in-office readings. Monitoring with home cuff.',            true, true),
    (v_user_id, 'Chronic L foot numbness / weakness',    'Persistent neuro deficit related to prior lumbar disc herniation.',    true, true),
    (v_user_id, 'Lumbar disc herniation (historical)',   'Severe sciatica episode resolved. Avoid heavy spinal loading.',        false, true),
    (v_user_id, 'Foot drop (historical)',                'Largely resolved; residual L-side weakness remains.',                  false, true);

  -- 6. medications — placeholder; user can refine post-seed
  delete from public.medications where user_id = v_user_id;
  insert into public.medications (user_id, name, dose, active, is_demo) values
    (v_user_id, 'Metformin',     '1000 mg twice daily (per prescriber)', true, true),
    (v_user_id, 'Lisinopril',    '10 mg daily (per prescriber)',         true, true);

  -- 7. injuries / training limitations
  delete from public.injuries where user_id = v_user_id;
  insert into public.injuries (user_id, name, detail, active, is_demo) values
    (v_user_id, 'No heavy spinal loading',     'Avoid axial compression; favor machines and supported variations.', true, true),
    (v_user_id, 'L foot weakness',             'Cannot do single-leg jumps or balance work on left foot.',          true, true),
    (v_user_id, 'Deconditioned',               'Currently not lifting. P1 is walking + mobility + bands.',          true, true);

  raise notice 'Demo User A seeded. Sign in with % / %', v_email, v_pwd;
end$$;
