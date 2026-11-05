# Sohbetten doğal bilgisayar kullanımı

Kullanıcının düzeltmesi: ayrı Bilgisayar sayfası ve «Bilgisayarda çalış» kutusu istenmiyor. Sesli/yazılı normal sohbet isteği gerektiğinde bilgisayar görevine dönüşür; soru, izin ve sonuç aynı sohbette kalır. Ayarlar / Modeller'deki iki rol korunur.

Mevcut sohbet modelinin aynı yanıtında yapılandırılmış görev devri kullanılır; her mesajdan önce ikinci bir sınıflandırma çağrısı eklenmez. Sunucu yalnızca destek bildiren Umay isteğinde görev zarfını tanır, sohbet mesajına okunabilir açıklama kaydeder, görevi ilgili tamamlanmış run metadata'sında döndürür. Normal web sohbeti ve sıradan yanıt akışı değişmez.

Yerel uygulama görevi run kimliğiyle doğrular: kullanıcıya ait tamamlanmış güncel run, eşleşen sohbet, geçerli metadata ve bir kez yürütme. Atanmış computer modeliyle mevcut gözlem/giriş motoruna geçilir. Kullanıcının açık eylem isteği normal kontrol iznidir; gerçek Windows yönetici onayı sohbet kartındaki düğmeyle istenir.

## Adımlar

- [x] Backend görev devri ve normal cevap testleri; aynı run tekrar çalışmaz, eski/yanlış sohbet/hesap değişimi iptal edilir.
- [x] Sohbet modeline server-side yetenek talimatı, okunabilir açıklama ve run metadata'sı. Yanıt kontrolü gerçek görev zarfına uygulanmaz; kullanıcıya uygulanmamış iş tamamlanmış gibi söylenmez.
- [x] Bilgisayar sayfası/nav/kutu/form kaldırılır; görev kartı mevcut sohbet mesajları arasında gösterilir. Normal metin/sesli send aynı yoldan dispatch yapar.
- [x] Ek bilgi ve onay sesli/yazılı yanıtla veya kart düğmesiyle tamamlanır; UAC gerçek kullanıcı onayını korur. Sonuç bir kez seslendirilir; mikrofon/STT/TTS akışı korunur.
- [x] Görev sonucu yerel asıl sohbet arşivine de kaydedilir; sonraki konuşma bağlamına girer.
- [x] Birim/Electron/gerçek Windows/konuşma regresyonları, izole sunucu HTTP/DB testleri, bağımsız inceleme.
- [x] Sunucu yalnız gerekli modüllerle yedekli güncellenir;10203/ortam/normal sohbet korunur. Windows paketini üret ve doğrula.

## 0.4.3 sonucu

Ayrı Bilgisayar sayfası, gezinme düğmesi, görev formu, ekran önizleme formu ve «Bilgisayarda çalış» kutusu kaldırıldı. Ayarlar / Modeller'de sohbet ve bilgisayar rolleri korunur. Normal sohbet yanıtının run metadata'sı doğrulanmış görev içerirse mevcut bilgisayar motoru otomatik devralır. İzin/soru/görev kartı aynı sohbetin mesajları arasındadır. Kullanıcının «Belgeler klasörüne», «evet», «vazgeç» veya Windows onayını açma isteği sesli/yazılı aynı send akışında işlenir; belirsiz bir ifade onay sayılmaz.

Görev devri normal modele ek sınıflandırma isteği göndermez. Sıradan sohbet cevapları değişmez. Görev açıklaması sunucudaki asıl assistant mesajı olarak okunabilir metinle saklanır; ham kontrol JSON'u kullanıcıya gösterilmez. Sonuçlar ve devam yanıtları yerel asıl sohbet arşivine sunucu mesaj kimliğiyle bağlanır; sonraki app geçmişinde gösterilir. Web sohbeti masaüstü yürütmez; merkezi geçmişte başlangıç açıklamasını görür, cihazın yerel görev ayrıntıları Umay'da tutulur.

## Doğrulama

