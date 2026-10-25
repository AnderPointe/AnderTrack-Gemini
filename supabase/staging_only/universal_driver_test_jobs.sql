-- Synthetic fixtures for the existing named staging driver only.
insert into public.at_driver_test_jobs(organization_id,driver_user_id,service_id,reference,pickup,destination,detail,estimated_cents)
select p.organization_id,p.user_id,s.* from public.at_driver_profiles p cross join (values
('freight','TEST-2048','Shipper warehouse','Dallas Distribution Center','Dry van • 38,400 lb',28650),
('otr','TEST-2049','Fort Worth Freight Terminal','Dallas Distribution Center','Dry van • Appointment required',31000),
('courier','TEST-2050','Downtown parcel hub','Westside business center','3 parcels • Signature required',2475),
('food','TEST-2051','Oak Street Kitchen','Sample customer location','2 items • Pickup code 4821',1475),
('rideshare','TEST-2052','Sample passenger pickup','Downtown transit center','1 passenger • Confirm pickup location',1925),
('waste','TEST-2053','Sample collection stop','Sample disposal facility','Bulky item collection • Disposal ticket required',8500)
) s(service_id,reference,pickup,destination,detail,estimated_cents)
where p.display_name='AnderTrack Staging Driver'
on conflict (organization_id,driver_user_id,reference) do nothing;
