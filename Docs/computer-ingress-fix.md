# Sohbetten gerçek bilgisayar işlemi — 0.4.4

## Yeniden üretilen sorun

Kullanıcının 5 Kasım konuşmasında «selam masaüstüne dosya adında yeni klasör oluştur» isteği, klasör oluşturma adımlarını anlatan bir yanıt aldı. Kurulu paket 0.4.3 ve kaynaklarla aynıydı; ilgili sunucu run kaydının `media_options` alanı boştu.

Gerçek mimari: `veriussu.com` → frontend API; `chat.veriussu.com:443` → 10203'te `scripts/chat-coming-soon.mjs` → aynı frontend API → kuyruk → iki chat worker. 0.4.3 güncellemesinde chat imajındaki kullanılmayan controller ve çalışanların controller'ı güncellenmişti. Gerçek HTTP girişinin frontend DTO'su eskiydi. Cihaz alanlarını 400 ile reddediyor, istemci de `INVALID_REQUEST` sonrasında alanları kaldırıp tekrar gönderiyordu. Bu nedenle modele bilgisayar yetenekleri hiç ulaşmıyordu. Önceki izole worker testleri gerçek frontend girişinin çalıştığını kanıtlamıyordu.

## Düzeltmeler

- Frontend girişine önceden incelenen bilgisayar DTO/controller desteği ve `desktop-context` yardımcısı taşındı. Frontend execution modülünde yalnızca run alanlarının gizliliği ve geçici görüntü temizliği güncellendi. 10203 geçidi, portlar ve iki worker düzeni korunuyor.
- İstemci artık cihaz yeteneklerini sessizce kaldırıp sıradan sohbete dönmüyor. Böyle bir uyumsuzlukta işlem başlamadığı açıkça gösteriliyor.
- Canlı Alfa1.2 denemelerinde eksik `displayId` görüldü. Görsel modele bu adımda yalnızca bir ekran görüntüsü gönderiliyorsa, eksik kimlik o görüntüye bağlanıyor. Açıkça belirtilen yanlış kimlik düzeltilmiyor; koordinat sınırı, gözlem güncelliği, metin modeli kısıtı ve izinler korunuyor.
- Windows klavye kısayolları yetenek bağlamında belirtiliyor; model güvenilir kısayolları menü koordinatları yerine kullanabiliyor.
- `done` yanıtında `message` eksik ama dolu `summary` varsa bu özet sonuç olarak gösteriliyor. İşlem/onay türleri bu uyumluluk kuralından etkilenmiyor.
- Sağlayıcının `ANSWER_QUALITY_FAILED` / `INVALID_PROVIDER_RESPONSE` yanıtları, uygulanmamış bozuk planner yanıtı gibi mevcut iki denemelik sınır içinde yeni gözlemle tekrar deneniyor. Token, erişim ve kısmi native giriş hataları tekrar edilmiyor.
- Açıkça «masaüstüne X adında klasör oluştur» istenmişse, `done` sonucundan önce gerçek Windows Desktop yolunda istenen klasörün varlığı salt okunur olarak denetleniyor. Adı yazılmış ama Enter ile onaylanmamış «Yeni klasör» başarı sayılmıyor. Eksik sonuç yeni gözlem ve aynı sınırlı düzeltme akışına gider. Denetleyici dosya oluşturmaz/taşımaz/silmez; yalnızca asıl kullanıcı isteğini kullanır. Başka görevlerde mevcut ekran/UIA denetimi sürer.

## Sunucu doğrulaması ve geri dönüş

`server/update-desktop-ingress.py prepare` gerçek frontend imajında hatayı RED olarak üretti. Adayın aynı HTTP testleri izole, geçici PostgreSQL veritabanında GREEN oldu. Testler cihaz alanlarının kabulü ve kaydı, görev metadata'sının geri dönmesi, bağlam/görüntü gizliliği, kuyruk iptalinde görüntü temizliği ve normal sohbet uyumluluğunu kapsar. Model/sağlayıcı bu giriş testinde çağrılmaz.

Etkin frontend imajı `veriussu-umay-ingress:0.4.4`; gerçek dağıtılan imaj kimliği yedek manifestinde sabittir. Hazırlama testi ve aktivasyon bundan sonra değiştirilebilir etiket yerine aynı immutable image ID'yi kullanır ve aktivasyon bu ID'yi doğrular. İncelemedeki bu bulgu giderildi.

Yedek: `/root/umay-ingress-1793874532`; staging: `/root/umay-ingress-stage-0.4.4`. `before.json`, `rollback.json`, aday modüller ve izole test kayıtları burada tutulur. Geri dönüş, mevcut Compose dosyalarına `rollback.json` son overlay olacak şekilde yalnızca `frontend` servisine `up -d --no-deps --pull never frontend` uygular. Yedek ortam değişkenlerini içerdiğinden gizlidir ve kullanıcıya/repoya aktarılmaz.

