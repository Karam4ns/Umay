# Chrome MCP — 0.6.0

## Karar ve kapsam

Kullanıcının 6 Kasım 2026 talebi: Chrome ve web işlemleri uygulamaya kurulan Chrome MCP ile yürütülsün. Ayrı bilgisayar kontrol sayfası yoktur. Yazılı veya sesli normal sohbet, gerektiğinde aynı görev devri üzerinden tarayıcı yürütücüsünü başlatır. Site açma, arama, güncel web bilgisi alma, sekmeler, sayfa okuma, form ve sayfa içi etkileşimler bu yola yönlendirilir. Gerçek ve görünür Chrome kullanılır; sayfa üzerinde Windows klavye/fare otomasyonu kullanılmaz. Masaüstü uygulamaları için mevcut Windows yürütücüsü korunur; birleşik görev iki yürütücü arasında geçebilir.

Veriüssü kimlik doğrulaması/model API'si, RSS ve hava durumu kontrolleri, model indirme ve güncelleme altyapısı kendi HTTP bağlantılarını kullanmaya devam eder. Bunlar kullanıcının tarayıcıda yaptırdığı işlemler değildir. Hesap bağlama önceki karara uygun biçimde sistemin varsayılan tarayıcısında kalır.

## Paket ve bağlantı

- Resmî `chrome-devtools-mcp` **1.12.0**, MCP SDK **1.32.2** sürümlerine sabitlenir; kilit dosyasına alınır.
- MCP sunucusunun derlenmiş çalışma ortamı ve lisansları Windows kurulumuna eklenir. SDK ve bağımlılıkları `app.asar` içinde bulunur. Kullanıcıdan Node.js, npm veya elle MCP kurulumu istenmez; alt süreç Umay'ın kendi Electron çalıştırıcısını `ELECTRON_RUN_AS_NODE=1` ile kullanır.
- Chrome'un cihazda kurulu olması gerekir. Bulunamazsa anlaşılır hata gösterilir. Umay, Chrome kurulumunu sessizce değiştirmez.
- Varsayılan: hesaba özel, görünür, kalıcı **Umay Chrome profili**. Profil yolu kullanıcı verisinde `browser/profiles/<hesap özeti>` altındadır. Site girişleri burada kalır; başka Umay hesabıyla aynı profil paylaşılmaz. Hata ayıklama yalnız `127.0.0.1` üzerinde rastgele portla açılır ve gerçek Chrome uç noktası doğrulanır.
- İsteğe bağlı mevcut Chrome bağlantısı: **Ayarlar → Modeller → Chrome MCP**. Chrome 144+ sürümünde `chrome://inspect/#remote-debugging` üzerinden bağlantı açılır; Chrome'un kullanıcıya gösterdiği bağlantı onayı gerekir. Varsayılan Umay profili bu elle kurulum adımını gerektirmez.
- MCP kullanım istatistikleri, CrUX sorguları ve güncelleme kontrolleri kapatılır. Sürüm yükseltmeleri uygulama paketiyle yapılır.

## Görev akışı

