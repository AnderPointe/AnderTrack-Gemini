-- PHASE 6: RUN ONLY AGAINST APPROVED Andertrack Staging (ofyfausfhinwgrfmapgc).
-- Creates fictional tenant fixtures INSIDE ONE TRANSACTION and ROLLS THEM BACK.
-- No queue insertions, no new auth users, no license edits to existing profiles.
BEGIN;
SET LOCAL statement_timeout='8s';
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.at_organizations)<>1
    OR (SELECT count(*) FROM public.at_assignments)<>0
    OR (SELECT count(*) FROM public.at_vehicles)<>0
    OR NOT EXISTS (SELECT 1 FROM public.at_organizations WHERE name='AnderPointe')
 THEN RAISE EXCEPTION 'Phase6 requires the approved empty single-org staging environment'; END IF;
END $guard$;
CREATE TEMP TABLE phase6_ids ON COMMIT DROP AS
SELECT gen_random_uuid() org_a,gen_random_uuid() org_b,
 (SELECT m.user_id FROM public.at_organization_members m
  JOIN public.at_organizations o ON o.id=m.organization_id
  WHERE o.name='AnderPointe' AND m.role='admin' LIMIT 1) admin_user,
 (SELECT m.user_id FROM public.at_organization_members m
  JOIN public.at_organizations o ON o.id=m.organization_id
  WHERE o.name='AnderPointe' AND m.role='driver' LIMIT 1) driver_user;
DO $check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_temp.phase6_ids WHERE admin_user IS NOT NULL
   AND driver_user IS NOT NULL AND admin_user<>driver_user AND org_a<>org_b)
 THEN RAISE EXCEPTION 'Two distinct approved staging identities required'; END IF;
END $check$;
CREATE TEMP TABLE phase6_results (
 identity_name text,a_members int,b_members int,a_orgs int,b_orgs int,
 a_vehicles int,b_vehicles int,a_assignments int,b_assignments int,
 a_profiles int,b_profiles int
) ON COMMIT DROP;
GRANT SELECT ON pg_temp.phase6_ids TO authenticated;
GRANT SELECT,INSERT ON pg_temp.phase6_results TO authenticated;
INSERT INTO public.at_organizations(id,name)
SELECT org_a,'PHASE6 QA Tenant A - temporary' FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,'PHASE6 QA Tenant B - temporary' FROM pg_temp.phase6_ids;
INSERT INTO public.at_organization_members(organization_id,user_id,role)
SELECT org_a,admin_user,'admin' FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,driver_user,'driver' FROM pg_temp.phase6_ids;
INSERT INTO public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
SELECT org_b,driver_user,'Phase6 temporary driver B','C',false,'offline' FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,admin_user,'Phase6 temporary other driver','C',false,'offline' FROM pg_temp.phase6_ids;
INSERT INTO public.at_vehicles(organization_id,unit_number,vehicle_type,required_license_class,enabled)
SELECT org_a,'PHASE6-TEMP-A','cargo_van','C',false FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,'PHASE6-TEMP-B','cargo_van','C',false FROM pg_temp.phase6_ids;
INSERT INTO public.at_assignments(organization_id,reference,division,customer_name,commodity,
  pickup_address,dropoff_address,status,driver_user_id)
SELECT org_a,'PHASE6-ORG-A','Class C','FICTIONAL QA','test','NO REAL LOCATION','NO REAL LOCATION','unassigned',NULL FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,'PHASE6-ORG-B-OWNER','Class C','FICTIONAL QA','test','NO REAL LOCATION','NO REAL LOCATION','cancelled',driver_user FROM pg_temp.phase6_ids
UNION ALL SELECT org_b,'PHASE6-ORG-B-OTHER','Class C','FICTIONAL QA','test','NO REAL LOCATION','NO REAL LOCATION','cancelled',admin_user FROM pg_temp.phase6_ids;
SELECT set_config('request.jwt.claim.sub',(SELECT admin_user::text FROM pg_temp.phase6_ids),true);
SET LOCAL ROLE authenticated;
INSERT INTO pg_temp.phase6_results
SELECT 'admin_in_A',
 (SELECT count(*)::int FROM public.at_organization_members WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organization_members WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organizations WHERE id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organizations WHERE id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_vehicles WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_vehicles WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_assignments WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_assignments WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_driver_profiles WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_driver_profiles WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT driver_user::text FROM pg_temp.phase6_ids),true);
SET LOCAL ROLE authenticated;
INSERT INTO pg_temp.phase6_results
SELECT 'driver_in_B',
 (SELECT count(*)::int FROM public.at_organization_members WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organization_members WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organizations WHERE id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_organizations WHERE id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_vehicles WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_vehicles WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_assignments WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_assignments WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_driver_profiles WHERE organization_id=(SELECT org_a FROM pg_temp.phase6_ids)),
 (SELECT count(*)::int FROM public.at_driver_profiles WHERE organization_id=(SELECT org_b FROM pg_temp.phase6_ids));
RESET ROLE;
SELECT identity_name,a_members,b_members,a_orgs,b_orgs,a_vehicles,b_vehicles,
 a_assignments,b_assignments,a_profiles,b_profiles,
 CASE
 WHEN identity_name='admin_in_A' AND a_members=1 AND b_members=0 AND a_orgs=1 AND b_orgs=0
  AND a_vehicles=1 AND b_vehicles=0 AND a_assignments=1 AND b_assignments=0
  AND a_profiles=0 AND b_profiles=0 THEN 'PASS'
 WHEN identity_name='driver_in_B' AND a_members=0 AND b_members=1 AND a_orgs=0 AND b_orgs=1
  AND a_vehicles=0 AND b_vehicles=1 AND a_assignments=0 AND b_assignments=1
  AND a_profiles=0 AND b_profiles=1 THEN 'PASS'
 ELSE 'FAIL' END AS verdict
FROM pg_temp.phase6_results ORDER BY identity_name;
ROLLBACK;
