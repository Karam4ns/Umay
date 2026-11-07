# Umay — Adım Adım İlerleme ve Yol Haritası

**Güncelleme:** 2026-11-03
**Mevcut adım:** Windows geliştirme sürümü — uygulama, doğrulama ve paketleme.
**Son ek:** 0.1.1 varsayılan tarayıcı giriş/çıkışı uygulandı; sunucu frontend katmanı
güncellendi ve sağlık/sınır testleri geçti. Gerçek hesapla tarayıcı girişi manuel kabul bekliyor.
**Durum:** Kodlama başladı; tüm kabul koşulları henüz tamamlanmadı.
Güncel kanıt ve sınırlar: [implementation.md](implementation.md).
**Ana belge:** [plan.md](plan.md)
**Kural:** Her adım kullanıcı yönlendirmesiyle başlar. Listede sıradaki adımın bulunması
onu otomatik başlatma yetkisi değildir. Tasarım en son; güncel kapsam yalnızca Windows.

## 1. Gerçek başlangıç durumu

- Dizinde Docs ve .claude bulunuyor; henüz ürün kodu/proje bildirimi yok.
- Docs daha önce oluşturulmuş; eski “yalnızca .claude var” kaydı artık güncel değil.
- Django/DRF önceki not olarak korundu; yerel backend veya DB kurulmadı.
- STT/TTS, Windows kabuğu ve LLM erişimi henüz kesinleşmedi.
- Hedef: Türkçe kalite önceliği, hafif çalışma ve 4 GB VRAM birlikte.
  Güncel öncelikli denemeler STT large-v3-turbo ve TTS Pocket TTS Turkish;
  large-v3/small ile Chatterbox Multilingual V3/XTTS-v2 karşılaştırma adayları.
  Hiçbiri kurulmadı veya 4 GB üzerinde doğrulanmadı; small varsayılan sayılmıyor.
- Önceki renkler reddedildi; kabul edilmiş nihai palet yok.
- Yeni gereksinimler: otomatik donanım/backend seçimi, GPU yoksa/kullanılamazsa CPU;
  STT/TTS uygulama açıkken seçilen GPU belleği veya CPU RAM'inde kalıcı hazır.
  Barge-in zorunlu; oynatım referanslı AEC ile kendi sesinden tetiklenmeme doğrulanacak.
  Apple M/ARM yolları mimaride ayrılıyor; ilk uygulama/test kapsamı yine Windows.
- sunucu.txt bu aşamada açılmadı; SSH, DB ve hesap entegrasyonu yapılmadı.
- Dağıtım hedefi umay.veriussu.com; Windows kurulum dosyası ve otomatik güncelleme.
  Yeniden açılış/Windows restart/güncelleme oturumu kapatmayacak; açık çıkış desteklenecek.
  Sunucu oturum iptali ayrı durumdur. Mobil/macOS/Apple M bu sürümün teslim kapsamı dışında.

## 2. Yol haritası

| Adım | Durum | Çıktı | Bağımlılık |
|---|---|---|---|
| P0 Planlama | Tamamlandı | Ayrıntılı plan ve ilerleme dosyası | Bu talep |
| A0 Kararlar | Geliştirme kararları alındı | Electron + Python, mevcut NestJS API | implementation.md |
| A1 Windows temeli | Test edildi | Pencere, IPC ve gezinme smoke testi | A0 |
| A2 Cihaz/işçi | Kısmen uygulandı | CPU işçisi; gerçek mikrofon/hoparlör testi bekliyor | A1 |
| A3 Paket yönetimi | Kısmen doğrulandı | Gerçek STT/TTS indirme/yükleme; hata testleri genişleyecek | A2 |
| A4 Türkçe STT | Sentetik sesle doğrulandı | TTS çıktısı doğru metne dönüştü; gerçek mikrofon bekliyor | A3/STT |
| A5 Model yanıtı | API adapter'ı yazıldı | Gerçek hesapla test ve erken metin akışı eksik | API erişimi |
| A6 Türkçe TTS | CPU üretimi doğrulandı | Ses üretimi ve protokol; kullanıcı dinleme kabulü bekliyor | A3/TTS |
| A7 Birleşik sohbet | Kısmen uygulandı | İptal regresyonları geçti; gerçek AEC/20 tur kabulü eksik | A4+A5+A6 |
| A8 Ses klonlama | Uygulandı, kabul bekliyor | MP3 sınırı/profil akışı; gerçek klon benzerliği testi eksik | A6+A7 |
| A9 Windows doğrulama | Installer hazırlanıyor | İmzasız test sürümü; production update testi yok | A10.5 oturum testi eksik |
| A10 veriussu.com | Mevcut API'lere bağlandı | Kullanıcı testi ve kalıcı desktop refresh sözleşmesi eksik | implementation.md |
| A11 Nihai tasarım | Ertelendi | Onaylı açık/koyu Windows tasarımı | İşlevsel fazlardan sonra |
| M1 Mobil/macOS | Bu sürümün dışında | Şimdi geliştirme/paketleme yapılmaz | İleride ayrı kullanıcı talebi |

Süre/yüzde tahmini yok: teknik seçimler ve kullanıcının adım sırası henüz belli değil.

## 3. P0 tamamlanan işler — 2026-11-03

- [x] Mevcut plan, ilerleme, sohbet ve test kayıtları okundu.
- [x] Vault AGENTS.md, CLAUDE.md ve proje referansı kanun.md okundu.
- [x] Kullanıcının Türkçe sesli konuşma kapsamı ve çalışma yöntemi kaydedildi.
- [x] Temel Windows fazı ile sunucu/hesap/DB ve nihai tasarım ayrıldı.
- [x] Paket yaşam döngüsü, otomatik hazırlık, klonlama ve kabul koşulları yazıldı.
- [x] Hız hedefleri ölçülmemiş öneriler olarak belirtildi.
- [x] Doküman kapsam/tutarlılık kontrolü yapıldı; sonuç test.md'ye kaydedildi.

Ürün kodu, model indirme, bağımlılık kurulumu ve sunucu işlemi yapılmadı.

## 4. Adım kontrol listeleri

### A0 — Kararlar

- [ ] Kullanıcı bu adımı başlattı.
- [ ] Windows/CPU/RAM/GPU/disk profili kaydedildi.
- [ ] 4 GB hedef kartın modeli ve desteklediği çalışma yolu kaydedildi;
  güncel STT/TTS adayları aynı Türkçe metin/referans ses üzerinde gerçek ölçümle değerlendirildi.
