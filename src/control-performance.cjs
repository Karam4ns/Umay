'use strict';
const {standaloneNavigation}=require('./standalone-navigation.cjs');
function landingVerified(view,target){
 try{const expected=new URL(target),actual=new URL(view.browser.pages.find(p=>p.id===view.browser.pageId).url),host=u=>u.hostname.replace(/^www\./,'');
  return host(actual)===host(expected)&&actual.port===expected.port&&(actual.protocol===expected.protocol||expected.protocol==='http:'&&actual.protocol==='https:')&&/RootWebArea\s+"[^"\n]+"/.test(view.browser.snapshot)&&!/chrome-error:|ERR_[A-Z_]+|siteye ulaşılamıyor|site can.t be reached|Access Denied|Checking your browser|Just a moment/i.test(view.browser.snapshot);
 }catch{return false;}
}
function preferDesktopText(request,view){
 if(/oyun|game|görsel|resim|fotoğraf|çizim|çiz\b|paint|tasarım|harita|ekrana bak|ekran görüntüsü|screenshot|canvas/iu.test(request))return false;
 return (view.elements||[]).filter(e=>e.name&&e.type!=='ControlType.Document'&&/ControlType\.(?:Button|Edit|MenuItem|TreeItem|ListItem|TabItem|CheckBox|ComboBox)$/.test(e.type)).length>=3;
}
module.exports={standaloneNavigation,landingVerified,preferDesktopText};
