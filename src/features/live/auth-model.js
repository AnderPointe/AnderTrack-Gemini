export function signupDetails({name,kind,company}){
  const display_name=String(name||'').trim(),account_kind=kind==='company'?'company':'individual',company_name=account_kind==='company'?String(company||'').trim():null;
  if(display_name.length<2||display_name.length>120)throw new Error('Enter your name (2–120 characters).');
  if(account_kind==='company'&&(!company_name||company_name.length<2||company_name.length>160))throw new Error('Enter your company name (2–160 characters).');
  return {display_name,account_kind,company_name};
}
export function emailAuthRequest({email,signup,details,origin,driver=false}){
  return {email:email.trim().toLowerCase(),options:{emailRedirectTo:new URL(driver?'/driver':'/operations',origin).href,shouldCreateUser:Boolean(signup),...(signup?{data:details}:{})}};
}
export function authMessage(error){
  const message=error?.message||String(error||'');
  if(/rate limit|too many requests/i.test(message))return 'Too many requests. Wait before requesting another email.';
  if(/signup|signups not allowed/i.test(message))return 'New registrations are currently disabled. Existing users can still sign in.';
  return message||'Authentication is unavailable. Please try again later.';
}
