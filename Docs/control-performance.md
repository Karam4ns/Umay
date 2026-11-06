# Chrome ve bilgisayar kontrol hızı — 0.6.2

## Amaç ve ölçütler

Mevcut sohbet/ses, model rolleri, Chrome MCP, kullanıcı izinleri ve yerel durdurma korunarak bekleme azaltılır. Model/sağlayıcı üretimiyle yerel gözlem ve giriş süresi ayrı ölçülür; tekil ölçüm tüm görevlere genellenmez.

Başlangıç kanıtı: önceki gerçek Netflix testi toplam 26,7 saniye, görev devri 13,2 saniye. Son beş bilgisayar model çağrısı yaklaşık 2,6–5,6 saniye; sağlayıcı üretimi 1,2–4,0 saniye, kuyruk 15–37 ms. Son üç sohbet devri 12,4/12,6/24,5 saniye; 8.620–11.965 giriş token'ı. Bu veriler, salt fare hızından önce gereksiz model turları ve bağlam yükünün ele alınmasını gerektirir.

## Sıralı plan

1. [x] Kayıt ve çalışan sunucu yolunu incele; model, gözlem, giriş sürelerini ayıran yerel ölçümler ekle.
2. [x] Kullanıcının bağımsız ana sayfa açma isteğinde görev devrinden sonra doğrudan MCP gezinmesi ve gerçek başlık/adres doğrulaması; karmaşık veya belirsiz istekler genel planlayıcıda kalır.
3. [x] Yeterli erişilebilir denetim bulunan masaüstü görevlerinde önce metin; görsel görevlerde ve koordinat gereken toparlanmada görüntü. MCP fill_form keşfi mevcut araç listesine eklenir.
4. [x] Bilgisayar planlayıcısında atılan tam hafıza aramasını yalnız gizlilik sürümü okumasıyla değiştir; kısa yönlendirmeyi yeni istemci yeteneğiyle sınırla; ayrı HTTP/DB kabulünden geçir.
5. [x] Gerçek Chrome/form/masaüstü testleri, seçili modellerle canlı süre ölçümü, ses/durdurma regresyonları ve kod incelemesi; masaüstü bulut testi sınırı aşağıda.
6. [x] Doğrulanmış 0.6.2 paketi, installer, kaynak ve doğrulama belgelerinin GitHub teslimi.

## Yürütme notları

Devam kararı: kullanıcı mevcut çalışmanın atlanmadan sürdürülmesini istedi; mevcut `codex/computer-model-roles` dalındaki yarım değişiklikler korunarak aynı çalışma klasöründe ilerlenir. Yeni worktree/yeniden uygulama yapılmaz. Push ve ilgili sunucu entegrasyonu önceki oturumlarda açıkça yetkilidir.

Doğrudan gezinme kapsamı yalnız gerçek kullanıcı isteğinden çıkarılır. Sorgusuz, fragmentsiz ana sayfa adresi ve tek açık aç/git komutu gerekir. Birleşik, olumsuz, alıntı, açıklama, giriş/silme/gönderme gibi işlemler bu kısa yola alınmaz. Ortak `standalone-navigation.cjs` hem istemci hem sunucuda aynı doğrulamayı yapar. Sunucu, yalnız `controlPerformance:v1` ve Chrome MCP yeteneğini bildiren istemcinin bu kesin isteğini mevcut görev devri protokolüne dönüştürür; model çağırmaz, işi yapılmış saymaz. Merkezi sohbet/run/hafıza kaydı ve oturum/model yetki kontrolleri sürer. Diğer işler genel model yolunda yürür; bu bir genel komut listesiyle bilgisayar kontrolünü sınırlama değildir.

Masaüstü önce metin yaklaşımı görsel yetenekli modelde koordinat istendiğinde güncel ekran görüntüsüyle toparlanmalıdır. Eski gözlem veya model önerisi kullanıcı yetkisini genişletemez. Kapalı Chrome'u yeniden bağlama düzeltmesi ve MCP işlem tekrar etmeme kuralı korunur.

