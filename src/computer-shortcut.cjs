'use strict';
class ComputerShortcut{
 constructor(shortcuts,stop){this.shortcuts=shortcuts;this.stop=stop;}
 start(){if(!this.shortcuts.isRegistered('F8')&&!this.shortcuts.register('F8',this.stop))throw Error('F8 durdurma tuşu başka bir uygulama tarafından kullanılıyor. Tuşu serbest bırakıp tekrar deneyin.');}
 finish(task,backgroundActive=false){if(!backgroundActive&&(!task||!['running','paused','permission','question','confirmation'].includes(task.status)))this.shortcuts.unregister('F8');}
}
module.exports={ComputerShortcut};
