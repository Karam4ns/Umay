'use strict';
function chatComputerTask(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||typeof value.goal!=='string'||!value.goal.trim()||value.goal.length>6000||typeof value.acknowledgement!=='string'||value.acknowledgement.length>500||typeof value.userRequest!=='string'||!value.userRequest.trim()||value.userRequest.length>12000||typeof value.anchorMessageId!=='string'||!value.anchorMessageId||value.anchorMessageId.length>128)return null;
 return {version:1,goal:value.goal.trim(),acknowledgement:value.acknowledgement.trim(),userRequest:value.userRequest,anchorMessageId:value.anchorMessageId};
}
module.exports={chatComputerTask};