1. Sohbet modeli kısa plan ve isteğe bağlı `browser`, `desktop` veya `mixed` yürütücü bilgisini devreder. Eski istemcinin protokolü geçerli kalır.
2. Tarayıcı görevinde gerçek `list_pages` ve `take_snapshot` sonucu alınır. İlk görüntü zaten günceldir; planlayıcıya gereksiz tekrar gözlem döngüsü verilmez.
3. Planlayıcıya yalnız o anda kullanılabilen eylemleri içeren JSON şeması ve tarayıcıya özel yönerge gönderilir. Windows'a ait klavye talimatları tarayıcı planlayıcısına karıştırılmaz.
4. Araç adı ve JSON argümanları resmî MCP istemcisiyle gerçek sunucuya gönderilir. Sayfa kimliği ve öğe UID'si güncel gözlemle doğrulanır. Sekme/odak değişiminde eski öğeler kullanılamaz. Metin eklemenin yanlışlıkla yinelenmesine karşı görev bazlı koruma vardır.
5. Yeni sayfa durumu incelenir; tamamlanma, soru veya kullanıcı izni normal sohbet akışına döner. Uzun sayfa ve araç sonuçları sınırlandırılmış parçalarla okunabilir. Sunucunun keşfedilen 32 aracı gerektiğinde şeması istenerek kullanılabilir; tüm şemalar her model çağrısına yığılmaz.
6. Duraklatma/durdurma yeni eylemleri keser ve MCP sürecini kapatır. Normal durdurmada açık Chrome sekmeleri ve kullanıcı oturumu korunur. Uygulama kapanışı, MCP yardımcısının çıkışını bekler; güncelleyicinin çalıştırılabilir dosyası açık tutulmaz. Başlatılmakta olan yalnız Umay'a ait Chrome iptal edilebilir; kullanıcının diğer Chrome süreçleri kapatılmaz.

Sayfa içeriği ve araç sonuçları güvenilmeyen veri kabul edilir; kullanıcı talimatı veya izin yerine geçmez. Kullanıcının talebi dışında hassas işlemler için mevcut izin/soru akışı korunur. Yönetici/UAC mekanizması tarayıcı bağlantısına taşınmaz. Geçerli UID, zaman aşımı ve sonuç doğrulaması; sitelerin, sağlayıcıların veya modelin her koşulda doğru çalışacağı garantisi değildir.

## Bellek ve kayıtlar

Mevcut işlem deneyimine MCP araç adı, süre, sonuç düzeyi ve kontrol noktaları eklenir. Deneyimler hesaba aittir; kişisel profil olgularına karıştırılmaz. Ham araç argümanları/sonuçları ve önceki kullanıcı izinleri bu deneyim kaydına kopyalanmaz. Görev özeti kullanıcının isteğinden değer içerebilir. Canlı planlama bağlamı, mevcut Veriüssü model API'sinden geçer; burada tüm sayfa verisinin hiçbir yerde saklanmadığı iddia edilmez. Bağlamdaki URL kimlik bilgileri ve belirli gizli sorgu alanları maskelenir. Geçmiş kayıtlar güncel sayfa ve kullanıcı izninin yerine oynatılmaz.

## Testler ve ölçülen sonuçlar

- **211 Node testi**, **60 Python testi** geçti. Tarayıcı kimlikleri, eski gözlem, hesap geçişi, iptal, geç gelen başlangıç, tekrar yazma, uzun bekleme ve sonuç parçalama testleri dahil.
- Gerçek sabitlenmiş MCP ve ayrı Chrome profilinde gezinme, güncel öğeyle form doldurma, tıklama ve DOM'dan geri okuma geçti.
- Gerçek ajan + gerçek MCP, kontrollü planlayıcı: üç işlem yaklaşık **3,0 saniye**. Uzun MCP beklemesini durdurma **49 ms**; tekrar bağlantıda sayfa korundu. Bunlar bu cihazdaki tekil ölçümlerdir.
- Gerçek Electron Ayarlar/Modeller sayfasında tercih saklama, bağlantı ve durum testi geçti; sayfa görsel olarak incelendi.
- Gerçek Veriüssü sohbet modeli **Alfa1.2** ve seçili bilgisayar modeli **Qwen3-VL** ile Netflix açıldı; gerçek başlık/adres doğrulandı. Tek `navigate_page`, tekrar eden alan adı yok, Windows giriş erişimi sıfır. Görev devri **9,5 saniye**, toplam **25,0 saniye**.
- Aynı gerçek modellerle bağımsız yerel test sayfasında alan doldurma ve Kaydet düğmesine basma geçti; alan ve sonuç DOM'dan doğrulandı. Görev devri **13,9 saniye**, toplam **34,7 saniye**. Araç çağrıları ve işlem deneyimi kaydı doğrulandı. Model/sağlayıcı beklemesi hâlâ belirgindir; bu sürüm anlık yanıt garantisi vermez.
- Son paket: **47 uygulama dosyası**, açılmış Windows yardımcısı ve **4 konuşma modülü** kaynakla eşleşir. MCP'nin **361 çalışma dosyası** sabitlenmiş npm paketiyle byte düzeyinde aynıdır.
- Son `app.asar` ve MCP kaynakları çalışma klasörünün dışında geçici konuma kopyalandı. Gerçek paketlenmiş `Umay.exe`, harici Node/npm ve çalışma klasörünün bağımlılıklarına erişmeden MCP'yi başlattı; gerçek Chrome gezinme/tıklama/geri okuma ve yardımcının kapanışı geçti.

