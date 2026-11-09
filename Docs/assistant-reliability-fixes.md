# Ekran, devamlılık, Chrome ve doğal konuşma düzeltmeleri

2026-11-09. Kullanıcının yedi hata bildirimi için mevcut mimaride düzeltme planı. Kullanıcı doğrudan düzeltme ve tek tek test istedi; kapsam yeni özellik tasarımı değildir. Taban c331097, kurulu sürüm0.8.5. Mevcut Windows/Electron, Chrome DevTools MCP, Seda STT ve Pocket TTS korunur.

## Kanıt ve yöntem

Son yerel görev/sohbet kayıtlarında Chrome profil seçme isteği web sayfasına gitme hedefine dönüşmüş; selamlaşmaya eski test görevleri ve yanlış asistan kimliği karışmış. CONTEXT_LIMIT ve PROVIDER_RATE_LIMIT hataları ayrı kayıtlarda var. Kişisel Chrome yerine managed profil varsayılanı ve native başlığa eşleme sırasında çok sayfalı seri sorgu kaynakta doğrulandı. STT600ms belgelenirken350ms sessizlikle cümle kapatıyor; ayrı polling parçalarında TTS son noktalama arası kayboluyor. Gerçek kişinin algısal ses kalitesi henüz ölçülmedi.

Her değişiklik için önce eski davranışta başarısız regresyon, sonra küçük düzeltme ve ilgili testler; sonunda tam Node/Python regresyonu. Mevcut Dur/F8, asıl kullanıcı yetkisi, gerçek PID/pencere/profil doğrulaması, hesap nesli, checkout ve OTP korunur. Yeni sohbet isteği önceki görevi körlemesine tekrar başlatamaz. Kimlik bilgisi/cookie çıkarımı veya Chrome profil kopyalama yok.

## Sıra ve dosya sınırları

1. [ ] **Hangi ekranda:** `workspace-context.cjs`, `device-services.cjs`, `computer-session.cjs`: taze mevcut pencere ve içerik referansı, Umay öndeyken doğrulanmış önceki pencere; eksik/eski hedefi açık etiketle. Testler `workspace-context.test.cjs`, `device-services.test.cjs`.
2. [ ] **Yanlış anlama:** selamlaşmada ilgisiz eski görev/hafıza yükünü kaldır; asıl yeni istek ile geçmişi ayrı tut. Kaynak `device-services.cjs`, mevcut server desktop sözleşmesi ve ilgili testler. Belirsiz profil adını site talimatına çevirmeme kuralı; isimleri sabit site listesine dönüştürme yok.
3. [ ] **Kişisel Chrome:** `browser-sessions.cjs`, `browser-mcp.cjs`, `chrome-identity.cjs`: açıkça seçilmiş modu koru; seçim yoksa mevcut Chrome bağlantısı, sessiz managed fallback yok. Gerçek Chrome uzaktan hata ayıklama izni gerekiyorsa anlaşılır bağlantı durumu. Cookie kopyalama veya Chrome güvenliğini kapatma yok.
4. [ ] **Devamlılık:** mevcut uygulama/sekme ve aynı sohbetin önceki görev sonuçlarını kaynaklı bağlamda tut; geçmişteki işi yeni görev sayma. Başarısız/kapalı/hesabı değişmiş hedef yeniden kullanılmaz. Tam son kullanıcı isteği takip görevine taşınır.
5. [ ] **Yanıt gecikmesi:** küçük sosyal mesajın gereksiz masaüstü/Chrome ve eski görev bağlamı turlarını kaldır; model kapasite/sağlayıcı hatasını gecikmeden ayır. Kabul edilmiş koşuların kullanım muhasebesi ve istek sürümü korunur.
6. [ ] **Browser/Chrome gecikmesi:** native PID+benzersiz güncel başlıkla eşle; her sekmeye seri evaluate çağrısını kaldır. Aynı başlık/yanlış PID/odak emülasyonuna dayalı sahte görünürlük testleri. Hız doğru hedefle birlikte ölçülür.
7. [ ] **Robotik konuşma ve sesli istek:** `speech/worker.py`, `live_stt.py`, Türkçe konuşma ve `renderer.js` konuşma sınırları; doğal kısa duraklamada parçalanmayı ve ayrı ses isteklerinde kaybolan noktalama ritmini düzelt. İlk sese ek bekleme yok; klon seçimi/okuma kuralları ve yerel dur korunur. Python ve gerçek renderer fonksiyonu testleri; algısal kalite açık raporlanır.

## Teslim ve açık sınırlar

- [ ] İlgili RED/GREEN ve tam otomatik regresyon.
- [ ] Sahip olunan yerel fixture'larda entegrasyon; başarısız denemeler de rapora dahil.
- [ ] Son paket kaynak/hash doğrulaması, yeni test installer; kurulu kullanıcı uygulaması otomatik kapatılmaz.
- [ ] Docs/plan/walkthrought, Obsidian kopyaları ve GitHub aynı sonuçla güncellenir.

Son bağımsız Chrome ekran gözlemi önceki turda URL güvenlik denetimi tarafından durdurulmuştur; bu kısıt farklı araçla aşılmaz. Sentetik testler gerçek kişisel profil izni, tüm uygulamalar, fiziksel mikrofon ve insan benzeri ses için genel başarı kanıtı sayılmaz. Model rolleri sessizce değiştirilmez; sunucuya dağıtım gerekirse önce aday kaynak bağımsız HTTP testinden geçer.