- [ ] Kabuk, STT/TTS ve klonlama motoru değerlendirildi; seçim gerekçesi kaydedildi.
- [ ] API erişimi, yerel dosyalar ve 50 MB yorumu netleşti.
- [ ] Kesin dosya yolları, sürümler ve test komutları plan.md'ye eklendi.
- [ ] Sonuç kullanıcıya sunuldu; A1 henüz başlamadı.

### A1 — Windows temeli

- [ ] Kullanıcı başlattı; minimum uygulama oluşturuldu.
- [ ] Ana ekran ve Ayarlar/Konuşma gezinmesi çalışıyor.
- [ ] Konuşma kapalı başlıyor; eksik/bozuk tercihle açılış ve kapanış doğrulandı.
- [ ] Yerel DB yok; test ve Docs kayıtları tamamlandı.

### A2 — Cihaz/işçi

- [ ] Mikrofon/çıkış seçimi, seviye ve kısa kayıt/oynatım çalışıyor.
- [ ] İzin reddi, cihaz çıkarılması ve cihaz değişimi denendi.
- [ ] Ağır işlem arayüzü kilitlemiyor; iptal/kapanış mikrofonu serbest bırakıyor.
- [ ] Tüm GPU'lar ve gerçek backend desteği test edildi; STT/TTS için ayrı cihaz
  seçimi, GPU yok/bozuk sürücü/düşük VRAM halinde görünür CPU fallback doğrulandı.
- [ ] Capture/render eşzamanlı akış ve oynatım referanslı AEC hattı doğrulandı.
- [ ] Test ve Docs kayıtları tamamlandı.

### A3 — Paket yönetimi

- [ ] Boyut/sürüm/alan ihtiyacı ve kurulum durumları gösteriliyor.
- [ ] Bağımlılıklar kullanıcı terminali olmadan kuruluyor.
- [ ] İptal, ağ kopması, yarım/bozuk dosya ve yetersiz disk denendi.
- [ ] Gerçek sağlık testi sonrası otomatik etkinleştirme çalışıyor.
- [ ] STT/TTS birlikte yüklenip ısıtılıyor; normal turlar ve iptallerde boşaltılmıyor.
  Kullanıcı kapatma/kaldırma veya uygulama kapanışında kaynaklar bırakılıyor.
- [ ] Ayrı kaldırma işçiyi boşaltıyor, diğer paketi/profili koruyor.
- [ ] Test ve Docs kayıtları tamamlandı.

### A4 — Türkçe STT

- [ ] Bas-konuş ve gerçek Türkçe mikrofon girdisi çalışıyor.
- [ ] VAD/konuşma sonu algılama; sessizlikte istek oluşmuyor.
- [ ] Kısmi/kesin metin ayrımı, sayı/tarih/kısa cevap/gürültü denendi.
- [ ] Test ve Docs kayıtları tamamlandı.

### A5 — Model yanıtı

- [ ] Gerçek endpoint/yetki ve akış sözleşmesi doğrulandı.
- [ ] Gerçek modelle Türkçe çok turlu yanıt çalışıyor.
- [ ] İptal/zaman aşımı/bağlantı kopması denendi.
- [ ] Erişim eksikse gerçek sohbet kabulü beklemede; taklit çıktı başarı sayılmıyor.
- [ ] Test ve Docs kayıtları tamamlandı.

### A6 — Türkçe TTS

- [ ] Varsayılan ses ve sıralı kuyruk çalışıyor.
- [ ] Noktalama/tonlama, sayı/saat/tarih ve Markdown denendi.
- [ ] Anlamlı parçalama ve kuyruk sınırı doğrulandı.
- [ ] Kullanıcı ses doğallığını dinleyerek değerlendirdi.
- [ ] Test ve Docs kayıtları tamamlandı.

### A7 — Birleşik sohbet

- [ ] STT → gerçek LLM → TTS gerçek cihazlarda çalışıyor.
- [ ] İlk ses tüm model yanıtını beklemiyor; durumlar gösteriliyor.
- [ ] Durdur/yeni soru eski üretim ve tamponları iptal ediyor.
- [ ] Kulaklık/hoparlör, söze girme ve yankı senaryoları denendi.
- [ ] Yalnız Umay sesiyle 20 örnekte yanlış kesilme; eşzamanlı kullanıcı konuşmasıyla
  20 örnekte algılama/iptal ve ilk hece korunumu ölçüldü. Klon kullanıcı sesi ayrıca denendi.
- [ ] 20 turda tekrar model yüklemesi yok; eski yanıt kesildikten sonra yeniden çalmıyor.
- [ ] En az 20 tur soğuk/sıcak süre ve p50/p95 kaydedildi.
- [ ] Gerçek 4 GB GPU'da STT/TTS birlikte tepe VRAM/RAM ve RTF ölçüldü;
  CPU fallback, normal/klon ses ve bellek yetersizliği davranışları ayrı kaydedildi.
- [ ] Test ve Docs kayıtları tamamlandı.

### A8 — Klonlama

- [ ] MP3 gerçek biçimi ve boyutu işleme öncesi doğrulanıyor.
- [ ] Sınır altı/tam sınır/sınır üstü; boş/bozuk/sahte dosya denendi.
- [ ] Uzun çözülmüş ses/kaynak sınırı, sessizlik ve iptal denendi.
- [ ] Profil oluştur/önizle/seç/sil ve yeniden açılış çalışıyor.
- [ ] Klon sesi gerçek Türkçe sohbette kullanıcı dinledi.
- [ ] TTS kaldırma/yeniden kurma profil davranışı doğrulandı.
- [ ] Test ve Docs kayıtları tamamlandı.

### A9 — Temel sürüm

- [ ] Geliştirme araçları olmayan Windows'ta dağıtım denendi.
- [ ] Kur/kaldır/yeniden kur ve alan geri kazanımı doğrulandı.
- [ ] Çökme/ağ/cihaz kaybı ve bozuk paket onarımı denendi.
- [ ] Yerel DB ve dağıtıma gömülü sır yok; gerçek sınırlar kaydedildi.
- [ ] A9.1: Windows installer/updater ve mimari seçildi; HTTPS, imza ve manifest
  yayını doğrulandı. Henüz canlı yayın yapılmış sayılmıyor.
- [ ] vN → vN+1 güncellemesi, aktif konuşmada erteleme, bozuk paket/ağ/disk/yanlış
  mimari ve yarım kurulumdan toparlanma test edildi.
- [ ] Güncelleme ayar/model/klon profilini koruyor; A10.5 sonrası gerçek oturum da korundu.

### A10 — Daha sonra veriussu.com