İlk test koşusu 219/220: sentetik devam testinde eski görev nesnesinin süre alanı yoktu. Gerçek eski/devam görevine uyum için sayaçlar döngü girişinde varsayılan değerle kuruldu. Sonraki koşu 221/221. Son hafıza sürümü değişikliği ayrıca doğrulanacak; bu sayı final kabul sayısı değildir.

Son bağımsız inceleme: hızlı gezinmede MCP araç hatası normal toparlanmayı atlıyordu. Önce bunu üreten test başarısız oldu; sonra genel planlayıcıya güncel gözlem ve kısmi uygulama uyarısıyla dönüldü. Hızlı gezinme denendi işareti korunur, işlem kendiliğinden tekrar uygulanmaz. İnceleme dışındaki küçük iyileştirmeler kapsamı genişletmek için eklenmedi.

## Sonuçlar ve sınırlar

- **227 Node testi** geçti. Kesin isteğin ayrıştırılması, uygunsuz isteği modele bırakma, gerçek sayfa kanıtı, kısmi gezinmede toparlanma/tekrarlamama, yerel durdurma, görüntüye dönüş ve gizlilik sürümü korunması kapsandı.
- Gerçek Chrome/MCP + kontrollü planlayıcı form testi: **2.625 ms**, üç uygulanan işlem. Uzun beklemeyi durdurma **65 ms**; sayfa korunarak yeniden bağlantı geçti.
- Gerçek yerel test sayfasında doğrudan gezinme: soğuk **2.698 ms**, açık Chrome **285 ms**, Chrome kapatılıp yeniden açıldığında **3.226 ms**. Her durumda bilgisayar modeli turu sıfır, gerçek sayfa gözlemiyle sonuç doğrulandı. Bunlar yerel sayfa ölçümleridir.
- İlk canlı denemede yalnız bilgisayar modeli turları kaldırılmıştı: sohbet devri **59,4 saniye**, toplam **86,8 saniye**. Bu başarısız performans sonucu, ilk sohbet modeli beklemesinin de kaldırılmasını gerektirdi; hızlı sonuç olarak sunulmaz.
- Son gerçek Veriüssü/Chrome Netflix testi, aynı seçili Alfa1.2/Qwen3-VL rolleriyle: görev devri **614 ms**, toplam **9.283 ms**. Bilgisayar modeli turu sıfır; gözlem **2.048 ms**, MCP girdileri **6.057 ms**. Kalan toplam API/kurulum/son DOM doğrulamasını da içerir. Chrome önce kapatılıp eski istemci özellikle korundu; tekrar bağlantı, tek gezinme ve gerçek Netflix başlığı/adresi doğrulandı. Native Windows erişimi sıfır. Önceki 0.6.1 testi 26,7 saniyeydi; bunlar kontrollü ağ/sağlayıcı karşılaştırması veya her siteye hız garantisi değildir.
- Genel form isteği model yolunda kaldı. Gerçek modellerle doldur/tıkla/geri oku geçti: görev devri **9.467 ms**, toplam **28.741 ms**, bilgisayar modeli beklemesi **12.645 ms**, beş model turu, görüntü sıfır. Önceki form denemesi 34,7 saniyeydi; model ve ağ yükü değişebildiğinden sabit hızlanma oranı iddia edilmez.
- Gerçek Windows test pencerelerinde hover, sağ/orta/çift tık, kaydırma, sürükleme, pencere odağı ve fiziksel F8 durdurma geçti. Bulut masaüstü denemesi önce tekrar odaklama/iç içe `nextAction` sorununu gösterdi. Geçerli tek eylem dışındaki iç içe işlemler reddedilir; planlayıcıya gerçek ön plan pencere kimliği ve tek eylem kuralı verilir. İki düzeltmenin de önce başarısız olan regresyon testi var. Son bulut masaüstü denemesinde test penceresi odaktan çıktı ve yalnız test penceresine giriş koruması farklı hedefi reddetti. Bu deneme başarılı masaüstü hız ölçümü veya tüm uygulamalar kabulü sayılmaz; kullanıcının diğer penceresine giriş yapılmadı.
- Gerçek capture→Seda→sohbet→görev devri→Pocket TTS testi geçti; mikrofon açık kaldı. Kontrollü yanıttan ilk ses **197 ms**, ilk çalma **281 ms**. Bu değer bulut modelini bekleme süresini içermez. STT/TTS modelleri, klonlama ve Türkçe okuma ayarları değiştirilmedi.

