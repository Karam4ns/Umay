# Obsidian hafızası ve çalışma devamlılığı — 0.8.0 kabul kaydı

7 Kasım 2026. Kaynak dalı: `codex/obsidian-continuity`. Temel: 0.7.0; çekirdek commit'i `555b91e`, son düzeltme `e0dd038`. Bu kayıt test sürümünü ve sınırlarını anlatır; bütün uygulamalarda kusursuz kontrol kabulü değildir.

## Uygulananlar ve kanıt

| Alan | Uygulama ve doğrulama | Açık sınır |
|---|---|---|
| Kişisel hafıza | Kaynaklı/sürümlü katalog, özel türler, tercihler, adres ve hesap referansları; mevcut kişisel notlardan aktarım, işlem günlüğünden artımlı kayıt, kullanılan dosyaların gerçek yolları. Hesap ayrımı, paralel sürüm, eksik ebeveyn ve tombstone testleri. | Bilgisayarın tamamındaki dosyaları Markdown'a çoğaltmaz; mevcut yerel dosya indeksi kullanılır. Otomatik kişisel bilgi çıkarımı mevcut yerel kurallarla sınırlıdır; kapsamlı anlamsal profil çıkarımı ayrıca değerlendirilir. |
| Obsidian | Eklentiler sekmesi, kurulu vault keşfi/seçimi; Türkçe not ve immutable kaynak geçmişi; düzenleme içe alma, görünür çatışma/yedek, arşiv, yönetilen alan içindeki taşımayı izleme; mevcut indeks metnini koruma ve append-only günlük. Gerçek geçici dosya sistemi ve Electron UI/IPC testi geçti. | Gerçek kişisel vault hafıza denemesi için değiştirilmedi; kullanıcının yeni talebiyle yalnız Umay proje belgeleri Umay/Docs alanına kopyalandı. Yönetilen alan dışına elle taşınan notlar otomatik izlenmez. Dosya denetimi/yazımı uygulamalar arası gerçek atomik CAS değildir. Kurulu Obsidian URI'sinin gerçek UI kabulü açık; testte doğru URI üretimi doğrulandı. |
| Taşınabilir kasa | AES-256-GCM, kurtarma anahtarı, cihaz korumalı anahtar kopyası, sürüm/çatışma/silme ve şifreli aktarım. Gerçek Windows safeStorage aç/kapat ve başka cihaz dizinine recovery import geçti. Güvenli form düzenlemesi mevcut alanları korur. | Anahtar kullanıcı tarafından güvenli saklanır. Büyük kasada senkron kripto/disk işi gecikme yaratabilir; 64 MiB paket sınırı vardır. Çökme sırasında çok dosyalı import tam transaction değildir; stale kilit için görünür bakım gerekir. |
| Sır kullanımı | Doğrulanmış yönetilen Chrome profili, origin/sekme/görev bağlı yerel doldurma ve isteğe bağlı tek submit; model/hafıza sonuçlarında değer yok; korunan aşamada görüntü ve tehlikeli okuma/exec kapıları. Gerçek yerel test mağazasında sahte parola ve tek kullanımlık OTP doldur/gönder geçti. | Kimliği doğrulanamayan mevcut Chrome/native profillerinde otomatik sır doldurulmaz. Aynı OS hesabındaki bağımsız kötü amaçlı yazılıma karşı sandbox değildir. OTP/CVV kalıcı kasaya yazılmaz. |
| Pasif çalışma bağlamı | 300.000 ms zamanlayıcı, UIA/ön pencere, yalnız etkin pencerenin geçici görüntüsü ve görsel modelden salt okunur özet; hesap/iptal ve tek uçuş. Umay/gizli ekranlarda atlama. Komut gelince gözlem iptal olur. Gerçek test penceresi yakalama ve gerçek Alfa görsel model özeti ayrı ayrı geçti. | Ayarlardan açılması gerekir. Fiziksel beş dakika bekleme yerine zamanlayıcı sözleşmesi ve tetiklenmiş gerçek gözlem test edildi. Özet hatası yeni işlem başlatmaz. Görüntü görsel modele iletilir; ham görüntü yerel kalıcı hafızada tutulmaz. |
| Komut devamlılığı | Her komutta taze hedef, Umay öndeyken doğrulanmış önceki pencere, semantik tarayıcı sonucu, hesap bazlı profil bağlantıları; profil belirsizliğinde doğru hedef isteme. Aynı alan değerini yeniden doldurma ve ilerlemesiz Enter/click döngüsü koruması. | Yeni/özel uygulamada güvenilir kontrol model başarısına ve gerçek UI erişimine bağlıdır. Bütün tarayıcı profillerini native başlıktan kesin eşleme iddiası yok. |
| Uzun işler | Dur/F8 korunur; yeni işte mevcut iş duraklatılır, kaynaklı checkpoint kaydedilir. Eklentiler → Kaydedilen işler üzerinden açık seçimle, yeni gözlemle geri dönülür. Başlangıçta otomatik etki tekrarı yok. | Birden fazla bağımsız uygulamayı aynı anda saatlerce izleyen ayrı görev zamanlayıcısı tamamlanmadı. Mevcut 120 adım/30 dakika etkin çalışma ve sınırlı watch bütçeleri korunur. Uzun profesyonel uygulama kabulü açık. Bekleyen sorudan farklı işe geçiş için `yeni iş: ...` kullanılabilir. |
| SSH/ağ | Yerel şifreli profiller, gerçek kullanıcıya bağlı yeni/değişmiş host-key onayı, komut işleri/çıktı/durdurma, SFTP liste/oku/sürüm kontrollü yaz. Gerçek loopback SSH ve Unicode/boş/kısaltılan dosyayla SFTP geçti. | Üretim sunucusunda bu yeni adaptörle mutasyon yapılmadı. Uzak channel kapanışı süreç durması demek değildir; belirsizlik yeni tekrarları engeller. SFTP üzerine yazma dağıtık atomik CAS değildir. Genel ağ cihazının SSH/RDP/uygulama desteği gerekir. |
| Windows | PID/handle doğrulamalı odak/min/max/restore/close, gerçek ses ve desteklenen ekran parlaklığı araçları. Kendi test penceresinde gerçek işlemler ve F8 geçti. Ses/parlaklık yalnız okunarak keşfedildi. | Kullanıcının ses/parlaklığı test için değiştirilmedi. Tam ekran uygulamaya özgü UI yoludur. İlk gerçek güvenli UAC onayı kullanıcıda kalır. |
| Alışveriş | Görev/site/profil/süre bağlı OTP, adres, kargo teyidi ve ödeme seçimi bekleme türleri; yeni adresi kaynakla kaydetme; her siparişte adres teyidi model sözleşmesinde. | Yerel mağaza testi giriş ve OTP'yi doğrular; bütün sitelerde ödeme/adres/cüzdan ve belirsiz sipariş tekrarını engelleyen evrensel checkout motoru kabulü değildir. Gerçek alışveriş yapılmadı. |