- [ ] Kullanıcı fazı başlattı; sunucu.txt güvenli incelendi.
- [ ] SSH ile önce salt okunur API/site/oturum incelemesi yapıldı.
- [ ] API üzerinden eşleme alt planı yazıldı; doğrudan masaüstü DB bağlantısı yok.
- [ ] Kayıt/giriş/yenileme/çıkış ve kullanıcı veri ayrımı doğrulandı.
- [ ] A10.1: Aktif kullanıcının yetkili modelleri ve sayfalanmış sohbet/mesajları alındı;
  yeni mesajlar sunucuya mükerrer kayıt olmadan yazılıyor.
- [ ] A10.2: Kullanıcının açık bilgi/kararları kaynağıyla çıkarılıyor; sunucu hafızasına
  tekilleştirilerek yazılıyor. Öneri/alıntı/varsayım kullanıcı gerçeği sayılmıyor.
- [ ] A10.3: Yeni sohbette ilgili hafıza sınırlı bağlama alınıyor; güncel karar öncelikli.
  Model değişse de hafıza korunuyor, hesap değişiminde önbellek ve geç yanıtlar temizleniyor.
- [ ] A10.4: İki hesap izolasyonu, tekrar, düzeltme, unutma/yeniden oluşmama,
  ağ hatası, model yetki iptali ve zaman aşımı test edildi.
- [ ] A10.5: Kalıcı güvenli oturum, token yenileme/rotation; kapat/aç, PC restart
  ve güncelleme sonrası girişin korunması doğrulandı.
- [ ] Ağ hatası token silmiyor; açık çıkış ve gerçek sunucu iptali ayrı test edildi.

### A11 — En son tasarım

- [ ] Nihai görsel yön kullanıcı tarafından seçildi.
- [ ] Açık/koyu tema ve Windows ölçekleme/odak/okunabilirlik doğrulandı.
- [ ] Tasarım sonrası sesli sohbet ve paket yönetimi tekrar doğrulandı.

## 5. Adım kapanışı

Her yeni adım kaydı: kullanıcı talimatı → değişen dosyalar → gerçek test kanıtı →
bekleyen/başarısız işler → kullanıcıya sonuç. Plan kararları plan.md'ye, test kanıtı
test.md'ye, yönlendirme/yanıt chat.md'ye, terminal özeti terminal.md'ye eklenir.

**Güncel çalışma:** Kullanıcı tüm adımların uygulanmasını ve GitHub'a yüklenmesini istedi.
Önceki kontrol listeleri kabul gereksinimlerini korur; bitmeyen işler işaretlenmez.

## [2026-11-03] İmzalama — yeni talep
- [x] İmzalı derlemenin sertifikasız sessizce devam etmesi engellendi; test geçti.
- [ ] Mevcut sertifika veya imzalama hesabı kullanıcıdan beklenecek.
- [ ] Gerçek Authenticode imzası ve doğrulanmış installer üretilecek.
Ayrıntı: signing.md. Önceki imzasız test tercihi yeni talep ile değişti.

## [2026-11-03] Varsayılan tarayıcı — 0.1.1
- [x] Gömülü giriş penceresi kaldırıldı; shell.openExternal ile sistem tarayıcısı.
- [x] Loopback callback, state, PKCE ve tek kullanımlık kod exchange.
- [x] Eski/iptal edilmiş oturumların iptali; çıkışta tarayıcı onayı.
- [x] Sunucu controller eklendi; mevcut tablolarda migration gerektirmiyor.
- [x] Çalışan frontend üzerine yalnız yeni modülün katmanı dağıtıldı; sağlık kontrolü geçti.
- [x] 19 Node testi, 9 canlı yetkisiz/sınır kontrolü ve Electron smoke geçti.
- [ ] Gerçek kullanıcı hesabıyla varsayılan tarayıcı → Umay dönüşü ana cihazda denenecek.

## [2026-11-03] Kullanıcı kararı — imzalama ertelendi
İmzalama işi kullanıcı talebiyle sonraya bırakıldı. Mevcut installer imzasızdır;
hazırlanan build:signed yolu korunuyor. Sertifika/hesap bekleme sorusu artık aktif değil.

## [2026-11-04] Mikrofon girişi — 0.1.2
- [x] RMS .004 girişin önceki .015 sabit eşiğinde STT'ye ulaşmaması yeniden üretildi.
- [x] Boşta .0025 alt eşik ve gürültü tabanı; oynatım sırasında .015 korundu.
- [x] Tek worklet kaydı, kapat/aç, kaynak temizleme ve çıkışta geç açılış iptali.
- [x] Mikrofon seviyesi, kullanılan giriş adı, metne çevirme ve duyulan metin görünür.
- [x] 23 Node, 3 Python, Electron smoke ve gerçek worklet/yapay mikrofon testi geçti.
- [x] Gerçek STT, düşük seviyeli Türkçe sentez örneğini doğru tanıdı.
- [ ] Fiziksel mikrofon, doğru Windows giriş aygıtı ve gerçek hoparlör barge-in kabulü.
Seslendirme kodu/modeli değiştirilmedi. CPU STT bu cihazda hâlâ yavaş; bu düzeltme
anlık STT performansı veya kusursuz yankı bastırma kabulü anlamına gelmiyor.

0.1.2 installer üretimi başarılı: dist/Umay Setup 0.1.2.exe, 494623604 bayt.
Asar renderer/index birebir eşleşti; paket sürümü 0.1.2 doğrulandı.

## [2026-11-04] Giriş düzeltmesi (sunucu)
- [x] Browser callback ulaşıyor, exchange başarı yanıtı gönderilmediği için zaman aşımı.
- [x] exchange metodunda @Res({passthrough:true}); dönen JSON artık Nest tarafından gönderiliyor.
- [x] Gerçek Nest/Fastify HTTP testi eski kodda FAIL, aday ve canlı imajda PASS.
- [x] Yalnız controller dekoratör farkı dağıtıldı; frontend healthy.
- [ ] Kullanıcının kurulu 0.1.2 ile gerçek hesap girişini yeniden doğrulaması.
Masaüstü paketi değişmedi; yeniden kurulum gerekmiyor.

## [2026-11-04] GPT benzeri bağlama ekranı
- [x] Nötr siyah-beyaz palet, tek ortalı onay kartı ve Umay/Veriüssü kimliği.
- [x] Aktif ad/e-posta; oturum yoksa giriş/kayıt; sekmeye dönüşte hesap yenileme.
- [x] Sistem temasına uyum ve kullanıcı açık/koyu tema seçimi.
- [x] 390px mobil ve masaüstü görsel kontrol; yatay taşma yok.
- [x] 30 Node testi; gerçek Nest/Fastify sayfa/asset/CSP/exchange/replay kontrolleri.
- [x] Sunucu aday/canlı imajı test edildi; frontend healthy; 10 canlı sınır kontrolü.
Aynı masaüstü sürümü yeni sayfayı kullanır; yeniden kurulum gerekmez.