- `npm test`:141/141 geçti; ses testleri60/60 geçti.
- Gerçek Electron: normal yazılı mesajdan dispatch, atanmış ayrı model, sayfa/kutu olmaması, aynı sohbette soru → sesli yanıt → özel işlem onayı → tamamlanma; onay öncesi hiçbir click yok; Windows izin düğmesi, normal «selam» cevabı ve hesap temizliği.
- Gerçek mikrofon yakalama → Seda STT → normal sohbet → otomatik dispatch → sonucun Pocket TTS/WebAudio ile seslendirilmesi: başarılı, dinleme açık. Test girdisi `tests/fixtures/computer-command.wav` varsayılan TTS sesiyle üretilmiş «Not Defteri aç ve bugünkü planımı Belgeler klasörüne kaydet.» kaydıdır; fiziksel insan mikrofon kaydı değildir. Sağlayıcı ve native dispatch bu ses testinde kontrollüdür. İlk ses167ms, oynatma223ms; gerçek dış model yanıt süresi ölçümü değildir.
- Gerçek Windows fare/klavye/UIA/gözlem ve F8 regresyonu geçti. Paket modüllerinden aynı Windows testi ve sohbet görevi/ayarlar/hafıza/konum/tema UI testleri geçti. Yönetici yardımcısı, STT/TTS ve klonlama kodu değiştirilmedi.
- Paket:38 uygulama dosyası, unpacked native yardımcı ve4 ses dosyası kaynaklarla aynı.
- Bağımsız incelemede2 önemli bulgu testle yeniden üretildi ve düzeltildi: cihaz/sunucu saat farkında eski görev sonucunun yeni cevabı ezmesi; modelin önerdiği hedefin asıl kullanıcı yetkisi gibi yorumlanması.
- Arşiv sırası sunucu acknowledgement mesaj kimliğine bağlanır; son yanıt seçimi yerel görev kayıtlarını dışlar. Native dispatch orijinal kullanıcı isteği ve sunucu mesaj bağı olmadan başlamaz. Planlayıcıya tam asıl istek, modelin önerisi ve sonraki gerçek yanıt/onaylar ayrı taşınır. Hassas ek etkiler için özel onay gerekir; yönetici grant kapsam genişletmez.

## Sunucu dağıtımı

Yedek ve aday: `/root/umay-computer-1793872650`. Mevcut image'lar üzerinde sadece `desktop-context.js` ve desktop destekli worker'ın `chat-execution.js` modülüne denetimli overlay uygulanır. `server/patch-chat-dispatch.cjs` beklenen her kod noktasının tam bir kez bulunmasını şart koşar; kaynak sürümü kaymışsa build başarısız olur. `server/compile-computer-planner.cjs` bu yamayı derleme sonrası uygular. Bu release'e ait runtime overlay sunucu yayın akışının parçasıdır; ileride worker'ı temiz kaynak derlemesiyle değiştirirken aynı görev devri davranışı da taşınmalıdır.

İzole gerçek HTTP/PostgreSQL/sağlayıcı testi önce canlı eski sürümde eksik handoff metadata'sıyla başarısız, adayda başarılı oldu. Task metadata'sının doğru sunucu assistant mesajına bağlanması, okunabilir açıklama, sonraki normal cevap, eski computer planner, görüntü temizliği ve geçmiş sayfalama geçti. Geçici DB silindi. Dağıtım öncesi etkin chat run sayısı0 idi. Chat ve iki worker healthy; aday modül SHA256'ları birebir, controller modülü/ortam değişkenleri/portlar öncekiyle aynı.10203 auth isteği beklenen401 yanıtını verdi. DB şeması, bakiyeler ve web varlıkları değiştirilmedi.

## Kurulum

`dist/Umay Setup 0.4.3.exe`:478606221 bayt; SHA256 `996af8adb3da7141ac9d96fb783f919d7d92e5e50798b80d634c4be2b0a748a4`. Çıktı `dist/chat-0.4.3` altında üretildi ve kurulum dosyası dist köküne kopyalandı. Doğrulama: `node tests/verify-computer-package.cjs dist/chat-0.4.3/win-unpacked/resources`. Önceki kullanıcı kararı gereği imzasız test paketi.

Canlı dış modellerin doğal dil/işlem kalitesi her modelde aynı değildir; bu çalışma sağlayıcıyı değiştirmez. Mevcut site istek sınırları, görev adım/süre sınırları, F8 ve gerçek Windows UAC gerekliliği korunur. Standart kullanıcıdan UAC kabul/ret penceresi önceki oturumda doğrulanmadı; yönetici penceresi ve helper kapanışı0.4.2'de gerçek Windows'ta doğrulanmıştı.