## Test sonuçları

- Son tam Node paketi: **395/395** geçti. Sonraki değişiklikler için yalnız ilgili kontroller tekrarlanır.
- Mevcut Türkçe okuma/tonlama ve klonlama testleri: **52/52** geçti; konuşma kaynaklarında işlev değişikliği yok. Paket runtime ile sıcak TTS ilk parça: normal ses **340,8 ms**, mevcut klon **334,6 ms**; iki cümle de tamamlandı ve profil dosyalarının hashleri değişmedi. Soğuk model yüklemesi bu sıcak ölçümlere dahil değildir.
- Gerçek Alfa1.2 + Alfa1.2-vision ile üç ayrı sohbet isteği: site aç **10.655 ms**, tam iki sözcüklü arama **18.984 ms**, üçüncü sonuç **13.371 ms**. Hepsi aynı gerçek yönetilen Chrome akışında doğrulandı.
- Gerçek genel web→dosya zinciri **24.519 ms**; model **20.837 ms**, gözlem **1.693 ms**, giriş/araç **814 ms**, 10 model turu. Bu ölçümler p50/p95 veya her görev için hız garantisi değildir.
- Salt okunur gerçek görsel model özeti **5.148 ms**; kendi geçici görüşmesi arşivlendi. Fiziksel pencere yakalama→özet→kendi görüşmesini arşivleme ayrı gerçek Electron testinde doğrulandı.
- Gerçek ayar ekranı: vault seçimi, not eşitleme, güvenli form kaydı, recovery anahtarı göster/gizle, sekme geçişleri geçti. Test sahte hesap/ayrı uygulama dizini kullanır; başlangıçta login/ses çalışma zamanı uyarısı üreten fixture, gerçek giriş/mikrofon kabulü olarak sunulmaz.
- Gerçek Windows safeStorage, kendi pencere yönetimi, fare/klavye/scroll/drag/iki pencere ve F8 kabulü geçti. Parola/OTP testi yalnız sahte yerel mağazadadır.

