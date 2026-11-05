# Model rolleri ve Windows kontrolü doğrulaması — 0.4.1

5 Kasım 2026. Uygulama ve testler mevcut proje üzerinde, `codex/computer-model-roles` dalında tamamlandı. Tasarım/plan: [computer-model-roles.md](computer-model-roles.md).

## Uygulanan davranış

- Ayarlar / Modeller: sohbet ve bilgisayar kontrolüne bağımsız model atama. PERSONAL/SUBSCRIPTION kaynakları, aynı model kimliği olsa da ayrılır. Ayarlar hesaba özel SQLite kaydında kalır.
- Sohbetten veya Bilgisayar sayfasından başlatılan görev atanan computer modelini kullanır. Sohbet seçicisinde yapılan değişiklik sohbet rolünü günceller. Erişimi kaldırılan atama yerine başka modele sessiz geçiş yapılmaz.
- Açık pencereleri listeleme, küçültülmüş pencereyi geri getirip öne alma; sol/sağ/orta/çift tıklama, fare hareketi, sürükleme, hedeflenen panelde dikey/yatay kaydırma, Türkçe Unicode metin ve kısayollar.
- Ekran koordinatları monitör sınırları ve DPI üzerinden fiziksel koordinatlara çevrilir. Monitörler arası sürüklemede kaynak ve hedef ayrı eşlenir. Görsel model hedef monitörü önceden görmelidir.
- Tek eylemden sonra yeniden gözlem. Geçersiz JSON/alanlar veya odak değişiminde en fazla iki toparlanma. Kısmen yazılmış metin ve sonucu belirsiz native hata otomatik tekrar edilmez. Ekranda ilerleme olmadan aynı işlem üç kez uygulanırsa kullanıcıdan yön istenir.
- Native giriş kuyruğu tek komut işler. F8 bekleyen komutları iptal eder; başlamış kısa tuş/sürükleme işlemi tuşları bırakarak tamamlanır, sonra uygulama geri açılır. Hesap değişimi ve tekrar çıkışta da kontrol çubuğu/F8 temizlenir. F8 kaydedilemiyorsa görev başlamaz.
- Umay kontrol çubuğu başlığına bakılarak değil, gerçek Windows pencere kimliğiyle modelin pencere hedeflerinden çıkarılır.

## Doğrulama

- Başlangıç: 103 uygulama testi geçti.
- Sonuç: `npm test` — 119 test geçti. Eklenen davranış ve hata testleri uygulama öncesi başarısız, düzeltmeler sonrası başarılı çalıştırıldı.
- Python: klonlama, Türkçe okuma, worker ve canlı STT — 60 test geçti. Ses modüllerinde değişiklik yok.
- Gerçek Electron: Modeller sayfası, rollerin kaydı/yenilenmesi, aynı kimlikli farklı kaynaklar, doğru computer rolü, mevcut hafıza/konum sayfaları, açık/koyu tema ve çıkış temizliği.
- Gerçek Windows: yalnızca uygulamanın oluşturduğu iki geçici test penceresinde hover, sağ/orta/çift tık, dikey/yatay kaydırma, sürükleme, pencere odağı, Türkçe metin/Ctrl+A ve işletim sistemi üzerinden F8.
- Kontrollü sağlayıcıyla gerçek ekran → planlayıcı protokolü → Windows girişi → sonraki gözlemde yazının doğrulanması. Sağlayıcı kontrollü olduğundan bu test herhangi bir dış modelin muhakeme başarısını kanıtlamaz.
- Gerçek mikrofon yakalama → Seda STT → mesaj → kontrollü site API → Pocket TTS → WebAudio regresyonu başarılı; dinleme açık kaldı. Bu testte ilk ses 163 ms, oynatma 185 ms; gerçek dış model gecikmesi ölçümü değildir.
- Windows kurulum paketi ve paket içinden kontrol/arayüz ayrıca doğrulanır; paket doğrulama komutu: `node tests/verify-computer-package.cjs`.

## Sunucu

Yalnızca `desktop-context.js` planlayıcı modülü güncellendi. Canlı image üzerine dar kapsamlı overlay yapıldı; controller/execution modülleri canlı öncesiyle SHA256 olarak aynı. Normal web sohbeti, DB şeması, kullanıcı bakiyeleri, portlar ve ortam değerleri değiştirilmedi.

- Yeni planlayıcı şeması: focus_window, middle_click, yatay kaydırma ve hedef monitör alanları.
- İzole PostgreSQL/HTTP/sağlayıcı testleri: önce mevcut sürüm yeni pencere yeteneği eksikliğiyle başarısız, aday sürüm başarılı. Normal sohbet, ekran verisinin temizlenmesi, JSON yanıtı, run alan gizliliği ve geçmiş sayfalama doğrulandı. Geçici DB silindi.
- Docker Compose özel `$` karakterleri için gerçek, çalıştırılmayan geçici konteynerde ortam testi; konteyner/ağ temizlendi. Aday ve geri dönüş ortamları dağıtım öncesi render edilip canlıyla karşılaştırılır; dağıtım sonrası gerçek ortam ve portlar tekrar karşılaştırılır. [Docker belgesi](https://docs.docker.com/reference/compose-file/interpolation/).
- Yedek: `/root/umay-computer-1793855323`. Chat ve iki worker healthy; 10203 oturumsuz auth isteği beklenen 401 yanıtını verdi.

## Bağımsız inceleme ve kararlar

Üç önemli bulgu (hesap değişiminde kontrol temizliği, işlem alanlarının doğrulanmasında toparlanma, Compose ortamı) yeniden üretildi ve testleri başarısızdan başarılıya geçirildi. Kontrol çubuğunun hedef olarak listelenmesi de görev yanlış pencereye geçebileceği için giderildi; gerçek pencere kimliğiyle filtrelendi. Ertelenmiş inceleme bulgusu yok.

Kullanıcının doğrudan uygulama/test talimatı doğrultusunda mevcut Electron mimarisi sürdürüldü; yeni motor veya ses modeli eklenmedi. Eski Veriüssü istek sınırı korunur: uzun hızlı görevler sunucu kotasında bekleyebilir, F8 bu beklemede de çalışır. Görev limiti 120 adım/30 dakika; modelin yanlış yorumunu sınırsız sürdürmek yerine görünür durdurma/ek açıklama kullanılır.

Bu cihazda fiziksel ikinci monitör bulunmadığı için çoklu monitör koordinatları otomatik kontrollü testle doğrulandı; fiziksel çoklu ekran testi yapılmadı. Gerçek Windows giriş testi normal yetkili pencereleri kapsar. Kilit ekranı/UAC güvenli masaüstü veya yüksek yetkili uygulamalar atlatılmaz; [Windows SendInput kısıtları](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput). Her dış model ve her Windows uygulamasında hatasız çalışma garantisi verilmez.

## Kurulum çıktısı

`dist/Umay Setup 0.4.1.exe` — SHA256: `80e5fb4bd894a1fa069d4d8c8f797b2f792093a418a69d88f78e44c24906f62f`. İmzalama önceki kullanıcı kararıyla ertelenmiş test sürümüdür. Paket içindeki33 uygulama dosyası/native yardımcı/4 ses dosyası kaynaklarla aynı; paket modülleriyle gerçek Windows görev ve Electron Modeller sayfası testleri geçti.