Canlı audit: frontend + 10203 geçidi + iki worker healthy. Üç değişen modül adayla birebir; tüm public dosyalarının toplu SHA256 özeti, ortam değişkenleri, portlar ve mount'lar önceki frontend imajıyla aynı. DB şeması ve kullanıcı bakiyeleri elle değiştirilmedi. Kullanıcı hesabıyla canlı kabul için kısa ömürlü, ayrı test oturumu kullanılır; var olan kullanıcı oturumu okunmaz/değiştirilmez ve test oturumu iş bitiminde iptal edilir.

## Canlı kabul

`tests/electron-live-computer.cjs`, açıkça verilen kısa ömürlü test oturumuyla normal uygulama/sohbet/IPC, gerçek hesap modeli, gerçek ekran/UIA ve Windows SendInput zincirini çalıştırır. Tek yeni masaüstü klasörü oluşturur ve görsel denetim için bırakır. Var olan hedefi değiştirmez; sahte model veya native dosya oluşturma taklidi kullanmaz. Hata/zaman aşımında etkin görevi durdurur.

İlk gerçek denemelerde `Umay Kontrol Testi 05112026` klasörü oluştu; modelin `done + summary` yanıtı sonucun gösterilmesini geciktirdi. Bu gözlem yukarıdaki uyumluluk düzeltmesine dönüştürüldü. Daha sonraki «dosya» denemesinde model Enter ile adlandırmayı tamamlamadan başarı bildirdi. Bağımsız dosya sistemi kabulü bunu yakaladı; bu nedenle gerçek klasör sonkoşulu eklendi. Gerçek Alfa1.2/Windows zinciriyle `Desktop/dosya` daha sonra gerçekten oluştu; model bu kez gereksiz isim çakışması sorusu sordu. Salt okunur koşul artık işlem öncesinde ve her native adım sonrasında kontrol edilerek doğrulanmış tek hedefin gereksiz yeni model turu olmadan bitirilmesini sağlar. Birleşik oluştur→yeniden adlandır/taşı/sil görevlerinde bu dar koşul kullanılmaz.

Son gerçek model tekrarı `TOKEN_USAGE_RECONCILIATION_REQUIRED` ile engellendi. Bu uyarı uygulamada gösterildi; kullanıcı bakiyesi/rezervasyonları elle değiştirilmedi ve test geçmiş sayılmadı. Yalnızca bu kabul için açılan test oturumu iptal edildi; gerçek kullanıcı oturumu korunur.

Son kaynak ve paket kabulü, kontrollü sağlayıcı + **gerçek** Windows girişleriyle ayrı yürütüldü: normal sohbet → dispatch → Windows Run → Desktop Explorer → Ctrl+Shift+N → Unicode ad → Enter → gerçek dizin → otomatik doğrulanmış tamamlanma. Kaynakta `Umay Son Kontrol 05112026`, paket modüllerinde `Umay Paket Kontrol 05112026` oluştu. Dosyayı test kodu oluşturmaz. Bu sonuç gerçek dış modelin gecikme/kalite garantisi değildir.

## Son doğrulama ve paket

- `npm test`: **150/150**.
- Gerçek Electron sohbet içi görev/soru/özel onay/Windows izin düğmesi, ayrı model rolü, hesap temizliği ve normal sohbet regresyonu geçti.
- Ayarlar/model rolleri, yerel hafıza, Windows güvenli saklama, ortam bilgisi ve açık/koyu tema UI kontrolü geçti.
- Gerçek mikrofon yakalama → Seda → normal sohbet → otomatik görev devri → Pocket TTS/WebAudio: geçti; dinleme açık, ilk ses398ms, oynatma422ms. Bu ses testinin sağlayıcı ve native dispatch bölümü kontrollüdür; fiziksel insan mikrofonu veya dış model yanıt süresi değildir.
- Kaynak ve son paket içinden gerçek Windows ile yeni Desktop klasörü oluşturma ve dosya sistemi sonucu: geçti.
- `node tests/verify-computer-package.cjs dist/umay-0.4.4/win-unpacked/resources`:39 uygulama dosyası, unpacked native yardımcı ve4 ses dosyası kaynaklarla birebir.
- Bağımsız incelemede mutable imaj, başarısız POST sonrası eski conversation sürümü ve birleşik görevde yanlış sonkoşul bulguları RED→GREEN düzeltildi; son incelemede açık bulgu yok.

Dağıtılacak dosya: `dist/Umay Setup 0.4.4.exe`;478607815 bayt; SHA256 `2a7dd5d9c3beaf3ec2007e7ed4cc3f84f94363c7143b310670a3f5a3ef2c2521`. Asıl çıktı `dist/umay-0.4.4` altındadır. Önceki0.4.4 ara build klasörleri son kaynakları temsil etmez; yalnızca bu son çıktı veya dist kökündeki kopya kullanılmalıdır. Kullanıcının önceki kararı gereği imzasız test paketidir. Mevcut0.4.3 süreçte hatalı uyumluluk durumu önbellekte kalabildiğinden güncelleme sonrası uygulama yeniden açılmalıdır.

Süreler seçilen dış modelin yanıt süresine bağlıdır. Gerçek modelde uzun beklemeler ve bir sağlayıcı kalite reddi gözlendi; bu sürüm «her işlemi anında/kusursuz yapar» garantisi vermez. STT/TTS, klonlama ve Windows UAC mekanizması değiştirilmedi.