## [2026-11-04] Logo / favicon
- [x] Sitedeki özgün V logosu ve VERİÜSSÜ. marka yazısı kullanıldı.
- [x] Bağlama/çıkış sayfalarında SVG favicon ve img-src self izni.
- [x] Açık/koyu/mobil görünüm, 30 Node ve 10 canlı kontrol başarılı; yayında.

## [2026-11-04] Masaüstü görsel dönüşüm — 0.2.0
- [x] Referansa uygun Umay kanat işareti, vektör küre, koyu/turkuaz kontrol merkezi.
- [x] Ayrı giriş/kayıt modları, tarayıcı bekleme/iptal ve hesap sonrası otomatik geçiş.
- [x] Kayıt niyeti browser authorize sayfasına taşınıyor; kayıt ana eylemi /register.
- [x] Sohbet, konuşma/klon/güncelleme ayarları ve hafıza mevcut işlevlere bağlı.
- [x] Gerçek CPU/RAM/disk ve model hazır durumu; uydurma görev/yüzde yok.
- [x] Dar pencerede geçmiş çekmecesi, açık/koyu tema, pencere kontrolleri.
- [x] 35 Node / 3 Python; gerçek Electron tasarım, smoke ve mikrofon testleri PASS.
- [x] Kayıt yönlendirmesi sunucuda yayında; aday/canlı HTTP ve 10 sınır kontrolü PASS.
Geliştirilmemiş ajan/otomasyon/dosya alanları “Yakında” olarak pasiftir.
Gerçek kullanıcı hesabıyla yeni giriş/kayıt kabulü ana cihazda denenmelidir.

## [2026-11-04] Canlı STT — 0.3.0
- [x] Kullanıcının gecikme önceliği kaydedildi; Seda balanced/accurate gerçek ölçümü.
- [x] Yerel, sabit revision'lı Seda/sherpa-onnx; 2 thread CPU/RAM'de kalıcı model.
- [x] Ayrı STT kuyruğu, 16kHz yakalama, 100ms kuyruklama; meşgulken kare atılmıyor.
- [x] Konuşurken partial, duraklamada final; elle düzenlenen/silinen taslak korunuyor.
- [x] Mikrofon yanıt boyunca açık; barge-in yalnız yanıtı iptal ediyor.
- [x] Çıkışta daha yüksek eşik + ön tampon, yankı azaltma ve eski olayları reddetme.
- [x] Eski STT güncellemesi, kaldırma, lisanslar ve kilitli runtime bağımlılıkları.
- [x] 44 Node, 5 Python; Electron UI/smoke/mikrofon/gerçek STT, paket eşleştirme PASS.
- [x] Windows 0.3.0 installer üretildi; paketlenmiş Python/worker gerçek STT PASS.
Fiziksel mikrofon/hoparlör aynı anda konuşma kabulü kullanıcı cihazında yapılmalıdır.

## [2026-11-04] 0.3.1 ses / mesaj regresyonu
- [x] Tanınmamış ses enerjisinin bekleyen yanıtı iptali kırmızı testle üretildi, düzeltildi.
- [x] Playback sonrası düşük seviyeli konuşmanın bastırılması üretildi, düzeltildi.
- [x] Tek kuyruk paketindeki endpoint'in sonraki sözü yutması üretildi, 20ms adım eklendi.
- [x] Başarısız run'ın eski yanıtı seslendirmesi engellendi; hata kodu korunuyor.
- [x] Gerçek native-import takılması traceback ile doğrulandı; ana thread'de sıralı
  SciPy / PyTorch / ONNX import'u ve model ilk yükleme kilidi eklendi.
- [x] Mevcut TTS/model dosyaları korunarak 50 Node / 7 Python PASS.
- [x] Gerçek Electron tam zincir testi PASS: iki mesaj, dinleme açık, ilk ses parçası
  yanıt metninden 243ms sonra; oynatım kaynağı 266ms sonra.
Sunucu sohbet API'si bu testte taklittir; mikrofon hattı, STT, gönderici ve TTS gerçektir.

Son incelemede yavaş HTTP iptali tamamlanmadan yeni sesli turun gönderilmesi de
kırmızı testle üretildi; yeni tur önceki sunucu iptalini bekliyor. 50 Node / 7 Python
PASS. Paketli Python soğuk eşzamanlı yükleme istekleri 11.711s içinde tamamlandı;
sıcak TTS ilk parça 110ms, 26 ses parçası PASS.

## [2026-11-04] Yanıtsız kalan model istekleri — 0.3.2
- [x] Canlı run durumu/süreleri ve gerçek sağlayıcı yanıt şekli okundu; sırlar çıktı verilmedi.
- [x] Geçmişle beam aracı isteği yeniden üretildi; boş cevap tekrarının kök nedeni bulundu.
- [x] Sınırlı araç devamı ve aynı sağlayıcı/model için kısa yetenek önbelleği eklendi.
- [x] Ayrı PostgreSQL + gerçek Nest/Fastify/worker testinde eski sürüm FAIL, aday PASS.
- [x] İlk tur 2 çağrıda yanıt, sonraki tur 1 çağrıda yanıt; gerçek sohbete kayıt PASS.
- [x] Soğuk speech cancel altında yazılı gönderim kırmızı/yeşil; hatalar sohbet içinde.
- [x] 55 Node, sunucuda 29 regresyon ve gerçek Electron sesli zincir PASS.
- [x] Windows 0.3.2 installer ve kaynak/sürüm eşleştirmesi; 478041146 byte.
- [x] Değişen sunucu modüllerinde TypeScript tanısı 0; üretim imajında başka
  modüllerin eksik development tiplerinden 88 tanı var, tüm proje typecheck PASS denmedi.
- [x] İki canlı worker healthy; yeni yardımcı modül yüklemesi PASS.
- [x] Canlı imajda ayrı DB HTTP regresyonu PASS; iki işçi healthy.
- [x] GitHub main: 15 dosya yerel Git blob SHA değerleriyle birebir doğrulandı.

## [2026-11-04] Anlaşılır uyarılar — 0.3.3
- [x] Ortak katalog: token yetersizliği, kullanım limiti, bekleyen işlem, oturum,
  bağlantı, zaman aşımı, model, özellik ve doğrulama hataları.
