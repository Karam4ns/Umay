'use strict';
// A separate bounded rate bucket for authenticated machine-planning requests.
// This header grants no authentication, model access or device authority.
function operatorHeaders(body){return body?.desktopMode==='computer'?{'X-Umay-Operator':'umay-general-v1'}:{};}
module.exports={operatorHeaders};
