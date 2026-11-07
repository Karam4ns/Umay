# Obsidian hafızası ve kesintisiz çalışma taslağı

7 Kasım 2026 — **uygulama kapsamı**. Kullanıcı hafıza/devamlılık değişikliklerini yapmayı istedi ve kurtarma anahtarıyla taşınabilir kasayı seçti. Bu belge yeni özelliklerin tamamlandığını söylemez. Dayanak: kullanıcının isteği/seçimi, `general-assistant-scope.md`, mevcut kaynak ve son gerçek kayıtlar. Yeni çalışma 0.7.0 temelli izole `codex/obsidian-continuity` dalındadır.

## Amaç

Umay kullanıcının yönlendirmesiyle aynı iş, uygulama, tarayıcı profili ve hedef üzerinde saatlerce çalışabilsin. Kullanıcı normal sohbetten yeni bir yönlendirme verdiğinde önceki açık işi ve güncel ekranı ilişkilendirsin. Öğrendiği kişisel bilgiler, Veriüssü ve mevcut yerel hafızaya ek olarak, kullanıcının seçtiği Obsidian vault'unda okunabilsin ve düzenlenebilsin. Örnek uygulama/site isimleri kapsam sınırı değildir.

## Bugünkü durum ve kanıt

- `LocalMemory` hesap bazlı SQLite; sohbet arşivi, kişisel notlar, dosya yolları, işlem deneyimleri ve Windows güvenli saklamayla şifrelenen özel hesaplar içeriyor. Kullanıcının istediği çok türde kayıt/ilişki ve Obsidian senkronizasyonu henüz yok.
- `ComputerSession` görev, önceki görev, native ön pencere ve tarayıcı sayfa kimliklerini tutuyor. Tarayıcıdaki görünür sonuç listesi/anlamı korunmuyor. `ComputerAgent.run` yeni yürütücüyü esas olarak yeni isteğin sözcüklerinden seçiyor; devam komutunun önceki hedefi devralması ayrı ve doğrulanmış bir işlem değil.
- Ön pencere özeti bugün sohbet bağlamı hazırlanırken ve bilgisayar kontrolü açıkken isteniyor. Beş dakikalık bağımsız gözlemci yok.
- 6 Kasım 19:20 kaydı: “Üçüncü sonucu aç” için yalnız başlangıç yanıtı görülüyor. 19:21–19:22 işlem deneyiminde arama görevi aynı `fill` aracını tekrar tekrar çağırmış, sonunda kullanıcı tarafından durdurulmuş. Birleşik arama/sonuç görevinde tekrarlı click/evaluate döngüsü ve durdurma var. Bunlar gerçek kayıtlar; başarı diye işaretlenmez.
- MCP tekrarlı yazma koruması bugün `type_text` için var; `fill` ve arama gönderiminin gerçek alan değerinden doğrulanması ayrıca ele alınmalı. Tekrarların tek nedeninin bu olduğu henüz kanıtlanmış değil.
- Son gerçek 0.7.0 kabulünde Alfa1.2-vision iki web/dosya zincirini ve bir native alan görevini tamamladı. Bu, yeni devamlılık/hesap/Obsidian işlerinin kabulü değildir.

## Yaklaşımlar ve öneri

1. **Yerel vault bağlantısı + şifreli özel kasa — önerilen.** Var olan Markdown dosyalarıyla çalışır; Obsidian açık olmasa da hafıza sürer. Obsidian URI ile doğru not/vault açılır; uygun ve etkin resmî CLI varsa uygulama işlemleri için kullanılabilir. Veri modeli ve uygulama yaşam döngüsü Umay'da kalır. Dosya eşzamanlılığı ve sır yönetimi açıkça uygulanmalıdır.
2. **Özel Obsidian eklentisi/yerel köprü.** Obsidian `Vault.process` üzerinden uygulama içi güncellemeyi atomik yapabilir. Her cihazda eklentinin kurulup etkinleştirilmesi gerekir; Obsidian kapalıyken ayrı yol gerekir. Sonradan eklenebilecek adaptör, ilk sürümün zorunlu bağımlılığı değil.
3. **Üçüncü taraf REST eklentisi veya yalnız ekran otomasyonu.** Ek API anahtarı/eklenti bağımlılığı ya da her not için pencere/girdi gecikmesi oluşturur. İlk uygulama yolu olarak önerilmez.