- [x] HTTP 409 sebebi kaybolmaz; bilinmeyen sunucu mesajları kullanıcıya yansıtılmaz.
- [x] Web terminal run ve gönderim hatası sohbet içinde görünür; role=alert.
- [x] Windows terminal run / POST hatası Türkçe uyarı; teknik kod görünmez.
- [x] 65 Node testi; gerçek Electron web gönderim/SSE hata akışı ve Windows IPC PASS.
- [x] Web açık masaüstü / koyu390px; Windows açık/koyu görsel kontrol PASS.
- [x] 0.3.3 installer üretildi; sürüm +6 runtime dosyası birebir eşleşti.
- [x] Frontend/chat UI yayında; healthy, 3 varlık hash eşleşmesi, ortam/port eşitliği.
- [x] Canlı10203 HTML/JS/CSS200 ve kimliksiz API401 doğrulandı.
- [x] GitHub main:23 dosya yerel Git blob SHA değerleriyle birebir doğrulandı.

## [2026-11-04] Türkçe okuma / noktalama — 0.3.4
- [x] Mevcut motorun sınırlı sıra sayısı bağlamları ve eksik TRT okunuşu yeniden üretildi.
- [x] TDK sayı/kısaltma/noktalama kaynakları incelendi; okuma ile sayısal değer ayrıldı.
- [x] speech/turkish_speech.py: Türkçe kısaltma, sıra sayısı, Markdown temizliği.
- [x] Sayısal tarih, saat, binlik, ondalık ve miktar cümle sonu regresyonları.
- [x] Cümle anlamını koruyan noktalama; üç nokta ve paragraf için ayrı kısa aralar.
- [x] Aynı worker speak yolu: yanıt ve önizleme, varsayılan/klon ses kimliği korunur.
- [x] İptalde model jeneratörü kapanır; sonraki cümle başlamaz, yeniden konuşma çalışır.
- [x] 44 Python +65 Node test; gerçek worker ses üretimi/iptal/yeniden konuşma.
- [x] Windows0.3.4 paket bütünlüğü; paket içindeki Python ile gerçek speak/iptal/yeniden konuşma.
- [x] GitHub main:14 dosya yerel Git blob SHA değerleriyle birebir doğrulandı.

## [2026-11-04] Klonlama doğallığı — 0.3.5
- [x] Üretici referans kesim şartı incelendi:3–5s, cümle bitimi değil sözcük arası.
- [x] Üç mevcut kayıtta ilk bölüm ölçüldü; birinde eski kesim uyarısı yeniden üretildi.
- [x] voice_cloning.py: sınırlı MP3 çözümü, aday aralık seçimi, sabit seviye düzenleme.
- [x] Özgün MP3 +hazırlanmış PCM WAV, benzersiz profil anahtarı, atomik kayıt/iptal.
- [x] Eski profil yükseltme, önbellekten seçim, kaldırmada yalnız ilgili profil dosyaları.
- [x] Oluşturunca doğrudan seçme, önizlemede aynı ses, kalıcı seçim ve kayıt önerileri.
- [x] 60 Python /67 Node testi; gerçek Electron klon ayarları/önizleme/hata kontrolleri.
- [x] Üç gerçek profilde eski/yeni ses örneği üretimi; özgün dosyalar hash olarak korundu.
- [x] Paket içindeki gerçek ses motoruyla profil/iptal kontrolleri; kurulum bütünlüğü.
- [x] GitHub main:16 dosya yerel Git blob SHA değerleriyle birebir doğrulandı.

## [2026-11-04] Sesin devamının kesilmesi — 0.3.6
- [x] Verilen tam cümle, varsayılan +üç klon: motor sonuna kadar WAV üretir.
- [x] Kurulu0.3.5 /yerel worker ve ses modüllerinin eşitliği doğrulandı.
- [x] Eski renderer'da gecikmeli/yüksek kendi sesinin stop üretmesi FAIL ile kanıtlandı.
- [x] Oynatma referansını kullanan yankı kontrolü; mikrofon ve çıktı örnekleme fazı ele alındı.
- [x] 75 Node testi; gerçek kullanıcının araya girişi ve Stop regresyonları PASS.
- [x] Gerçek Electron/WebAudio: önceki hata kontrolü, tam yanıt, sonraki yanıt, insan araya
  girişi ve iptalden sonraki tam yanıt PASS. Mikrofon girdisi yankı benzetimi, fiziksel cihaz değil.
- [x] 0.3.6 kurulum bütünlüğü: sürüm,3 uygulama varlığı,4 değişmeyen ses dosyası.
- [x] GitHub main:13 dosya yerel Git blob SHA değerleriyle birebir doğrulandı.

## [2026-11-05] Üç cihaz yeteneği — 0.4.0
- [x] Kaldığımız yerdeki81 Node testi yeniden çalıştırıldı; mevcut değişiklikler korundu.
- [x] Hesaba özel SQLite; not/ilişki/mesaj/işlem/dosya/şifreli hesap tabloları.
- [x] Yerel arşiv, geçmiş sayfalama, model bağlamı ve merkezi hafıza eşlemesi.
- [x] Hafıza araması, bağlantı grafiği, not düzenleme, dosya yolu ve özel hesap sayfaları.
- [x] Konum/saat, şehir seçimi, hava önbelleği, RSS/Atom/AFAD ve Windows uyarıları.
- [x] Windows ekran/UIAutomation/klavye/fare ve seçili modelle bilgisayar görevi.
- [x] Gerçek izole pencerede fare/Türkçe metin/Ctrl+A; gerçek Windows şifreleme.
- [x] Bağımsız kod incelemesi;6 önemli bulgu, yeniden üretim ve tek düzeltme geçişi.
- [x] 103 Node /60 Python test; gerçek mikrofon-STT-sohbet-TTS regresyonu.
- [x] Sunucu adayında gerçek HTTP/PostgreSQL ve normal sohbet regresyonu.
- [x] 10203 chat ve2 worker healthy; ortam/port ve3 modül hash eşitliği.
- [x] Windows0.4.0 kurulum/runtime/native yardımcı bütünlüğü; paketli gerçek giriş testi.
- [x] GitHub main:38 kaynak/doküman dosyası yerel Git blob SHA ile birebir doğrulandı.

