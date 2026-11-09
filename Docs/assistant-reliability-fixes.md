# Ekran, devamlılık, Chrome ve doğal konuşma düzeltmeleri

2026-11-09. Kullanıcının yedi hata bildirimi için mevcut mimaride düzeltme planı. Kullanıcı doğrudan düzeltme ve tek tek test istedi; kapsam yeni özellik tasarımı değildir. Taban c331097, kurulu sürüm0.8.5. Mevcut Windows/Electron, Chrome DevTools MCP, Seda STT ve Pocket TTS korunur.

## Kanıt ve yöntem

Son yerel görev/sohbet kayıtlarında Chrome profil seçme isteği web sayfasına gitme hedefine dönüşmüş; selamlaşmaya eski test görevleri ve yanlış asistan kimliği karışmış. CONTEXT_LIMIT ve PROVIDER_RATE_LIMIT hataları ayrı kayıtlarda var. Kişisel Chrome yerine managed profil varsayılanı ve native başlığa eşleme sırasında çok sayfalı seri sorgu kaynakta doğrulandı. STT600ms belgelenirken350ms sessizlikle cümle kapatıyor; ayrı polling parçalarında TTS son noktalama arası kayboluyor. Gerçek kişinin algısal ses kalitesi henüz ölçülmedi.

Her değişiklik için önce eski davranışta başarısız regresyon, sonra küçük düzeltme ve ilgili testler; sonunda tam Node/Python regresyonu. Mevcut Dur/F8, asıl kullanıcı yetkisi, gerçek PID/pencere/profil doğrulaması, hesap nesli, checkout ve OTP korunur. Yeni sohbet isteği önceki görevi körlemesine tekrar başlatamaz. Kimlik bilgisi/cookie çıkarımı veya Chrome profil kopyalama yok.

## Sıra ve dosya sınırları

1. [x] **Hangi ekranda:** `workspace-context.cjs`, `device-services.cjs`, `computer-session.cjs`: taze mevcut pencere ve içerik referansı, Umay öndeyken doğrulanmış önceki pencere; eksik/eski hedefi açık etiketle. Testler `workspace-context.test.cjs`, `device-services.test.cjs`.
2. [x] **Yanlış anlama:** selamlaşmada ilgisiz eski görev/hafıza yükünü kaldır; asıl yeni istek ile geçmişi ayrı tut. Kaynak `device-services.cjs`, mevcut server desktop sözleşmesi ve ilgili testler. Belirsiz profil adını site talimatına çevirmeme kuralı; isimleri sabit site listesine dönüştürme yok.
3. [x] **Kişisel Chrome:** `browser-sessions.cjs`, `browser-mcp.cjs`, `chrome-identity.cjs`: açıkça seçilmiş modu koru; seçim yoksa mevcut Chrome bağlantısı, sessiz managed fallback yok. Gerçek Chrome uzaktan hata ayıklama izni gerekiyorsa anlaşılır bağlantı durumu. Cookie kopyalama veya Chrome güvenliğini kapatma yok.
4. [x] **Devamlılık:** mevcut uygulama/sekme ve aynı sohbetin önceki görev sonuçlarını kaynaklı bağlamda tut; geçmişteki işi yeni görev sayma. Başarısız/kapalı/hesabı değişmiş hedef yeniden kullanılmaz. Tam son kullanıcı isteği takip görevine taşınır.
5. [x] **Yanıt gecikmesi:** küçük sosyal mesajın gereksiz masaüstü/Chrome ve eski görev bağlamı turlarını kaldır; model kapasite/sağlayıcı hatasını gecikmeden ayır. Kabul edilmiş koşuların kullanım muhasebesi ve istek sürümü korunur.
6. [x] **Browser/Chrome gecikmesi:** native PID+benzersiz güncel başlıkla eşle; her sekmeye seri evaluate çağrısını kaldır. Aynı başlık/yanlış PID/odak emülasyonuna dayalı sahte görünürlük testleri. Hız doğru hedefle birlikte ölçülür.
7. [x] **Robotik konuşma ve sesli istek:** `speech/worker.py`, `live_stt.py`, Türkçe konuşma ve `renderer.js` konuşma sınırları; doğal kısa duraklamada parçalanmayı ve ayrı ses isteklerinde kaybolan noktalama ritmini düzelt. İlk sese ek bekleme yok; klon seçimi/okuma kuralları ve yerel dur korunur. Python ve gerçek renderer fonksiyonu testleri; algısal kalite açık raporlanır.

