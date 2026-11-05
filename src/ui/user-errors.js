(function(root){
 const catalog=Object.create(null);
 function add(codes,title,message,enTitle,enMessage){for(const code of codes.split(' '))catalog[code]={title,message,enTitle,enMessage};}
 add('DESKTOP_CAPABILITY_UNAVAILABLE','Cihaz bağlantısı kullanılamıyor','Sohbet sunucusu cihaz yeteneklerini kabul etmedi. İşlem başlatılmadı. Uygulamayı güncelleyip yeniden deneyin.','Device connection unavailable','The chat service did not accept device capabilities. No action was started. Update the app and try again.');
 add('INSUFFICIENT_TOKENS','Token limitiniz yetersiz','Bu mesajı yanıtlamak için kullanılabilir tokenınız yeterli değil. Hesabınızdaki token kullanımını ve bekleyen işlemleri kontrol edin.','Not enough available tokens','There are not enough available tokens for this message. Check your token usage and pending requests.');
 add('TOKEN_USAGE_RECONCILIATION_REQUIRED TOKEN_RECONCILIATION_REQUIRED','Token kullanımınız kontrol ediliyor','Önceki bir işlemin token kullanımı henüz kesinleşmedi. Bekleyen işlemlerinizi kontrol edin; sorun sürerse destekle iletişime geçin.','Token usage is being checked','Usage from a previous request is still pending. Check your pending requests or contact support if this continues.');
 add('SUBSCRIPTION_TOKEN_LIMIT','Kullanım limitinize ulaştınız','Aboneliğinizin kullanım sınırına ulaştınız. Bir süre sonra yeniden deneyin veya planınızın limitlerini kontrol edin.','Usage limit reached','Try again later or check the usage limits of your plan.');
 add('SUBSCRIPTION_NOT_AVAILABLE','Aboneliğiniz bu işlem için uygun değil','Aboneliğinizin durumunu kontrol edin veya hesabınıza açık başka bir model seçin.','Subscription unavailable','Check your subscription or choose another model available to your account.');
 add('LOGIN_REQUIRED UNAUTHORIZED','Yeniden giriş yapmanız gerekiyor','Oturumunuz sona ermiş olabilir. Hesabınıza giriş yapıp tekrar deneyin.','Please sign in again','Your session may have expired. Sign in and try again.');
 add('ACCOUNT_UNAVAILABLE ACCESS_DENIED','Bu işlem için erişiminiz yok','Hesabınızın durumunu ve bu işlemi kullanma yetkinizi kontrol edin.','Access unavailable','Check your account status and permissions for this action.');
 add('RATE_LIMITED PROVIDER_RATE_LIMIT TOO_MANY_RUNS','Çok fazla istek gönderildi','Biraz bekleyin ve devam eden işlemler tamamlandıktan sonra tekrar deneyin.','Too many requests','Wait a moment and let current requests finish before trying again.');
 add('RUN_IN_PROGRESS','Bir yanıt zaten hazırlanıyor','Yeni mesaj göndermeden önce mevcut yanıtı bekleyin veya yanıtı durdurun.','A reply is already being prepared','Wait for the current reply or stop it before sending another message.');
 add('PROVIDER_TIMEOUT REQUEST_TIMEOUT','Yanıt beklenenden uzun sürdü','Model şu anda zamanında yanıt veremiyor. Biraz sonra tekrar deneyin veya başka bir model seçin.','The reply took too long','Try again shortly or choose another model.');
 add('NETWORK_ERROR PROVIDER_CONNECTION_ERROR SERVER_UNAVAILABLE','Sunucuya bağlanılamadı','İnternet bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse biraz bekleyin.','Could not connect to the server','Check your internet connection and try again. If this continues, wait a moment.');
 add('MODEL_NOT_AVAILABLE MODEL_UNAVAILABLE','Seçilen model şu anda kullanılamıyor','Model listesini yenileyin veya hesabınıza açık başka bir model seçin.','This model is unavailable','Refresh the model list or choose another available model.');
 add('MODEL_MEDIA_UNAVAILABLE','Model bu işlemi desteklemiyor','İstediğiniz işlem veya dosya türünü destekleyen başka bir model seçin.','This model does not support the action','Choose a model that supports this action or file type.');
 add('PROVIDER_AUTH_FAILED PROVIDER_REJECTED INVALID_PROVIDER_RESPONSE','Model şu anda yanıt veremiyor','Model hizmetinde bir sorun oluştu. Biraz sonra tekrar deneyin veya başka bir model seçin.','The model could not reply','Try again shortly or choose another model.');
 add('PROVIDER_TOOL_UNAVAILABLE','İstenen özellik şu anda kullanılamıyor','Model bu bağlantıda kullanılamayan bir özellik istedi. Sorunuzu farklı şekilde sorabilir veya başka bir model seçebilirsiniz.','The requested feature is unavailable','Rephrase your question or choose another model.');
 add('CONTEXT_LIMIT','Bu sohbet modelin sınırına ulaştı','Yeni bir sohbet başlatın veya mesajınızı ve eklerinizi kısaltarak tekrar deneyin.','This conversation reached the model limit','Start a new chat or shorten your message and attachments.');
 add('CONVERSATION_CHANGED stale','Sohbet başka bir yerde güncellendi','Sohbeti yenileyip tekrar deneyin. Yazdığınız mesaj gönderilemediyse taslağınızı koruyun.','The conversation changed','Refresh the conversation and try again. Keep your draft if it was not sent.');
 add('CHAT_ARCHIVED','Bu sohbet arşivlenmiş','Devam etmek için sohbeti arşivden çıkarın veya yeni bir sohbet başlatın.','This chat is archived','Restore it from the archive or start a new chat.');
 add('ANSWER_QUALITY_FAILED INVALID_SOURCE_CITATION','Güvenilir bir yanıt oluşturulamadı','Modelin yanıtı doğrulanamadığı için gösterilemiyor. Sorunuzu netleştirerek tekrar deneyin veya başka bir model seçin.','A reliable reply could not be produced','Clarify your question or choose another model.');
 add('MEMORY_CONTEXT_CHANGED MODEL_KNOWLEDGE_CHANGED','Sohbet bilgileri güncellendi','Kullanılan bilgiler değişti. Güncel bilgilerle yanıt almak için mesajınızı yeniden gönderin.','Conversation information changed','Send your message again to use the updated information.');
 add('CANCELED CANCELLED','Yanıt durduruldu','Hazır olduğunuzda yeni bir mesaj gönderebilirsiniz.','Reply stopped','Send another message when you are ready.');
 add('INVALID_REQUEST','Mesaj gönderilemedi','Mesajınızı ve eklerinizi kontrol edip tekrar deneyin.','Your message could not be sent','Check your message and attachments and try again.');
 const fallback={title:'İşlem tamamlanamadı',message:'Beklenmeyen bir sorun oluştu. Tekrar deneyin; sorun sürerse destekle iletişime geçin.',enTitle:'The action could not be completed',enMessage:'Try again. If the problem continues, contact support.'};
 function normalize(value){return typeof value==='string'?value.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'').trim():'';}
 function describe(value,language='tr'){
  const item=catalog[normalize(value)]||fallback;
  return /^tr(?:-|$)/i.test(language)?{title:item.title,message:item.message}:{title:item.enTitle,message:item.enMessage};
 }
 function responseCode(status,body){
  const values=Array.isArray(body?.message)?body.message:[body?.message,body?.code];
  for(const value of values)if(typeof value==='string'&&Object.hasOwn(catalog,value))return value;
  return ({401:'LOGIN_REQUIRED',403:'ACCESS_DENIED',409:'CONVERSATION_CHANGED',429:'RATE_LIMITED'})[status]||(status>=500?'SERVER_UNAVAILABLE':'INVALID_REQUEST');
 }
 function render(document,code,translate){
  const box=document.getElementById('chat-error');if(!box)return;
  const title=document.getElementById('chat-error-title'),detail=document.getElementById('chat-error-detail');
  box.hidden=!code;if(!code){title.textContent='';detail.textContent='';return;}
  const info=describe(code,document.documentElement?.lang||'tr');
  title.textContent=info.title;detail.textContent=info.message;
 }
 const api={describe,responseCode,render,isKnown:value=>Object.hasOwn(catalog,normalize(value))};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.UmayErrors=api;
})(globalThis);
