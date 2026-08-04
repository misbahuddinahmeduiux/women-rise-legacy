import { supabaseAdmin } from './supabase.js';

const DEFAULT_AUTH_VERSION=1;
const LONG_BAN_DURATION='876000h';

type RotateOptions={
  accountStatus?:'active'|'suspended'|'deactivated';
};

function normalizeVersion(value:unknown){
  const parsed=Number(value);
  return Number.isInteger(parsed)&&parsed>0?parsed:DEFAULT_AUTH_VERSION;
}

export async function rotateUserAuthVersion(userId:string,options:RotateOptions={}){
  const [profileResult,userResult]=await Promise.all([
    supabaseAdmin.from('profiles').select('auth_version').eq('id',userId).single(),
    supabaseAdmin.auth.admin.getUserById(userId)
  ]);
  if(profileResult.error)throw profileResult.error;
  if(userResult.error||!userResult.data.user)throw userResult.error||new Error('Auth user could not be loaded.');

  const user=userResult.data.user;
  const previousProfileVersion=normalizeVersion(profileResult.data.auth_version);
  const previousMetadataVersion=normalizeVersion(user.app_metadata?.access_version);
  const nextVersion=Math.max(previousProfileVersion,previousMetadataVersion)+1;
  const nextMetadata={...(user.app_metadata||{}),access_version:nextVersion};

  const profileUpdate=await supabaseAdmin.from('profiles').update({auth_version:nextVersion}).eq('id',userId);
  if(profileUpdate.error)throw profileUpdate.error;

  const authAttributes:Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1]={app_metadata:nextMetadata};
  if(options.accountStatus){
    authAttributes.ban_duration=options.accountStatus==='active'?'none':LONG_BAN_DURATION;
  }

  const authUpdate=await supabaseAdmin.auth.admin.updateUserById(userId,authAttributes);
  if(authUpdate.error){
    await supabaseAdmin.from('profiles').update({auth_version:previousProfileVersion}).eq('id',userId);
    throw authUpdate.error;
  }

  return {previousVersion:previousProfileVersion,nextVersion};
}
