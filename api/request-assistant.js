import {generateText,Output,jsonSchema} from 'ai';
import {createClient} from '@supabase/supabase-js';
import {ASSISTANT_SCHEMA,assistantPrompt,createAssistantHandler,validateAssistantOutput} from '../server/request-assistant.js';
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(5000)})}}):null;
export default createAssistantHandler({
 enabled:()=>process.env.AI_ASSISTANT_ENABLED==='true'&&Boolean(process.env.AI_GATEWAY_MODEL),
 verifyUser:async token=>{if(!auth)return null;const {data,error}=await auth.auth.getUser(token);if(error)throw error;return data.user;},
 generate:async input=>{const result=await generateText({model:process.env.AI_GATEWAY_MODEL,...assistantPrompt(input),output:Output.object({schema:jsonSchema(ASSISTANT_SCHEMA,{validate:validateAssistantOutput})}),maxOutputTokens:1400,maxRetries:0,abortSignal:AbortSignal.timeout(15000)});return result.output;},
});