## Teslim ve açık sınırlar

- [x] İlgili RED/GREEN ve tam otomatik regresyon.
- [x] Sahip olunan yerel fixture'larda entegrasyon; başarısız denemeler de rapora dahil.
- [x] Son paket kaynak/hash doğrulaması, yeni test installer; kurulu kullanıcı uygulaması otomatik kapatılmaz.
- [x] Docs/plan/walkthrought,41 Obsidian kopyası ve GitHub kaynağı aynı sonuçla güncellendi; son belge revizyonu bu kabul kaydıyla birlikte gönderilir.

Son bağımsız Chrome ekran gözlemi önceki turda URL güvenlik denetimi tarafından durdurulmuştur; bu kısıt farklı araçla aşılmaz. Sentetik testler gerçek kişisel profil izni, tüm uygulamalar, fiziksel mikrofon ve insan benzeri ses için genel başarı kanıtı sayılmaz. Model rolleri sessizce değiştirilmez; sunucuya dağıtım gerekirse önce aday kaynak bağımsız HTTP testinden geçer.

## 0.8.6 sonuç ve teslim kaydı

Uygulama kaynağı **d7f614b**. Ekran sorusunda ilk kontrol görevi öncesinde de PID bağlı salt okunur içerik alınır; düzenlenebilir alan/parola değerleri özetlenmez. Umay’dan başka pencereye geçişte yalnız foreground metadata kaydı yapılır, ekran/MCP/model çağrısı eklenmez. Aynı sohbetteki görev sonuçları kalır; başka sohbetin görev bağlamı taşınmaz. Sayısal “3. sonucu aç” takibi ayrıca RED/GREEN ile kapatıldı.

Varsayılan eski ayrı Chrome bağlantısı bir kez kendi Chrome bağlantısına geçirilir; isimli managed bağlantılar ve sonraki açık kullanıcı seçimi korunur. Her sekmeyi evaluate ile dolaşma kaldırıldı; doğrulanmış browser PID ve benzersiz başlık eşleşir. Aynı başlıklar belirsizse işlem durur. Başarısız eşleme eski UID/snapshot yetkisini kaldırır; geç hesap sonucu yeni gözlemi silemez. Mevcut kişisel Chrome bağlantısı izin gerektiriyorsa ayrı boş profile düşülmez. Chrome144+ ve chrome://inspect/#remote-debugging bağlantısı için resmi kaynak: https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect . Gerçek kişisel profil/isimli profil seçimi kabulü ayrıca kullanıcı kurulumundan sonra yapılmalıdır; bu tur cookie veya oturum dosyası alınmadı.

### Doğrulama

