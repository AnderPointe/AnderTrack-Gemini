export const DRIVER_SERVICES = [
  { id: 'freight', label: '3PL Freight', subtitle: 'Ship. Move. Deliver.', icon: 'package', division: 'Freight', pickup: 'Shipper warehouse', destination: 'Dallas Distribution Center', detail: 'Dry van • 38,400 lb', amount: 28650 },
  { id: 'otr', label: 'OTR Trucking', subtitle: 'Long haul. More miles.', icon: 'truck', division: 'Freight', pickup: 'Fort Worth Freight Terminal', destination: 'Dallas Distribution Center', detail: 'Dry van • Appointment required', amount: 31000 },
  { id: 'courier', label: 'Courier', subtitle: 'Packages. Local.', icon: 'van', division: 'Class C Local Services', pickup: 'Downtown parcel hub', destination: 'Westside business center', detail: '3 parcels • Signature required', amount: 2475 },
  { id: 'food', label: 'Food Delivery', subtitle: 'Meals. On time.', icon: 'food', division: 'Class C Local Services', pickup: 'Oak Street Kitchen', destination: 'Sample customer location', detail: '2 items • Pickup code 4821', amount: 1475 },
  { id: 'rideshare', label: 'Rideshare', subtitle: 'People. Your city.', icon: 'car', division: 'Class C Local Services', pickup: 'Sample passenger pickup', destination: 'Downtown transit center', detail: '1 passenger • Confirm pickup location', amount: 1925 },
  { id: 'waste', label: 'Trash Removal', subtitle: 'Clean communities.', icon: 'trash', division: 'Collection Services', pickup: 'Sample collection stop', destination: 'Sample disposal facility', detail: 'Bulky item collection • Disposal ticket required', amount: 8500 },
];
export const JOB_STATES = ['offered', 'accepted', 'at_pickup', 'in_transit', 'completed'];
export const NEXT_ACTION = { offered: 'Accept test job', accepted: 'Arrived at pickup', at_pickup: 'Confirm pickup', in_transit: 'Complete test job' };
export const STATE_LABEL = { offered: 'New offer', accepted: 'Heading to pickup', at_pickup: 'At pickup', in_transit: 'In transit', completed: 'Completed' };
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export function nextJobState(status) { const index = JOB_STATES.indexOf(status); return index < 0 ? null : JOB_STATES[index + 1] || null; }
export function sampleJobs() {
  return DRIVER_SERVICES.map((service, index) => ({ id: `demo-${service.id}`, reference: `TEST-${2048 + index}`, service_id: service.id, pickup: service.pickup, destination: service.destination, detail: service.detail, estimated_cents: service.amount, status: 'offered', revision: 0 }));
}
