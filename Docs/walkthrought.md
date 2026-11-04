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
- [ ] GitHub son kontrol.