## Sunucu ve paket

İlk işçi geçişi `/root/umay-reply-1793976862`, kesin istek görev devrini içeren son geçiş `/root/umay-reply-1793977316` yedeğine dayanır. Ayrı HTTP/PostgreSQL testinde eski istemci, şema geri dönüşü, merkezi sohbet arşivi, gizli run alanları, normal sohbette hafıza ve kesin site isteğinde **sıfır sağlayıcı çağrısı / sıfır giriş-çıkış token'ı** doğrulandı. Gerçek Netflix devri üretim kaydında da giriş/çıkış/ücretlendirilen token **0**, sunucu çalışma süresi **36 ms** idi; bu değer ağ ve yerel yürütme süresi değildir. Planlayıcıda arşiv araması yerine epoch/revision okuması kalır; yetki ve token muhasebesi kodu değiştirilmez. İki işçi aynı imajda sağlıklı; 10203 ve diğer portlar/ortam/mount'lar korunur. Planlayıcı ve ek ortak ayrıştırıcı dışındaki API/public dosyaları aynı. Doğrulama oturumu iptal edildi.

Son uygulama dizini `dist/control-speed-0.6.2-release/win-unpacked`. **49 uygulama dosyası**, açılmış native yardımcı ve dört konuşma modülü kaynakla eşleşir. **361 MCP çalışma dosyası** sabitlenmiş 1.12.0 sürümüyle aynıdır. Proje dışında yalıtılmış `app.asar` ve gerçek paketlenmiş Umay.exe ile Chrome kapat/yeniden bağlan, gezinme/tıkla/geri okuma, sıfır planlayıcı turlu kesin gezinme ve MCP yardımcısının çıkışı geçti. Son installer ve GitHub teslimi aşağıya eklenecek.

## Teslim

`dist/Umay Setup 0.6.2.exe`: **351.718.696 bayt**, SHA256 `60927a57f1fa6fcecd2500dfba550dfb3f854ac982950360302314d724cf2ebf`. SHA512 ve dosya uzunluğu `latest.yml` ile eşleşir; blockmap üretildi. Son kaynak değişikliklerinden önce üretilen ara paket teslim edilmez; doğru paket dizini **`dist/control-speed-0.6.2-release`**. Installer bu doğrulanmış dizinden üretildi ve kaynak/native/konuşma eşleşmesi tekrar kontrol edildi.

Dağıtımda `src/standalone-navigation.cjs`, `desktop-reply.cjs` ile aynı API dist dizinine kopyalanır; iki canlı worker'da ortak ayrıştırıcı ve planlayıcı yardımcı dosyasının kaynakla SHA256 eşleşmesi doğrulandı. Son inceleme ölçümü ve kararlar bu belgede kayıtlıdır. Mevcut kullanıcı talimatı doğrultusunda aynı çalışma dalı korunur; kaynak/belgeler `codex/computer-model-roles` dalına gönderilir. Genel güncelleme sunucusuna installer yayımlanmadı; önceki karara uygun imzasız test installer'ıdır. Çalışan kullanıcı uygulaması kendiliğinden kapatılıp kurulmadı. Yeni istemci davranışı için **0.6.2 kurulmalıdır**.
