-- PHASE 6: RUN ONLY AGAINST APPROVED Andertrack Staging (ofyfausfhinwgrfmapgc).
-- Test the actual database trigger, NOT genuine concurrent network sessions.
-- The fictitious "verified" test profile exists only inside this rolled-back transaction.
BEGIN;
SET LOCAL statement_timeout='8s';
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.at_organizations)<>1
  OR (SELECT count(*) FROM public.at_assignments)<>0
  OR (SELECT count(*) FROM public.at_vehicles)<>0
  OR NOT EXISTS(SELECT 1 FROM public.at_organizations WHERE name='AnderPointe')
 THEN RAISE EXCEPTION 'Run on approved empty staging only'; END IF;
END $guard$;
CREATE TEMP TABLE phase6_ids ON COMMIT DROP AS
SELECT gen_random_uuid() org_id,gen_random_uuid() vehicle_id,
 (SELECT m.user_id FROM public.at_organization_members m WHERE m.role='driver' LIMIT 1) driver_user;
CREATE TEMP TABLE phase6_collision_results(test_name text,verdict text,detail text) ON COMMIT DROP;
INSERT INTO public.at_organizations(id,name)
SELECT org_id,'PHASE6 COLLISION QA - temporary' FROM pg_temp.phase6_ids;
INSERT INTO public.at_organization_members(organization_id,user_id,role)
SELECT org_id,driver_user,'driver' FROM pg_temp.phase6_ids;
INSERT INTO public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
SELECT org_id,driver_user,'Temporary Phase6 collision actor','C',true,'available' FROM pg_temp.phase6_ids;
INSERT INTO public.at_vehicles(id,organization_id,unit_number,vehicle_type,required_license_class,enabled)
SELECT vehicle_id,org_id,'PHASE6-COLLISION','cargo_van','C',true FROM pg_temp.phase6_ids;
INSERT INTO public.at_assignments(organization_id,reference,division,customer_name,commodity,
 pickup_address,dropoff_address,status,driver_user_id,vehicle_id)
SELECT org_id,'PHASE6-CLAIM-A','Class C','FICTIONAL QA','sample','NO REAL LOCATION','NO REAL LOCATION',
 'offered',driver_user,vehicle_id FROM pg_temp.phase6_ids;
DO $test$
DECLARE error_text text;
BEGIN
 BEGIN
  INSERT INTO public.at_assignments(organization_id,reference,division,customer_name,commodity,
   pickup_address,dropoff_address,status,driver_user_id,vehicle_id)
  SELECT org_id,'PHASE6-CLAIM-B','Class C','FICTIONAL QA','sample',
   'NO REAL LOCATION','NO REAL LOCATION','offered',driver_user,vehicle_id
  FROM pg_temp.phase6_ids;
  INSERT INTO pg_temp.phase6_collision_results
   VALUES('duplicate_active_vehicle','FAIL','Second active assignment permitted');
 EXCEPTION WHEN others THEN
  error_text:=SQLERRM;
  INSERT INTO pg_temp.phase6_collision_results VALUES('duplicate_active_vehicle',
   CASE WHEN error_text LIKE '%Vehicle has another active assignment%' THEN 'PASS' ELSE 'FAIL' END,
   left(error_text,150));
 END;
END $test$;
SELECT * FROM pg_temp.phase6_collision_results;
ROLLBACK;