## [2026-11-05] Model rolleri ve Windows kontrolü — 0.4.1
- [x] Mevcut 103 testle başlangıç kontrolü; yeni davranışlarda RED → GREEN.
- [x] Ayarlar / Modeller; iki model rolü, hesap ayrımı ve kalıcılık.
- [x] İki görev girişinde computer rolü; sohbet seçicisinde kaynak+kimlik eşlemesi.
- [x] Pencere odağı, hedefte yatay/dikey kaydırma, orta tık ve iki monitör koordinatları.
- [x] Sınırlı toparlanma, kısmi yazı koruması, native kuyruk ve durdurma temizliği.
- [x] Gerçek Windows iki geçici pencerede giriş, görev/gözlem döngüsü ve F8.
- [x] Bağımsız inceleme bulgularının testle düzeltilmesi; 119 uygulama /60 ses testi.
- [x] Gerçek mikrofon-STT-sohbet-TTS, mevcut masaüstü UI ve model rolü regresyonu.
- [x] Sunucu aday HTTP/DB testleri; planlayıcı overlay dağıtımı, chat10203 ve2worker healthy; ortam/port/eski modül hash kontrolü.
- [x] Windows0.4.1 installer; 33 paket dosyası, unpacked native yardımcı,4 ses modülü ve paket içi gerçek giriş/UI kontrolleri.
Detaylar ve dış model/Windows/çoklu monitör test sınırları computer-model-roles-verification.md içinde.

## [2026-11-05] Windows yönetici izni — 0.4.2
- [x] İzin gereksiniminde görev duraklama ve açık kullanıcı düğmesi.
- [x] Runas/UAC başlatıcı, pipe oturum anahtarı ve gerçek Windows yetki probe.
- [x] Ret/iptal/geç grant/hesap değişimi ve yardımcı kapanışı.
- [x] F8 bekleyen görevlerde korunur; kısmi giriş terminal hata olur.
- [x] Bağımsız inceleme ve3 önemli bulguya testli düzeltme.
- [x] 129 uygulama /60 ses testi; gerçek Windows pipe/protokol ve normal masaüstü giriş/UI testleri.
- [x] 0.4.2 installer ve paket içi giriş/arayüz/bütünlük kontrolleri.
- [x] Kullanıcı onaylı gerçek yönetici WinForms penceresi testi ve paket içi tekrarı geçti: hedef alan seçimi, tam Türkçe metin, yönetici tokenı ve helper sürecinin kapanması. Mevcut oturum zaten yönetici olduğundan standart kullanıcı UAC diyaloğu ayrıca doğrulanmış sayılmaz.

## [2026-11-05] Bilgisayar kontrolünü sohbet içine taşıma — 0.4.3
- [x] Bilgisayar sayfası/nav/form ve Bilgisayarda çalış kutusu kaldırıldı.
- [x] Aynı sohbet yanıtında görev devri; asli kullanıcı isteği ve gerçek sunucu mesajı doğrulaması; tek yürütme.
- [x] Aynı sohbette soru, sesli/yazılı yanıt, özel işlem onayı, Windows izin düğmesi ve sonuç.
- [x] Asıl sohbetin yerel arşivinde yanıt/sonuç; sunucu mesaj bağıyla doğru sıra.
- [x] Bağımsız incelemedeki2 önemli bulgu RED → GREEN;141 uygulama /60 ses testi.
- [x] Gerçek ses yakalama/STT/otomatik dispatch/TTS; dinleme açık.
- [x] Gerçek Windows giriş/F8; paket içinden giriş ve sohbet/ayarlar/hafıza/konum/tema regresyonları.
- [x] İzole HTTP/DB normal sohbet+handoff testleri;10203 chat ve2worker healthy; controller/ortam/port korundu.
- [x] Windows0.4.3 installer ve38 paket dosyası/native/4 ses modülü bütünlüğü.

## [2026-11-05] Sohbet komutlarının gerçek işlemlere dönüşmesi — 0.4.4

- [x] Kullanıcının son klasör konuşması ve kurulu0.4.3 kaynakları incelendi; boş run cihaz alanları ve frontend DTO400 hatası doğrulandı.
- [x] 10203 geçidinin yönlendirdiği gerçek frontend girişi düzeltildi; izole HTTP/DB RED→GREEN; port/ortam/mount/public varlık bütünlüğü ve4servis sağlığı doğrulandı.
- [x] Cihaz yeteneklerinin sessizce kaldırılması engellendi; kullanıcıya açık uyarı.
- [x] Eksik ekran kimliği, done/summary uyumluluğu, Windows kısayolları ve sınırlı geçersiz planner yanıtı tekrarı.
- [x] Bağımsız ve açık Desktop klasörü isteğinde salt okunur dosya sistemi sonkoşulu; tamamlanmadan başarı yok; birleşik görevler kapsam dışı.
- [x] 150 otomatik test; sohbet/soru/onay/izin/rol ve ayarlar/hafıza/tema regresyonları; gerçek STT→sohbet→görev→TTS akışı.
- [x] Gerçek Alfa1.2/Windows testinde `dosya` klasörü oluştu. Kaynak ve son paket, kontrollü sağlayıcı + gerçek Windows klavye girişleriyle ayrı yeni klasörler oluşturup doğrulanmış görev tamamladı.
- [x] 0.4.4 installer,39 kaynak dosyası/native/4 ses modülü bütünlüğü; bağımsız inceleme bulguları giderildi. Geçici test oturumu iptal edildi.
- [ ] Son dış model tekrarının tam geçişi: `TOKEN_USAGE_RECONCILIATION_REQUIRED` yeni çağrıyı engelledi. Uyarı gösteriliyor; muhasebe kayıtları elle değiştirilmedi. Ayrıntılar: `Docs/computer-ingress-fix.md`.

## [2026-11-05] Sesle genel bilgisayar kullanımı — 0.5.0

- [x] Uygulama adlarından bağımsız genel kontrol; mevcut normal sohbet ve ayrı model rolleri korunuyor.
- [x] Yerel sesli duraklat/devam/iptal, geç yanıt izolasyonu, native drain, onay kapsamının korunması, küçültülmüş pencerede mikrofon ve F8.
- [x] Son gerçek görev/uygulama bağlamı; PID/HWND bağlı salt okunur uzun iş takibi.
- [x] Süreli basılı tuş/fare, göreli fare; durdurma/zaman aşımında bırakma ve helper yeniden başlatma.
- [x] Gerçek kendi Windows test pencerelerinde iş takibi→sonraki bölüm, kaynak/paket girişleri; gerçek capture→Seda→yerel dur→keyup174ms, mikrofon açık.
- [x] 171 otomatik test,60 konuşma testi, mevcut sohbet/rol/izin/hafıza/tema/ses regresyonları;42 kaynak dosyalı0.5.0 paket bütünlüğü.
- [x] Immutable helper-only worker adayında izole HTTP/DB RED→GREEN; iki worker/front/10203 healthy, diğer modüller/varlıklar/ortam/port/mount korunuyor.
- [x] Bağımsız incelemedeki4 önemli/2 küçük bulgu giderildi; son inceleme temiz.
- [ ] Son dış-model kabulü: eski Alfa1.2 kullanım-mutabakatı kayıtları engelliyor. Kayıtlar/bakiye elle değiştirilmedi. Kapsam ve rapor: `Docs/full-computer-control-verification.md`.

