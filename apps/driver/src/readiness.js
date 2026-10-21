/** UI readiness diagnostics only; not a substitute for server authorization. */
export function assessDriverReadiness({membership,profile,online=true,jobCount=0}={}){
  const checks=[
    {id:'membership',label:'Driver organization membership',
      passed:membership?.role==='driver',hint:'An administrator must link your account to a driver organization.'},
    {id:'profile',label:'Driver profile provisioned',
      passed:Boolean(profile?.user_id),hint:'A dispatch administrator must create a driver profile.'},
    {id:'verification',label:'License verification',
      passed:profile?.license_verified===true,hint:'Only operations can verify licensing. Training does not grant clearance.'},
    {id:'availability',label:'Dispatch availability',
      passed:profile?.availability==='available',hint:'Operations must confirm that you are available for dispatch.'},
    {id:'connection',label:'Browser connectivity',
      passed:online===true,hint:'Reconnect to refresh authorized assignments.'},
  ];
  return {checks,completed:checks.filter(c=>c.passed).length,total:checks.length,
    canRequestRealAssignment:checks.every(c=>c.passed),
    jobCount:Number.isInteger(jobCount)&&jobCount>=0?jobCount:0};
}