- Son **497/497 Node**; **69/69 Python**. İlk Python denemesi yanlış unittest/pytest ortamı ve eksik kütüphaneler yüzünden başarısızdı; runtime bağımlılıklarıyla izole pytest ortamında son69 geçti. Geliştirme sırasında eşzamanlı eski snapshot test hataları da son tam koşuyla kapandı.
- Gerçek Electron ayar/UI/IPC; mevcut/ayrı bağlantı tercihi, gerçek MCP bağlantısı, aynı sohbette yazılı/sesli görev devri ve soru/onay/yönetici izin düğmesi geçti. Test açılışındaki LOGIN_REQUIRED/soğuk dev runtime ve hesap kapanışındaki geç watcher uyarıları kabul loglarında korunur; gerçek hesap giriş başarısı olarak sunulmaz.
- Gerçek sahip olunan iki sekmeli Chrome’da eski MCP seçimi doğru başlığa taşındı; yalnız list_pages/select_page, evaluate yok. Gerçek tıklama etkisi snapshot ile doğrulandı. Bu denemede native başlık girdisi kontrollüdür. Soğuk6991ms/sıcak579ms/Chrome kapatıp toparlama3515ms, sıfır model turu ve tek gezinme. İlk MCP zaman aşımı tekrar üretilemedi; başarısız deneme saklandı. Bunlar tüm siteler için p50/p95 değildir.
- Gerçek capture dosyası → Seda → renderer sohbet → kontrollü API → Pocket TTS/WebAudio geçti; mikrofon açık kaldı. Yanıt hazır olduktan ilk WAV **295ms**, oynatma **516ms**; bulut model beklemesini içermez. İlk denemelerde eksik fixture ve zaman aşımı vardı; atıflı fixture checksum ile hazırlandı. Soğuk yükleme maliyeti ayrı ölçüldü; son aynı test geçti.
- Gerçek Seda Dur → yerel duraklama **163ms**, ardından fiziksel F8 geçti. W tuşu metin tanınmadan önce kendi sınırlı süresiyle bırakılmıştı; sahte key-up gecikmesi hesaplanmadı ve duraklamadan sonra yeni key-down yok. Eski test fixture’ı ilk adımda system→desktop geçişini atlıyordu; test gerçek sözleşmeye düzeltildikten sonra geçti. Önceki60s timeout’lar saklandı.
- Gerçek worker protokolünde hazır6.8s/STT17.11s/TTS28.8s (başlangıçtan kümülatif); ayrı sıcak TTS ilk parça274ms,35parça/2812ms toplam. Soğuk yükleme ile sıcak ses süresi ayrı tutulur. STT600ms eşiği, aynı doğru fixture finalini350ms eşiğinden260ms sonra verdi. Ek450ms ara gerçek fixture’da iki ayarda da bölünmedi; kullanıcının özel yanlış tanıması bu örnekte yeniden üretilmedi. Deterministik kısa ara testi eski kodda RED/yeni kodda GREEN.
- Ayrı speak istekleri arasında180–320ms noktalama ritmi korunur; ilk istek0ms ve sonda fazladan sessizlik yok. Klon profili, playbackId ve iptal nesli korunur. Bu, insan sesine algısal eşitlik kanıtı değildir; Seda/Pocket model ve klon koşullandırması değiştirilmedi.
- Son ASAR **81 uygulama dosyası**, native yardımcı/dört konuşma modülü kaynakla aynı; **361 MCP** dosyası sabit1.12.0 paketle aynı. Gerçek paket Umay.exe MCP host/yeniden bağlanma/tıklama/readback/yardımcı kapanışı ve izole ASAR hafıza/kasa/Obsidian/SSH2/izleyici/kalıcı sipariş testleri geçti.

### Sunucu

Yeni sosyal mesaj katmanı eski12mesajı ve ilgisiz görev geri çağrısını çıkarır; Umay adıyla selamı tanır, araç isteği teklif etmez. Normal takip isteklerinin yakın geçmişi korunur. Açık Chrome profil talebi isimden site uydurulmadan asıl metnin tamamıyla genel yürütücüye devredilir. Eski worker’da “desktop wake greeting must exclude obsolete task history” RED, adayda gerçek HTTP/geçici PostgreSQL GREEN. Yalnız iki sohbet worker’ı **e8d228478e1e** imajına geçirildi; sağlıklı ve helper SHA256 kaynakla aynı. Yedek/geri dönüş: `/root/umay-conversation-1794252137`. Ortam, mount, port10203, frontend, kimlik ve üretim verileri değişmedi. Sağlayıcı rate-limitinin ortadan kalktığı veya eski bilinmeyen kullanımın sıfırlandığı iddia edilmez.

### Kurulum

- `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/reliability-0.8.6/Umay Setup 0.8.6.exe`
- **350516245 bayt**, blockmap365861bayt.
- SHA256: `2e8fdbb16078e65567a67f7192ec06af6a59c631bbdaac78133ed7d9cb2202b6`.
- SHA512: `ELC6NXyl+zuoSNoUgMhgGxaH+bT6LpyBGLioBIpDNQIW90vuj8ALcqINyEe9txuaMWYeXzdXnCgc0ovMOAuNiA==`.
- NSIS build exit0; latest.yml boyut/SHA512 eşleşti. Kullanıcının önceki kararıyla imzasız test sürümü. Exe/blockmap/latest.yml/verification.json ana checkout’a kopyalandı ve hashleri eşleşti;0.8.5 hash662db4ec…b4be6 aynı kaldı. Genel updater yayını/otomatik kurulum yapılmadı.

- [ ] Yeni kurulu0.8.6’da gerçek kişinin mikrofonu, kendi Chrome izni/oturumları, atanmış gerçek bulut modelleriyle yedi bildirimin kabulü ve karşılaştırmalı algısal ses kontrolü. Bunlar bu sentetik/yerel testlerden çıkarılamaz.

Ham yerel kanıt `.superpowers/reliability` içinde ve Git dışında tutulur. Model rolleri/klon seçimi sessizce değiştirilmedi. Önceki URL denetimi engeli aşılmadı; Chrome testleri yalnız ayrı sahip olunan yerel profillerde yapıldı.
