const errors=require('./ui/user-errors.js');
async function readSiteResponse(response){
 let body;try{body=await response.json();}catch{if(response.ok)throw Error('SERVER_UNAVAILABLE');}
 if(!response.ok)throw Error(errors.responseCode(response.status,body));
 return body;
}
module.exports={readSiteResponse};