## Sunucu uyumluluğu

İki worker tarayıcıya özel planlayıcı ve yetenek bazlı eylem şemasıyla güncellendi. Son geçiş yedeği `/root/umay-reply-1793972573`. Ayrı HTTP/PostgreSQL kabul testi hem yeni MCP akışını hem eski istemci/JSON şeması geri dönüşünü kapsar. 10203 geçidi, frontend 10202 ve worker 10214 düzeni korunur. Frontend yürütücüsü kapalı, iki worker etkin kalır. Kullanıcı model rolleri ve mali kayıtları elle değiştirilmez. Gerçek model denemeleri normal API kullanımına tabidir; geçici doğrulama oturumu testten sonra iptal edilir.

Bu sürüm STT/TTS modellerini, klonlama ayarlarını, Türkçe okuma kurallarını veya seslendirme hızını değiştirmez. Mevcut konuşma zinciri ayrıca regresyon testinden geçirilir. Kurulum ve son denetim sonuçları aşağıdaki teslim kaydına eklenir.

## Son denetim

Gerçek mikrofon yakalama yolu, Seda, normal sohbet, otomatik görev devri ve Pocket TTS regresyonu geçti; mikrofon açık kaldı. Kontrollü API yanıtının görünmesinden ilk ses verisi **128 ms**, ilk çalma **205 ms** ölçüldü. Bu ses ölçümü bulut modelinin üretim beklemesini içermez; gerçek model hız iddiası olarak kullanılamaz.

Canlı iki worker'ın planlayıcı yardımcıları kaynak SHA256 özetiyle eşleşti. Aynı üretim imajı ayrı HTTP/PostgreSQL ortamında yeniden doğrulandı. İki worker ve frontend sağlıklı; planlayıcı dışındaki API/public dosyaları önceki imajlarla aynı, 10203 geçidi sağlıklı. Test için oluşturulan geçici web oturumu iptal edildi. İmzalama, kullanıcının önceki kararıyla sonraya bırakıldığından bu bir imzasız test kurulumudur.

## Kurulum teslimi

`dist/Umay Setup 0.6.0.exe`: **351.717.420 bayt**, SHA256 `0ea7f5b5fee0e0fb40051f17e96d5eb08bf31dbb3baeabcc1873a37e318811c2`. Installer SHA512 ve uzunluğu `latest.yml` ile eşleşir; blockmap da üretildi. Doğrulanmış uygulama dizini `dist/chrome-mcp-0.6.0/win-unpacked`; installer bu dizinden `--prepackaged` ile üretildi. Kaynak, native ve konuşma dosyaları paketleme sonrasında tekrar karşılaştırıldı.

Çalışan kullanıcı uygulaması kapatılıp kurulum kendiliğinden yapılmadı. Yeni istemci davranışı için 0.6.0 kurulmalıdır. Kaynak değişiklikleri `codex/computer-model-roles` dalına teslim edilir. Yerel installer üretimi, genel güncelleme sunucusuna yayımlandığı anlamına gelmez; bu çalışmada kurulum dosyası yerel teslim edilir.
