/**
 * Universal Logistics OS navigation registry.
 * Existing IDs must stay stable: OpsCommandCenter controls views using these IDs.
 * Planned views render architecture workspaces, not live booking/dispatch.
 */
export const UNIVERSAL_NAV_GROUPS = [
  { id:'command',label:'COMMAND CENTER',items:[
    {id:'overview',label:'Universal Overview',icon:'dashboard',status:'existing'},
    {id:'tracking',label:'Live Tracking',icon:'map',status:'existing'},
    {id:'dispatch',label:'Dispatch Center',icon:'dispatch',status:'existing'},
    {id:'dispatch-mode',label:'Dispatch Mode',icon:'map',status:'existing'},
    {id:'dispatch-planner',label:'Load Planning',icon:'route',status:'existing'},
  ]},
  { id:'freight',label:'3PL & FREIGHT',items:[
    {id:'freight-3pl',label:'3PL Freight Hub',icon:'freight',status:'planned'},
    {id:'journeys',label:'Shipment Journeys',icon:'history',status:'existing'},
  ]},
  { id:'hotshot',label:'HOTSHOT & EXPEDITED',items:[
    {id:'hotshot',label:'Hotshot Operations',icon:'hotshot',status:'planned'},
  ]},
  { id:'warehouse',label:'WAREHOUSE & YARD',items:[
    {id:'warehouse',label:'Warehouse Operations',icon:'warehouse',status:'existing'},
    {id:'delivery-overview',label:'Delivery Overview',icon:'package',status:'existing'},
  ]},
  { id:'local-services',label:'CLASS C / LOCAL SERVICES',items:[
    {id:'class-c',label:'Class C Fleet',icon:'fleet',status:'existing'},
    {id:'local-courier',label:'Local Courier',icon:'package',status:'planned'},
    {id:'food-delivery',label:'Food Delivery',icon:'food',status:'planned'},
    {id:'passenger-services',label:'Passenger Services',icon:'passenger',status:'planned'},
  ]},
  { id:'fleet',label:'FLEET & VEHICLES',items:[
    {id:'fleet',label:'Drivers & Vehicles',icon:'fleet',status:'existing'},
    {id:'fleet-health',label:'Fleet Health',icon:'health',status:'existing'},
    {id:'intelligent-fleet',label:'Fleet Intelligence',icon:'dispatch',status:'existing'},
    {id:'driver-cockpit',label:'Driver Cockpit & HOS',icon:'health',status:'existing'},
  ]},
  { id:'insights',label:'INTELLIGENCE & SYSTEM',items:[
    {id:'intelligence',label:'Smart Operations',icon:'insights',status:'existing'},
    {id:'analytics',label:'Analytics',icon:'analytics',status:'existing'},
    {id:'settings',label:'Workspace Settings',icon:'settings',status:'existing'},
  ]},
];

export const UNIVERSAL_NAV_ITEMS = UNIVERSAL_NAV_GROUPS.flatMap(group =>
  group.items.map(item => ({...item,groupId:group.id}))
);
const navById = new Map(UNIVERSAL_NAV_ITEMS.map(item => [item.id,item]));

export function getUniversalNavItem(id) {
  return navById.get(id) || null;
}

export const UNIVERSAL_DIVISIONS = [
  {id:'freight-3pl',label:'3PL & Freight',subtitle:'Shippers, carriers and commodity workflows',icon:'freight',state:'planned'},
  {id:'hotshot',label:'Hotshot & Expedited',subtitle:'Equipment compatibility and urgent loads',icon:'hotshot',state:'planned'},
  {id:'warehouse',label:'Warehouse & Yard',subtitle:'Existing equipment and warehouse workspace',icon:'warehouse',state:'existing'},
  {id:'local-courier',label:'Class C Local Courier',subtitle:'Small freight, parcels and local dispatch',icon:'package',state:'planned'},
  {id:'food-delivery',label:'Class C Food Delivery',subtitle:'Restaurant, customer and courier marketplace',icon:'food',state:'planned'},
  {id:'passenger-services',label:'Class C Passenger Rides',subtitle:'Ride requests, qualified drivers and trip safety',icon:'passenger',state:'planned'},
];

export const UNIVERSAL_WORKSPACES = {
  'freight-3pl':{
    title:'3PL Freight Operations',
    description:'Carrier tendering, shipper accounts, freight pricing and regulated commodity support will be added through the shared logistics core.',
    capabilities:['Carrier onboarding and verification','Shipper and 3PL contracts','Equipment and commodity matching','Freight tenders and settlement'],
    links:[{id:'dispatch',label:'Existing dispatch center',planner:true},{id:'journeys',label:'Shipment journeys'}],
  },
  'hotshot':{
    title:'Hotshot & Expedited Freight',
    description:'An expedited dispatch workflow will coordinate urgent shipments, qualified drivers, cargo dimensions and trailer compatibility.',
    capabilities:['Expedited load intake','Trailer and capacity verification','Pickup urgency and ETA','Hotshot pricing and tracking'],
    links:[{id:'dispatch-planner',label:'Existing dispatch planner',planner:true},{id:'tracking',label:'Fleet tracking'}],
  },
  'local-courier':{
    title:'Class C Local Courier',
    description:'Local package delivery will build on the existing Class C fleet and parcel workflows, with a dedicated courier booking and dispatch layer.',
    capabilities:['Same-day local bookings','Courier availability and assignment','Multi-stop parcel routes','Customer proof of delivery'],
    links:[{id:'class-c',label:'Class C fleet workspace'},{id:'delivery-overview',label:'Existing delivery overview'}],
  },
  'food-delivery':{
    title:'Class C Food Delivery',
    description:'An Uber Eats / DoorDash-style merchant-to-customer workflow is planned inside Class C Local Services. This section is not accepting live orders.',
    capabilities:['Restaurant and merchant onboarding','Digital menus and customer cart','Preparation-aware courier matching','Payments, refunds and delivery proof'],
    links:[{id:'class-c',label:'Class C fleet foundation'}],
  },
  'passenger-services':{
    title:'Class C Passenger Services',
    description:'On-demand and scheduled passenger trips are planned for eligible drivers and vehicles, subject to applicable for-hire, licensing and insurance requirements.',
    capabilities:['Passenger booking and fare quoting','Driver and vehicle eligibility','Rider safety and tracking','Trip receipts and payments'],
    links:[{id:'class-c',label:'Class C fleet foundation'}],
  },
};

export function getUniversalWorkspace(id) {
  return Object.prototype.hasOwnProperty.call(UNIVERSAL_WORKSPACES,id)
    ? UNIVERSAL_WORKSPACES[id] : null;
}
