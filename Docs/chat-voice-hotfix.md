# Sohbet, bilgisayar görevi ve ses gecikmesi — 0.5.1

## Gerçek kayıtlarda bulunan nedenler

- Geçici STT metni, henüz kullanıcı cümlesi tamamlanmadan bekleyen sohbet yanıtını iptal ediyordu. 5 Kasım 16:01–16:02 UTC kayıtlarında arka arkaya `CANCELED` ve eksik kullanım nedeniyle `NEEDS_RECONCILIATION` oluşmuştu.
- Yeni mesaj önceki istekten daha hızlı gelince eski POST/yanıt ve sohbet sürümü karışabiliyordu. En son assistant mesajını seçmek, o isteğe ait olmayan eski bir yanıtı okutabiliyordu.
- Bilgisayar planlayıcısının JSON gözlemleri ve eylemleri, normal sohbet hafızasına geri çağrılıyordu. Arşiv ve arama korunarak yalnız otomatik sohbet bağlamından çıkarıldı; bunlardan türemiş eski profil kaynakları da filtrelendi.
- Sunucu, cihaz bağlamını yüklenmiş belge bağlamına ekliyordu. Böylece normal konuşmalar belge gibi etiketleniyor, yerel profil onayının hızlı yolu da devre dışı kalıyordu. Cihaz bağlamı artık ayrı, güvenilmeyen veri olarak ekleniyor.
- Gerçek topolojide frontend üzerinde de `CHAT_WORKER_ENABLED=true` vardı. Eski frontend yürütücüsü, yeni iki worker ile aynı işleri kapmak için yarışıyordu; istekler farklı protokol sürümleriyle yanıtlanabiliyordu. Frontend üzerinde yalnız bu bayrak kapatıldı. Kuyruk/bildirim ve HTTP okuma-yazma sürüyor; iki güncel worker çalıştırıyor. Sonraki dağıtımlarda `server/compose.umay-workers.yaml` de eklenmelidir.
- Canlı Alfa1.3 testinde yalnız metinle «açıyorum» denebiliyor, gerçek görev kaydı oluşmayabiliyordu. Masaüstü istemcisi için `umay_start_computer_task` işlevi tanımlandı; doğrulanmış işlev isteği mevcut `desktopChatTask` aktarımına çevriliyor. İşlev desteklemeyen sağlayıcılar için mevcut JSON protokolü ve sınırlı düzeltme yolu korunuyor. Eylem yetkisi yine asıl kullanıcı mesajından geliyor.
- İstemci model yanıtının tamamını bekliyor, görev başlangıcını da görev sonucuna kadar seslendirmiyordu. Başlangıç bildirimi görevle birlikte seslendiriliyor. Basit sosyal konuşmalarda yalnız açıkça kamusal JSON yanıt alanı akıtılabilir; araştırma/inceleme ve bilgisayar protokolü taslakları akıtılmaz.
- Bilgisayar planlayıcısı her turda zaten kapsam, kullanıcı onayları, önceki adımlar ve güncel ekranı almasına rağmen bütün eski gözlem mesajlarını da yeniden okuyordu. Son tur kendi tam bağlamıyla gönderilir; eski ekranlar birikmez. Bu değişiklik normal sohbet geçmişini kısaltmaz.
- Gerçek UIA gözleminde klavye odağı eksikti. `focused` ve `focusedElementId` eklendi; büyük ağaçlarda odaktaki öğe bağlam bütçesinden atılmaz. Böylece model, bir alanı seçtiğini gerçek durumdan görebilir. Tuş/fare ve parola dışlama sınırları korunur.

## Değişen davranış

Geçici tanıma metni ekranda görünür; tek başına sunucu yanıtını iptal etmez. Gerçek yeni cümle veya yerel dur komutu eski yerel çıktıyı susturur. Kabul edilmiş sağlayıcı isteği kullanım muhasebesini tamamlar; eski nesil sonuç yeni ses veya bilgisayar eylemi başlatamaz. Sonraki yazma güncel sohbet sürümünü alır.

Yanıtlar sunucunun `userMessageId` / `assistantMessageId` alanlarıyla eşleştirilir. Eski sunucular için sınırlı kullanıcı-mesajı eşleştirmesi vardır. Güncel yanıt bulunamazsa eski mesajı okumak yerine sohbet içinde anlaşılır hata gösterilir.

Ses parçaları istek nesliyle etiketlenir ve sırayla çözülür. Durdurulmuş bir isteğin geç gelen sesi oynatılmaz. Erken okunan cümleler nihai yanıtta tekrarlanmaz. Türkçe STT/TTS modelleri, klon profilleri ve noktalama motoru değiştirilmedi.

## Doğrulama