## [2026-11-05] Sohbet ve konuşma düzeltmeleri — 0.5.1

- [x] Yerel arşiv ve gerçek sunucu sohbet/işlem kayıtlarını karşılaştır; gerçek başarısız görev devrini yeniden üret.
- [x] Geçici STT metninin yanıtı iptal etmesini engelle; kabul edilmiş çağrıyı muhasebe bitene kadar izleyip eski çıktıyı karantinaya al.
- [x] Güncel sohbet sürümü ve mesaj kimlikleriyle doğru yanıt; eksik yanıt için görünür hata; eski/geç sesin reddi.
- [x] Teknik planlayıcı arşivlerini otomatik sohbet hafızasından ayır; geçmiş kayıtlar ve normal insan tercihlerini koru.
- [x] Cihaz bağlamını belge bağlamından ayır; masaüstü işlev aktarımı ve eski gözlemleri tekrar göndermeyen planlayıcı.
- [x] Eski frontend yürütücüsünü kapat; iki güncel worker, aynı HTTP hizmeti/portlar ve kalıcı dağıtım overlay'i.
- [x] 184 uygulama ve60 konuşma testi; gerçek capture→STT→sohbet→TTS; kaynak/paket Windows giriş/odak/dur/F8 regresyonu; paket Python ile gerçek klon TTS.
- [x] Gerçek Veriüssü modelleriyle gerçek Windows test penceresine metin yazılması ve görünür sonucun doğrulanması.
- [x] 0.5.1 installer ve kaynak/native/konuşma/runtime bütünlüğü. Son performans ve dağıtım sonuçları `Docs/chat-voice-hotfix.md` içinde tutulur.


## [2026-11-06] İşlem ilerlemesi ve deneyim — 0.5.2

- [x] Yerel arşiv ve sunucudan 16 tekrar yazma olayını doğrula; değişen görüntü/alan kimliğiyle tekrar regresyonu.
- [x] Gerçek UIA odağı, derinlik/üst-belge bilgisi ve odak korumalı değiştir/yaz/gönder.
- [x] Sohbetin kısa yaklaşım planını gerçek bilgisayar rolüne aktar; geçerli işlem şeması, eski run yanıtını reddetme.
- [x] Hesaba ait kalıcı deneyim, adım kontrol noktaları, kanıt düzeyleri, hata hatırlama ve sonraki göreve kaynaklı geri çağırma.
- [x] Gerçek tarayıcı adresi için tek gezinme işlemi, web formu ayrımı, belge URL'siyle geri okuma; gerekli durumda görsele dönüş.
- [x] 197 uygulama +60 Python testi; gerçek ses zinciri ve Dur/F8; gerçek Chrome ve seçili bulut modelleriyle Netflix sayfası/adres sonkoşulu.
- [x] İzole HTTP/PostgreSQL kabulü sonrası iki worker; mevcut portlar/ortam/mount'lar ve model rolleri korundu.
- [x] 0.5.2 final kurulumunun 44 kaynak/native/konuşma karşılaştırması, paket üzerinden gerçek Windows testi, dağıtılan Python ile STT karşılaştırması, installer SHA512/uzunluğu ve son rapor.
- [ ] Seçili sağlayıcılarda anlık denebilecek model yanıtı ve geniş çok uygulamalı performans kabulü; 29–31 saniyelik tek URL testi bu ölçütü karşılamıyor.

## [2026-11-06] Chrome MCP — 0.6.0

- [x] Resmî Chrome DevTools MCP 1.12.0 ve SDK 1.32.2'yi sabitle; Node/npm istemeyen paket çalışma ortamı.
- [x] Hesaba özel kalıcı görünür Chrome profili; Ayarlar/Modeller içinde mevcut Chrome bağlantısı ve bağlantı denetimi.
- [x] Aynı yazılı/sesli sohbetten gerçek MCP araçları; web/masaüstü devri, güncel öğe/sekme doğrulaması, sayfalı sonuçlar ve tekrar yazma koruması.
- [x] Durdur/hesap/kapanış yaşam döngüsü ve MCP yardımcısının çıkışı; mevcut izin ve işlem deneyimi kayıtları.
- [x] 211 Node +60 Python testi; gerçek MCP/Chrome, ajan durdurma ve Electron ayarlar testleri.
- [x] İzole sunucu HTTP/PostgreSQL kabulü; iki worker'a tarayıcıya özel planlayıcı ve yetenek bazlı şema. Mevcut port/ortam/model rolleri korunur.
- [x] Gerçek seçili Alfa1.2/Qwen3-VL ile Netflix ve form doldur/tıkla/geri oku. Windows giriş erişimi sıfır; toplam süreler 25,0/34,7 saniye.
- [x] Son pakette 47 kaynak, native/konuşma ve 361 MCP dosyasının doğrulanması; çalışma klasörü dışında gerçek Umay.exe ile MCP/Chrome kabulü.
- [x] Gerçek STT→sohbet→görev devri→TTS regresyonu; mikrofon açık, kontrollü yanıttan ilk ses 128 ms / çalma 205 ms.
- [x] Son kaynak SHA256/izole HTTP/DB denetimi; iki worker ve 10203 sağlıklı, diğer API/public dosyaları aynı. Geçici doğrulama oturumu iptal edildi.
- [x] 0.6.0 installer, blockmap, SHA512/uzunluk denetimi ve yerel teslim; ayrıntılar `Docs/chrome-mcp.md` içinde.
- [x] Kaynak ve doğrulama belgelerinin GitHub teslimi: `codex/computer-model-roles` dalı.

## [2026-11-06] Chrome kapat/aç regresyonu — 0.6.1