İlk gerçek model devam testinde iki sözcüklü arama kısaltıldı; bu başarısız deneme başarı sayılmadı. Tam ifadeyi koruyan sözleşme sonrası yeniden deneme geçti. İlk kontrollü sayfa fixture'ının bozuk arama gönderimi tekrara neden oldu; fixture düzeltildi, ürüne ilerlemesiz tekrar sınırı ayrıca eklendi. Son denetimde snapshot UID değişimini aşan tekrar koruması, Windows yolunda büyük/küçük harf ve ADS denetimi, gereksiz adaptör yükseltme isteği ve observer arşiv sürüm çakışması düzeltildi. İlgili testler eklendi. İlk konuşma testi boş test ortamında eksik bağımlılıkla başarısızdı; paketle aynı runtime ve dışarıda tutulan pytest araçlarıyla 52 test geçti. Başarısızlıklar gizlenmez.

## Kurulum ve kullanım

1. 0.8.0 test installer'ını kur. Mevcut varsayılan tarayıcıyla giriş akışı ve sohbet/model rolleri korunur.
2. Ayarlar → Eklentiler → Obsidian bölümünden kendi vault'unu seç.
3. Yeni şifreli kasa oluştur; bir kez gösterilen kurtarma anahtarını ayrı güvenli yerde sakla. Başka cihazda önce şifreli yedeği bu anahtarla içe aktar. Eski özel hesaplar yalnız yerel düğmeyle aktarılır ve doğrulanmış kaynakları korunur.
4. İstersen beş dakikalık gözlemi aç. Görsel modelin etkin pencereyi görebileceği bu tercihte açıkça yazılıdır. Notları normal sohbetten kaydetmesini isteyebilirsin.
5. Dur/Devam/F8 yereldir. Eski işe Eklentiler → Kaydedilen işler bölümünden dön. Kasa kullanımı sonrasında gizli ekranı kapattığında ilgili düğmeyle görüntüye devam edebilirsin.

## Teslim ve kalan kabul

Son kaynaklarla 71 uygulama dosyası, unpacked native yardımcı, dört konuşma modülü ve 361 MCP dosyası birebir eşleşti. Son ASAR içinden hafıza/kasa/Obsidian/SSH2 ve araç kayıtçısı, workspace bağımlılığına düşmeden yüklendi. Gerçek paketlenmiş Umay.exe ile Chrome MCP gezinme/okuma/yeniden bağlantı testi geçti. Paket üretimi son kaynak düzeltmeleri sonrasında yeniden başlatıldı; eski ara paketler teslim edilmez. Otomatik genel güncelleme yayını yapılmaz; 0.7.0 installer'ı korunur. Test oturumları sonlandırıldı; kullanıcı oturumları ve üretim sunucu kurulumu değiştirilmedi.

AutoCAD, Unreal, Photoshop, oyunlar, çok monitör/aygıt, birden fazla mail sağlayıcısı, her site için ödeme ve saatler süren çalışma henüz gerçek kabulden geçmedi. Bu maddeler ürün kapsamındadır ve açık kalır. Görev 1 bağımsız kripto/kapasite incelemesinden geçti; sonraki inceleyiciler kullanım kotasında durduğu için entegrasyon çalışması ana ajan tarafından tamamlandı ve test edildi. Bağımsız bütün-dal incelemesi yapılmış gibi işaretlenmez.

### Doğrulanmış 0.8.0 test kurulumu

- Installer: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/obsidian-0.8.0/Umay Setup 0.8.0.exe`
- Boyut: **378.190.883 bayt**; blockmap **392.908 bayt**.
- SHA256: `4f11cc91420ca1b2a9c0d38557c72fc4ba2838418d312f51eb7b5253a4ddeb0c`
- SHA512: `y1A8bVKx5ktGt1D1EvSLOjLtjQGZG0LW5BPRDh+nRU5GNFA1g7uO1Ua9l/UshW2Wck9TxmQwlN3Ys/GKD4EbPg==`
- Kod kimliği: `e0dd038`; kaynak: [codex/obsidian-continuity](https://github.com/Karam4ns/Umay/tree/codex/obsidian-continuity).
- `latest.yml` sürüm/boyut/SHA512 ve kopyalanan installer SHA256 doğrulandı; `verification.json` aynı klasördedir. İmzasız test sürümüdür. Son NSIS sıkıştırması seviye 3 ile üretildi; uygulama işlevini değiştirmez.
- 0.7.0 installer'ı korunur. Yeni sürüm bu cihazda otomatik kurulmadı, genel güncelleme kanalına yayımlanmadı.
- Kullanıcının yeni proje kaydı talebiyle vault içinde `Umay/Docs` altında 30 Markdown belgesinin içerik kopyası tutulur; `Umay/umay.md`, kaynak notu, kök indeks ve append-only günlük bağlantıları eklendi. Güncel kopyalar içerik hashleriyle karşılaştırıldı. Sunucu erişim dosyası dahil edilmez.