- `npm test`: **184/184**. İptal, geç POST, sürüm, doğru yanıt sahipliği, akışta erken cümle, tekrarsız ses, geç veya çözülmekte olan eski sesin reddi, hafıza kirliliği, büyük UIA ağacında gerçek odağın korunması ve işlev aktarımı dahil.
- Python konuşma/klonlama/noktalama/worker/live-STT: **60/60**.
- Gerçek getUserMedia → Seda → normal sohbet → otomatik görev aktarımı → Pocket TTS/WebAudio: geçti. Son kaynakta hazır yanıtın görüntülenmesinden ilk WAV parçasına **261 ms**, oynatmaya **356 ms**. Bu modelin düşünme/iletişim süresi değildir. Mikrofon açık kaldı; sonuç yanıtı ayrıca doğrulandı. Ses girişi kontrollü dosyadır; fiziksel insan mikrofon kaydı değildir. Test çıkışı kullanıcının açık asistanına geri beslenmemesi için sessize alındı; WebAudio akışı gerçekten çalıştı.
- Kaynak ve paket modüllerinde gerçek Windows odağı/UIA → arka plan iş takibi → gerçek sonraki bölüm tıklaması: geçti. Model sağlayıcısı bu regresyonda kontrollüdür.
- Gerçek native odak regresyonu önce `focused` eksikliğiyle RED, ardından GREEN oldu. Odaklanmış öğe gerçek UIA'dan döndü; W/Shift/fare bırakma **53 ms**, arka plan takibi ve parola dışlaması geçti.
- Son paket modülleriyle aynı native/odak testi geçti; basılı tuş/fare bırakma **49 ms**. Gerçek mikrofon dosyası→Seda `Dur`→yerel duraklatma **161 ms**, mikrofon açık ve F8 kesin durdurma geçti. Bu denemede W zaten iki saniyelik güvenli süresiyle bırakılmıştı; ses komutuna bağlanan sahte bir key-up ölçümü yapılmadı ve duraklatmadan sonra yeni key-down olmadığı doğrulandı.
- Paket içindeki Python ve konuşma dosyalarıyla gerçek TTS: varsayılan ilk ses **178,2 ms**, mevcut klon ilk ses **195,1 ms**. İki denemede de ses profilleri değişmedi. İlk yükleme maliyeti ayrıca ölçülür; bu sayılar sıcak model içindir.
- Paket doğrulaması: **42 kaynak dosyası**, açılmış native yardımcı ve dört konuşma modülü kaynakla aynı. Runtime **25.293 dosya / 988.913.248 bayt**, tüm kaynak dosyalarının uzunlukları paketle aynı.
- Sunucu adayı gerçek HTTP / geçici PostgreSQL / kontrollü SSE ile test edildi: belge-cihaz bağlamı ayrımı, yerel profil onayı, gerçek işlev çağrısının görev aktarımı, erken kamusal taslak ve inceleme sırasında taslak gizliliği geçti. Üretim kullanıcıları, DB şeması veya bakiye kayıtlarına bu izole testlerde elle müdahale edilmedi.

Gerçek Veriüssü oturumu → atanmış Alfa1.3 sohbet modeli → Alfa1.2 planlayıcı → gerçek Windows odağı/tıklama/metin → görünür textarea sonkoşulu geçti. Yalnız test penceresine girişe izin verildi; kullanıcı dosyalarına dokunulmadı. Ara ölçümler **41.838 ms**, **58.069 ms** ve dört tekrar tıklamalı denemede **92.321 ms** idi. Odak bilgisi eklendikten sonraki son deneme **34.581 ms**, bir tıklama ve bir metin girişiyle tamamlandı. Bunlar tekil canlı model denemeleridir; sabit bir hız garantisi veya yalnız bir değişkenin etkisini kanıtlayan kıyas değildir. Sıcak TTS ilk-ses süresi bunlardan ayrıdır.

Hiçbir test tüm oyunların/uygulamaların veya fiziksel mikrofon koşullarının kusursuz olduğunu göstermez. Sağlayıcı akışı toplu döndürürse uygulama henüz ulaşmamış kelimeleri seslendiremez. Canlı küçük sohbet/görev aktarımı denemelerinde modelin toplam yanıt süresi birkaç saniye arasında değişti; anlık model cevabı garantisi verilmez.

## Dağıtım

Sürüm **0.5.1**. İki worker için son yedek `/root/umay-reply-1793903308`; frontend alan güncellemesi yedeği `/root/umay-reply-1793898858`; eski frontend yürütücüsünü kapatma yedeği `/root/umay-worker-isolation-1793902464`. İmajlar değişmez kimlikleriyle test edilip etkinleştirildi. Yalnız frontend'in `CHAT_WORKER_ENABLED` bayrağı `false` oldu; diğer ortam değerleri, portlar ve mount'lar korundu. 10203 geçidi, kimlik doğrulama ve DB şeması değiştirilmedi. Eski bilinmeyen token kullanımları sıfırlanmadı.

Basit sohbet/ekran kararı için `reasoning_effort=none` desteği bir kez denenir; 400/422 reddinde aynı istekte `minimal` ayarına dönülür ve ret beş dakika hatırlanır. Kontrollü HTTP testi bu dönüşün akışı kapatmadığını doğruladı. Gerçek Alfa1.2 testi de parametreyi reddetti; bu sağlayıcıda düşünmenin kapatıldığı veya bu denemenin hız kazandırdığı iddia edilmez. Mevcut kullanıcı model rolleri değiştirilmedi; ikinci görsel model denemesi sağlayıcı tarafından reddedildi.

`dist/Umay Setup 0.5.1.exe` — **345.569.400 bayt**. SHA256: `8f77b76da911f2423ac4af941efae8925f54a408b209e01895125e77e2fa85f6`. Kaynak paket `dist/hotfix-0.5.1`; güncelleme metadata'sının SHA512 özeti son kurulumla aynı. Geçici gerçek test oturumu iptal edildi. Son canlı Alfa1.3 denemelerinde erken kamusal taslak ulaşmadı; bu sağlayıcı için yanıt tamamlanmadan ses geldiği iddia edilmez. İstemci, görev başlangıcını görev sonucundan bağımsız seslendirir. Sürüm mevcut kullanıcı kararı gereği imzasız test kurulumudur.