Yerel dosya adaptörü mevcut mimariye uygun mühendislik tercihidir; kullanıcı tarafından ayrıca belirlenmiş bir uygulama API tercihi diye sunulmaz. Obsidian notları düz metindir: [veri saklama](https://obsidian.md/help/data-storage). Notu doğru vault içinde açma: [resmî URI](https://obsidian.md/help/uri). CLI varlığı/etkinliği çalışma anında sınanır; her Obsidian kurulumunda hazır varsayılmaz: [resmî CLI](https://obsidian.md/help/cli). [Vault.process](https://docs.obsidian.md/Plugins/Vault) uygulama içi okuma/değiştirme garantisi sağlar; sıradan dosya sistemi yazısı bu garantiye sahipmiş gibi sunulmaz.

## 1. Ayarlar → Eklentiler → Obsidian

- Konuşma ve Modeller sayfaları korunur; Eklentiler ayrı ayar sekmesi olur. İlk bağlantı Obsidian, sonradan yeni adaptörler aynı kayıtçıya eklenebilir.
- Kurulu Obsidian/vault kayıtlarını keşfet, kullanıcıya vault seçtir; kayıt yoksa klasör seçtir. Bu cihazda `Karam4n` vault'u keşfedildi. Kullanıcı seçimi olmadan başka vault'u otomatik bağlama.
- Bağlantı, yazılabilirlik, son senkronizasyon, bekleyen kayıt/çatışma ve kasanın kilit durumu gösterilir. Bağlantıyı dene, Obsidian'da aç, eşitle ve bağlantıyı kes işlemleri bulunur.
- Yapılandırma Umay hesabına özeldir. Çıkış/hesap değişiminde dosya izleyicileri, bekleyen yazılar, ekran gözlemleri ve açık kasa erişimi durur. Yeni hesap önceki hesabın seçimini otomatik devralmaz.
- Sahiplik manifestinde kararlı hesap etiketi, cihaz kimliği ve kayıt/olay kimliği vardır. Aynı vault'taki farklı Umay hesapları ayrı yönetilen ad alanı kullanır; diğer hesabın kayıtları otomatik içe alınmaz, güncellenmez veya silinmez. Kullanıcı ortak okunabilir notları ayrıca seçebilir. Aynı hesabın iki cihazı aynı kayıt kimliğini paylaşabilir; eşzamanlı değişiklikler üst sürüm/olay kimliğiyle değerlendirilir, yalnız cihaz saatine göre son yazan kazanmaz. Sırların açılması ayrıca doğru kasa anahtarını gerektirir; manifest bir OS erişim kontrolü gibi sunulmaz.
- Mevcut vault kuralları okunur. Bu kullanıcının vault'unda `raw/` ve Obsidian/Git iç dizinleri yazma kapsamı dışındadır. Türkçe dosya adları, frontmatter, kaynak/karar bilgisi ve değişiklik kaydı korunur. Taslak varsayılanı mevcut şemaya uygun `entities/umay-hafızası/` ve `sources/umay/`; farklı vault'ta bağlantı ekranında ayrı yönetilen klasör seçilebilir.
- Umay'ın yönettiği alan manifest ile belirlenir. Kullanıcının başka notları varsayılan olarak yeniden yazılmaz; açıkça istenen mevcut not düzenlemesi ayrı hedef/sürüm işlemi olur. Genel index/log'a yalnız Umay'ın oluşturduğu girdiler, mevcut içeriği koruyarak eklenir.
- Klasör dışına taşma, junction/symlink, mutlak yol enjeksiyonu ve başka vault'a geçiş reddedilir. Bağlantıyı kesmek notları silmez.

## 2. Hafıza veri modeli

| Tür | Örnek içerik ve davranış |
| --- | --- |
| Profil | Kullanıcı hakkında açıkça verilmiş özellikler, iletişim tercihleri, çalışma bağlamı |
| Tercih/hobi | Zevkler, hobiler, sevilen/sevilmeyenler; güncelleme eski kararla ilişkilendirilir |
| Adres | Ev/iş/diğer; alıcı, ülke/şehir/ilçe/açık adres, telefon; doğrulanma tarihi |
| İletişim | Telefonlar, mail adresleri, ilgili hesap/kişi ve etiket |
| Hesap | Site/sosyal ağ/mail/oyun sağlayıcısı/alışveriş/banka/kripto hesabı; köken alan adı, profil/oturum, kullanıcı adı ve şifreli kayda referans |
| Ödeme | Kart/banka/cüzdan kaydı; notta ad/kurum/son dört hane, gizli alanlar şifreli kasada |
| Sunucu/aygıt | Cihaz, ağ adresi/IP, SSH host/port/kullanıcı, anahtar/parola referansı ve doğrulanmış host anahtarı |
| Dosya/klasör | Cihaz kimliği, gerçek yol, tür, son görülme ve varlık durumu; bağlı olmayan aygıt çevrimiçi gösterilmez |
| İşlem/iş akışı | Gerçek işlem makbuzları, bekleyen aşama, sonuç kanıtı ve kaynaklı yöntem; eski koordinat/izin tekrar oynatılmaz |
| Özel kayıt | Kullanıcının verdiği başlık, alanlar, tür/etiketler ve ilişkiler; kapalı kategori listesine mecbur değil |

Her kayıt sabit kimlik, kaynak, oluşma/güncellenme zamanı, sürüm, doğrulanma durumu ve gerektiğinde önceki kayda bağlantı taşır. Aynı kişinin çelişen tercihleri sessizce birlikte etkin bırakılmaz; açık yeni düzeltme öncekinin yerini alır ve geçmiş korunur. Başkasından alıntı, örnek metin, web sayfası veya model tahmini kullanıcı gerçeği sayılmaz.

“Kaydet”, “not al”, “bunu hatırla”, yeni tablo/kategori isteği sohbetten çalışır. Açık ve düşük riskli kişisel bilgiler konuşmalardan kaynak gösterilerek toplanabilir. Eksik/çelişen önemli bilgi gerektiğinde sorulur. Yerel ve Obsidian kaydı aynı kimliğe bağlanır; yeniden eşitlemede kopyalar üretilmez. Sohbet silinse de kullanıcının ayrıca sakladığı hafıza korunur. Unut/sil düzeltmesi yerel indeks ve Obsidian eşitlemesine işlenir; yeniden içe aktarmayla diriltilmez.

### Yazma ve eşitleme

- Kuyruk/outbox ve idempotent işlem kimliği; Obsidian kapalı, disk dolu, vault taşınmış veya işlem yarıda kalmışsa doğrulanmamış kayıt başarılı gösterilmez.
- Yeni dosyada exclusive create. Güncellemede son okunan içerik/sürüm, önceki sürüm yedeği ve çakışma kaydı; mevcut kullanıcı içeriğiyle aynı blok değiştiğinde iki sürüm korunarak çözüm istenir. Dosya sistemi yolu için uygulamalar arası atomik compare-and-swap garantisi verilmez.
- Obsidian'dan gelen kullanıcı düzeltmeleri indekslenir. Umay'ın kendi yazısı yeni kullanıcı bilgisi diye sonsuz döngüyle tekrar alınmaz. Dosya izleme/bildirim birleştirme, sınırlı tarama ve tekrar denemede geri çekilme vardır.
- Yönetilen kaydın elle silinmesi unutma işaretidir: eski outbox/diğer cihaz kaydı onu yeniden oluşturamaz. Kimliği korunarak yönetilen alanda taşınırsa yol güncellenir. `archive/` altına taşınırsa etkin hafızadan çıkarılır; yönetilen alan dışına taşınırsa bağlantıdan ayrılır ve eski yol yeniden yaratılmaz. Unutma işaretleri kayıt/sahip/sürüm kimliğiyle eşitlenir; aynı bilgiyi yeniden oluşturmak yeni açık kullanıcı isteği gerektirir.
- Ham sohbet/ekran yığını veya bütün disk içeriği otomatik olarak Markdown'a dökülmez; ilgili hafıza ve kaynaklı işlem özeti yazılır. Dosya listeleri sayfalıdır.

## 3. Sırlar ve yetkili kullanım

Parolalar, SSH özel anahtar içeriği, tam kart/banka/kripto sırları normal Markdown, arama indeksi, ekran geçmişi, işlem logu veya model istemine yazılmaz. Obsidian notu anlamlı hesap/kurum/host/son dört hane ve kasa kayıt kimliğini gösterir. Gizli kayıt tipleri genişletilebilir. OTP ve kart doğrulama kodu gibi işlem anına ait değerler kalıcı hafıza yapılmaz; tamamlanma/iptalde bırakılır. Kripto adresi ile cüzdan kurtarma/özel anahtarı birbirinden ayrılır.

**Kullanıcının seçimi:** kasa kurtarma anahtarıyla başka cihaza taşınabilir olacak. Taşınabilir tercih için rastgele veri anahtarıyla şifreli kayıtlar ve ayrı kurtarma yolu; Windows güvenli saklama yalnız bu cihazdaki kilit açma kolaylığı için kullanılır. Diğer tercih mevcut Windows güvenli saklamayı kullanabilir. Kurtarma sırrı sohbete veya Git'e konulmaz. Doğru kurtarma anahtarı olmadan taşınmış şifreli verinin açılmayacağı bağlantı ekranında açıklanır. Aktif model bu sırları hatırlamakla görevlendirilmez.

Gizli değer **yerel yürütmede** referanstan çözülür. Web doldurmada gerçek origin/profil ve güncel alan doğrulanır; model yalnız kayıt/alan referansını görür. Kimlik bilgisi başka domain'e sayfa talimatıyla taşınmaz. SSH bağlantısına sır doğrudan yerel adaptörden verilir; komut satırı argümanı veya stdout/log'a dökülmez. Kasa kilitliyse kullanıcıdan açması istenir; model anahtar tahmin etmez. Hesap değişimi/çıkış açık referansları ve oturumluk değerleri iptal eder.

Sır kullanımı yalnız kapsamlı, kısa ömürlü bir yerel izinle çalışır: görev + kayıt + doğrulanmış hedef/profile/origin + alanlar + bitiş/iptal. Bu sırada genel model aracı sır değerini isteyemez; script/istek-gövdesi/clipboard okuma ve keyfî süreç çalıştırma yolu gizli aşamayı atlatamaz. UIA/DOM dönüşleri, ağ gövdeleri, araç makbuzları, geçmiş ve ekran gözlemi de aynı korumaya tabidir. Parola/OTP/kart alanı veya bilinen sır taşıyan bölge güvenilir biçimde maskelenemiyorsa görüntü modele gönderilmez. Güvenli durum doğrulanana kadar gözlem durdurulur; sır değerini geri taşıyabilecek geliştirici araçları o hedef/istek için açık bırakılmaz. Alanın temizlendiği/gezinme sonucu ve izin bitişi doğrulanır. Koruma doğrulanamayan hedefte sır otomatik doldurulmaz; kullanıcı yalnız bu gizli aşamayı tamamlar ve Umay güncel gözlemle işten devam eder.

Native pencere başlığı/URL tek başına tarayıcı profili veya parola hedefi kanıtı değildir. Aynı domain'i açmış iki profil ayırt edilemiyorsa sır kullanımı kullanıcı profil seçimine kadar bekler. Mevcut Chrome'a native yolla devam edebilme, o görünümde otomatik sır doldurma izni vermez. Ürün, aynı Windows hesabında bağımsız keyfî kod çalıştıran kötü amaçlı yazılıma karşı OS yalıtımı sağladığını iddia etmez; Windows güvenli saklama disk üzerindeki veriyi korur, tüm bilgisayara yetki verilmiş başka kodu sihirli biçimde sınırlamaz. Modelden sır saklama iddiası, uygulanmış ve sınanmış yerel aracı/çıktı sınırlarıyla sınırlıdır.

Sır olarak bildirilen veri için kayıt formu/yerel yakalama yolu gerekir: normal sohbet veya STT arşivine düz metin sır düşüp sonra şifrelenmiş sayılmaz. Genel dosya arama/okuma araçları da kasanın özel dosyalarını sıradan dosya gibi okuyamaz. Mevcut kişisel kayıtların taşınması açık, geri alınabilir ve doğrulanmış bir geçiştir; eski veri doğrulanmadan silinmez.

## 4. Çalışma bağlamı ve devamlılık

### Arka plan gözlemi

- Ayarlardan görünür ve durdurulabilir; kullanıcı bu cihaz için beş dakikada bir kontrol istiyor. Diğer kullanıcıda ilk etkinleştirme açık seçimdir. Zamanlayıcı **300.000 ms**, aynı anda tek gözlem.
- İlk tercih salt okunur ön pencere/uygulama/erişilebilirlik ve bağlı tarayıcı durumudur. Gereken görüntü modelle analiz edilirse bu gözlem etkinliği arayüzde görünür. Otomatik gözlem uygulama açmaz, sekme değiştirmez, odak çalmaz, fare/klavye girdisi göndermez.
- Ham ekran görüntüsü varsayılan olarak kalıcı saklanmaz. Kısa bağlam özeti, gözlem zamanı ve gerçek hedef kimliği tutulur. Kullanıcı gizli mod/duraklatma seçebilir; gizli alan değerleri özetlenmez.
- Kilit/güvenli ekran, askıya alma ve oturum değişiminde gözlem bırakılır; hata döngüsünde CPU/istek fırtınası oluşmaz. Hesap nesli değişince geç dönen gözlem yeni hesaba yazılamaz.
- Beş dakikalık bilgi yalnız hazırlık bağlamıdır. **Her yeni işlem komutunda güncel hedef yeniden okunur**; periyodik son ekran yeni girdi izni veya güncel öğe kimliği değildir.

### Komutlar arası hedef

- Aynı sohbetle sınırlı olmayan, hesap/cihaz/oturuma bağlı çalışma durumu: son anlamlı uygulama, proses/pencere kimliği, masaüstü, tarayıcı bağlantısı/profili, sekme/URL, son görev ve gerçek sonuç. Kısa süreli hedef ile uzun süreli öğrenilmiş yöntem ayrılır.
- Umay ön plana geldiğinde kullanıcı uygulamasını unutma; ancak kapanmış pencere, yeniden kullanılmış handle/PID veya başka Chrome profiline eski hedefi bağlama. Yeni aktif uygulama önceki hedefi değiştirmişse yeni gerçek hedef esas olur.
- “Şunu ara”, “üçüncüyü aç”, “sıradakine geç”, “tam ekran”, “küçült” gibi devam komutları önce güncel hedefe bağlanır. Eksik nesne güncel listede çözülebiliyorsa işi kullanıcıya anlattırmaz. Birden fazla gerçek hedef arasında ayrım yoksa yalnız gereken ayrımı sorar.
- Sonuç listesinde başlık/URL/sıra gibi anlamlı bilgiler kısa süreli bağlamda tutulur; eski UID/koordinat tekrar kullanılmaz. Güncel sonuç listesi değişmişse yeniden sırala/doğrula. Reklam/öneri/organik sırası belirsizse tahminle başka sonuç açma.
- Kullanıcı başka sekmeye/profile geçince eski MCP seçiminin gerçek aktif sekme olduğu varsayılmaz. Origin, görünen URL/başlık, profil ve sekme eşleştirilir. Mevcut Chrome bağlantı izni yoksa kullanıcı profilini kopyalama veya korumayı kapatma; geçerli native görünüm/izin yoluyla devam et.
- Yerel sesli Dur ve F8 her aşamada önceliklidir. Yeni yönlendirme, eski model yanıtını/izlemeyi iptal veya düzeltme olarak ele alır; eski yanıt sonradan yazı/tıklama uygulayamaz. Bekleyen komutlar sessizce kaybolmaz; sıra/değişiklik açık durum taşır.

## 5. Uzun işler ve kullanıcı katkısı

Görev durumu: çalışıyor, izliyor, kullanıcı bilgisi bekliyor, belirli onay bekliyor, OS izni bekliyor, duraklatılıyor, duraklatıldı, tamamlandı, kısmi hata. “Tamamlandı” gerçek sonuca bağlanır. Saatler süren iş, tek bir HTTP/model çağrısı veya 30 dakikalık döngü sınırı nedeniyle unutulmaz; checkpoint ve yeniden gözlemle yeni yürütme bölümleri açılır. Kullanıcı durdurma ve yeniden başlatma sınırı korunur.

Bir anda tek görev fare/klavye ve etkili araç sahibi olur. Salt okunur arka plan izleme işleri ayrı devam edebilir. Yeni aynı-iş yönlendirmesi etkin görevi günceller ve önceki yanıt neslini iptal eder; ilgisiz yeni iş önceki etkili aşamayı checkpoint ile duraklatır. Eski izleyici bitişi saptarsa durum/sonuç kaydeder; yeni görevin arasına tıklama veya odak çalma sıkıştırmaz. Kullanıcı önceki işe dönebilir; birden fazla olası iş varsa hangisi olduğu sorulur. OTP cevabı yalnız belirli bekleyen görev/alan/origin ve geçerlilik süresine bağlıdır; yeni ilgisiz işe rakamlar parola gibi uygulanmaz.

Çökme/yeniden açılış checkpoint'i ve salt okunur durum kontrolünü geri getirir; eski mutasyon, ödeme, kurulum veya uzak komut otomatik yeniden oynatılmaz. Gerçek OS/SSH işi hâlâ çalışıyor olabilir: sonuç/sahiplik geri okunur, belirsiz etki yok sayılıp aynı komut tekrarlanmaz. Yeniden başlatmada OTP/sırın düz değeri saklanmaz; gerekiyorsa yeniden istenir. Yapılandırılmış 5 dakikalık gözlem, geçerli hesap ve açık ayarla başlayabilir; bu eski görevlere yeni işlem onayı vermez.

- OTP sorusu aynı checkout/giriş görevi, aynı alan ve origin ile bekler. Sesli cevap geldiğinde güncel sayfa/alan yeniden doğrulanır ve yalnız beklenen alana bir kez uygulanır. Kod, yeni bağımsız sohbet/iş veya kalıcı hafıza olmaz. Yanlış/süresi dolmuş kod kullanıcıya anlaşılır bildirilir.
- Her siparişte kargo adresi kullanıcıya teyit edilir. Sitede adres yoksa uygun yerel adres açıkça önerilir. Kullanıcının verdiği yeni adres aynı hesap için kaynakla kaydedilir; siparişe özel düzeltme ile kalıcı adres değişikliği ayrılır.
- Sepete ekle, satın al ve ödeme farklı etkiler olarak tutulur. Kullanıcının gerçek talimatı, ürün/adet/fiyat/para birimi, cüzdan bakiyesi veya kart seçimi güncel sayfadan doğrulanır. Bir ödeme hatasından sonra siparişin oluşup oluşmadığı araştırılmadan tekrar ödeme yapılmaz. Belirsiz tutar/alıcı/ürün sorulur.
- Uygulama/coding ajanı işi izlenirken gerçek pencere/proses ve sonuç okunur; bitiş yalnız metin değişimiyle uydurulmaz. Kullanıcının “test et, sorun yoksa devam et” koşulu gerçek test sonucu olmadan tamamlandı sayılmaz.

## 6. Genel yetenek matrisi

| Alan | Sağlanacak genel yol | Doğrulama / gerçek sınır |
| --- | --- | --- |
| Web, medya, formlar | Chrome MCP; güncel profil/sekme, form/girdi/scroll/medya ve yükleme/indirme | Site oturumu, değişen arayüz, CAPTCHA/OTP gibi insan katkısı gerektiğinde açık bekleme; örnek siteye özel komut listesi yok |
| CAD, 3D, görsel, oyun, IDE | Windows erişilebilirliği, görüntü ve gerçek girdi; gerektiğinde uygulamanın kendi API/CLI adaptörü | Canvas ile metin denetimleri ayrı test edilir. Her uygulamada profesyonel çıktı veya oyun becerisi önceden varmış gibi söylenmez |
| Açık/kurulu uygulamalar | Dinamik keşif, başlatma, öne getir, küçült/büyüt/tam ekran/kapat; kullanıcının gerçek hedefini doğrula | Kapatma öncesi kaydet penceresi ve kullanıcı verisi; min/max ile uygulama içi tam ekran ayrımı |
| Sistem ve dosyalar | Mevcut genel dosya/uygulama/paket/süreç araçları; ses/parlaklık için işletim sistemi adaptörü | Bağlı gerçek aygıt/ekran, uygulanan değer ve yetki; donanımın desteklemediği parlaklık sahte başarı değil |
| Sunucu ve ağ aygıtları | Şifreli bağlantı profiliyle SSH; komut/çıktı/dosya ve uzun iş/iptal; cihazın yetkili yerel API/CLI'si | Host anahtarı doğrulaması, doğru host/hesap, gerçek bağlantı ve geri okuma; kapalı ağ/erişilemeyen aygıt için somut engel |
| Uzak masaüstü | Mevcut RDP/AnyDesk/diğer uygulamayı aynı pencere modeliyle kullan | Yerel ve uzak hedef karışmaz; uzak uygulama görüntüsü yerel UIA gibi varsayılmaz |
| Mail ve hesaplar | İstenen tarayıcı profili/sağlayıcı veya Outlook/yerel uygulama; kayıtlı hesap referansı | Yanlış hesaptan işlem yapma; okuma, taslak ve gönderme ayrımı; gönderim alıcısı/içeriği gerçek kullanıcıdan |
| Arama/görüntülü arama | Kullanıcının seçtiği uygulama/hesap ve doğrulanmış kişi | Aynı adlı kişiler, mikrofon/kamera/oturum izni ve çağrı durumu; yanlış kişiyi aramak başarı değil |
| Yönetici/güncelleme | Gerçek kullanıcı UAC onayı sonrası mevcut yetkili yardımcı; sahip olunan kurulum/işler | Güvenli Windows onayı otomatik verilmiş gibi gösterilmez; güncellemede yeniden başlatma/kaydedilmemiş işler dikkate alınır |

Bu matris kabul çerçevesidir. Bir API/uygulama/cihaz üzerinde henüz uygulanmamış adaptör veya gerçek test “destekleniyor” diye pazarlanmaz. Yürütücü ilk hatada genel “yapamam” yerine yeni gerçek durumu okur, uygun başka yolu dener veya gereken tek kullanıcı katkısını sorar. Bağlantı/OS/uygulama sınırları ve sonuçlar dürüstçe bildirilir.

## 7. Uygulama sırası ve kabul

Onay sonrası ayrıntılı dosya/arayüz/test planı `Docs/plan.md` ve `Docs/walkthrought.md` ile bağlantılı ayrı uygulama belgesine yazılacak. Önerilen doğrulanabilir parçalar:

1. Kaynaklı hafıza şeması, Obsidian keşif/bağlantı ve Eklentiler ekranı; yalnız geçici vault ile oluştur/güncelle/içe al/çakışma/hesap değişimi kabulü.
2. Şifreli özel kayıtlar, kurtarma tercihi ve yerel sır kullanımı; model/log/Markdown sızıntı testleri, kilit/çıkış/yanlış origin/yanlış kurtarma/taşıma kabulü.
3. Güncel çalışma bağlamı, 5 dakikalık gözlem, aynı iş/uygulama/profil devamı ve tekrar önleme; gerçek kayıtların önce başarısız regresyonu.
4. Uzun görev/OTP/adres/alışveriş durumları, pencere/ses/parlaklık ve şifreli profil üzerinden SSH; genel araç sözleşmesine dahil etme, gerektiğinde ayrı adaptörler.
5. Gerçek modelle farklı site/uygulama birleşik kabulü; ses ve eski özelliklerin regresyonu, izole sunucu testi/dağıtımı gerekiyorsa uygulama, son installer ve GitHub.

Asgari uçtan uca kabul: herhangi bir test aramasını aç → ayrı komutta arat → ayrı komutta üçüncü sonucu aç; kullanıcı başka uygulama/sekme/profile geçsin → orada devam; uygulamayı saatlerce izleme senaryosunda checkpoint/iptal/yeniden başlatma; sandbox checkout'ta OTP/adres/ödeme tekrarı; bağlı olmayan vault/aygıt/SSH, değişen dosya ve uygulama kapanması. Gerçek banka alışverişi veya kullanıcı verisi silme, test için yapılmaz. Gerçek model ve kontrollü planlayıcı ölçümleri ayrılır; p50/p95 ve doğru tamamlama oranı raporlanır.

## Seçilen kasa ve uygulama kararı

Kullanıcının ilk mesajı bu kapsamın uygulanması talimatıdır; son yanıtı kurtarma anahtarıyla taşınabilir kasayı seçer. Kesin uygulama/test planı `obsidian-continuity-implementation.md` içindedir. Gerçek vault bağlantısı, kasa anahtarının kullanıcıya gösterilmesi ve gözlem tercihi görünür yerel onboarding ile kurulur; testler gerçek kişisel verileri kopyalamaz.

Bağımsız planlanabilirlik incelemesi tamamlandı. Sır kullanımından sonraki gözlem/araç sınırı, çok hesap/cihaz sahipliği, belirsiz native profil, eşzamanlı izleme/etkili iş ve not silme/yeniden başlatma davranışları netleştirildi. İkinci okumada kalan önemli planlama sorusu bildirilmedi. Teknik inceleme kullanıcı talimatını genişletmez; mühendislik tercihleri uygulama planında açıkça kaydedilir.
