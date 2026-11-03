import {createHash,timingSafeEqual} from 'node:crypto';
export function parameters(input:Record<string,unknown>){
 const {redirectUri,state,challenge}=input||{};
 if(typeof redirectUri!=='string'||typeof state!=='string'||typeof challenge!=='string')throw Error('INVALID_AUTH_REQUEST');
 const url=new URL(redirectUri);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||Number(url.port)<1024||url.username||url.password||url.pathname!=='/umay-auth/callback'||url.search||url.hash)throw Error('INVALID_REDIRECT');
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw Error('INVALID_PKCE');
 return {redirectUri:url.toString(),state,challenge};
}
export function verify(grant:{expires:number;redirectUri:string;challenge:string},input:{verifier?:unknown;redirectUri?:unknown},now=Date.now()){
 if(!grant||typeof input?.verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(input.verifier)||grant.expires<=now||grant.redirectUri!==input.redirectUri)throw Error('INVALID_GRANT');
 const got=createHash('sha256').update(input.verifier).digest('base64url');
 if(typeof grant.challenge!=='string'||got.length!==grant.challenge.length||!timingSafeEqual(Buffer.from(got),Buffer.from(grant.challenge)))throw Error('INVALID_GRANT');
}