- [x] Son iki Netflix isteğinde ilk gözlem hatasını doğrula; kurulu MCP'den gerçek ECONNREFUSED nedenini al.
- [x] Önce hata veren birim ve gerçek Chrome kapat/aç testi; sonra salt okunur uç nokta yenilemesi, eski gözlemi reddetme ve işlemi tekrar etmeme.
- [x] Başlıklı sekme listesinden gerçek URL; 215 Node testi.
- [x] Gerçek Chrome/ajan ve seçili bulut modelleriyle kapalı Chrome'u açıp Netflix başlık/adresini doğrula; geçici oturumu iptal et.
- [x] Son 0.6.1 paketinin kaynak/MCP bütünlüğü; proje dışında gerçek exe ile Chrome kapat/yeniden bağlan/form ve yardımcı çıkışı.
- [x] Installer SHA512/boyut kaydı ve GitHub teslimi (`codex/computer-model-roles`); sonuçlar `Docs/chrome-reconnect-fix.md` içinde.

## [2026-11-06] Kontrol performansı — 0.6.2

- [x] Gerçek model/işlem kayıtlarından gecikme ayrımı; görevlerde gözlem/model/giriş ve görüntü sayaçları.
- [x] Ortak kesin istek ayrıştırıcısı; yeni istemcide sıfır sağlayıcı turlu site açma devri ve gerçek sayfa başlığı/adresiyle sonuç.
- [x] Genel görevler için daha kısa yönlendirme; planlayıcıda yalnız hafıza gizlilik sürümü; metin önceliği ve görsele dönüş.
- [x] İnceleme ve canlı testte bulunan kısmi gezinme geri dönüşü, iç içe işlem ve ön plan kimliği regresyonları; 227 Node testi.
- [x] İzole HTTP/PostgreSQL, iki sağlıklı işçi/10203; eski istemci, merkezî kayıt ve sıfır sağlayıcı/token kanıtı.
- [x] Gerçek Netflix: devir 614 ms / toplam 9.283 ms; genel form: 28.741 ms. Yerel soğuk/açık/kapalı Chrome, gerçek Windows/F8 ve ses regresyonları. Bulut masaüstü testindeki odak sınırı ayrıca kayıtlıdır.
- [x] Son 49 kaynak/native/konuşma ve 361 MCP dosyası eşleşmesi; proje dışında gerçek exe ile Chrome yenileme ve sıfır planlayıcı turlu gezinme.
- [x] Son installer SHA512/boyut ve GitHub teslimi (`codex/computer-model-roles`); `Docs/control-performance.md` içinde kayıtlıdır.

## [2026-11-06] Örneklerden bağımsız genel kontrol kapsamı

- [x] Kullanıcının düzeltmesini bağlayıcı kapsam olarak kaydet: site/uygulama/dosya adları sınır değildir.
- [x] Mevcut kontrol altyapısıyla eksikleri ayır; 0.6.2'nin basit testlerini genel başarı gibi sunma.
- [x] Genel ve birleşik görev, dosya/aygıt, uygulama kurulumu/yönetimi, yönetici ve p50/p95 performans kabul matrisini yaz: `Docs/general-assistant-scope.md`.
- [ ] Görev güvenilirliği → genel araç sözleşmesi/işlem grupları → dosya/uygulama araçları → çapraz yürütücü kabulü → kullanıcı yetkilendirmeli yönetici aracısı → geniş performans kabulü sırasını uygula.

## [2026-11-06] Genel yürütücü — 0.7.0

- [x] 21 genel dosya/uygulama/paket/süreç aracı; kaynak koruma, sürüm, kısmi işlem ve sahiplik.
- [x] Sohbetten genel görev devri; sistem, Chrome MCP ve Windows arasında aynı asıl istek/iptal nesli; sonraki mesajda gerçek dosya yollarını hatırlama.
- [x] Kullanıcı tarafından yetkilendirilmiş yönetici oturumunu koruma, gerektiğinde yüksek yetkili worker, hesap değişimi/çıkış/revoke.
- [x] Durdurma doğrulanmadan başarı göstermeme; belirsiz durdurmada yeni görev/devamı engelleme ve tekrar deneme.
- [x] Sunucuda izole HTTP/DB, genel sözleşmeler, ayrı operatör kotası; iki worker/frontend ve 10203 sağlık/bütünlük.
- [x] 316 otomatik test; gerçek çok adımlı web/dosya/süreç, test uygulaması kur/aç/kullan/kaldır, gerçek modellerle dosya ve devam, Windows/F8, STT/TTS, ayarlar.
- [x] Son kaynaklarla 57 uygulama/4 konuşma modülü ve 361 MCP dosyası; gerçek paketlenmiş Umay.exe ile ASAR yönetici worker ve Chrome yeniden bağlantı.
- [x] Alfa1.2-vision kimliğini açık doğrulayarak iki ayrı gerçek sohbet/dosya/devam/Chrome formu/POST/dosya zinciri; kullanıcının izniyle bu cihazın bilgisayar rolünü atama.
- [x] 7 Kasım son gerçek Windows odak/girdi/arka plan izleme/F8; gerçek Alfa1.2/Alfa1.2-vision ile sohbetten sahip olunan Windows alanına click/text ve içerik doğrulama.
- [x] 0.7.0 test installer'ı, SHA256/SHA512/boyut/blockmap ve son kaynak eşleşmesi; ayrıntılar teslim kaydında.
- [ ] Geniş gerçek uygulama/aygıt/çok monitör/ilk UAC ve p50/p95 kabulü. Bu kutu birkaç başarılı örnekle kapatılmaz.

Ölçümler, başarısız denemeler ve teslim: `Docs/general-operator-verification.md`.

## [2026-11-07] Obsidian ve tutarlı çalışma bağlamı

- [x] Mevcut hafıza, özel kayıt, oturum, yürütücü ve ayar entegrasyonlarını incele; kurulu Obsidian vault'unu salt okunur keşfet.
- [x] Gerçek arama/sıra kayıtlarında tekrarlı alan doldurma, click döngüsü ve kullanıcı durdurmasını saptayarak başarıdan ayır.
- [x] Kapsam, yaklaşım, sır kullanımı, eşitleme/çatışma, aktif hedef, uzun iş ve kabul matrisini taslakta yaz: `Docs/obsidian-continuity-design.md`.
- [x] Taslağı bağımsız planlanabilirlik incelemesinden geçir; hesap/cihaz sahipliği, sır kullanım sonrası gözlem, görev/OTP bağlama ve silme/yeniden başlatma sınırlarını netleştir.
- [ ] Kullanıcı tasarım kararını ve kasa taşınabilirliği tercihini netleştir.
- [ ] Onaylanan tasarımdan kesin uygulama/test planı çıkar; parçaları sırayla uygula ve gerçek kabulünü yap.

Bu bölüm yeni özelliklerin uygulanmış olduğu anlamına gelmez; mevcut 0.7.0 kurulum paketi değişmedi.
