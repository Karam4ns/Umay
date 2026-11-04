# Test Kayıtları

## Adım 1 — Docs yapısının oluşturulması

### Yapılan
- `Docs/plan.md`, `Docs/walkthrought.md`, `Docs/test.md`, `Docs/chat.md`, `Docs/terminal.md` oluşturuldu.

### Test
- Dosyaların varlığı doğrulandı (`Get-ChildItem`).

### Sonuç
Başarılı.

### Tasarım Referansı
- Yok (henüz tasarım aşamasına geçilmedi).

## [2026-11-03] P0 — Plan ve yol haritası doğrulaması

### Değişiklik

Docs/plan.md ve Docs/walkthrought.md kullanıcının Windows/Türkçe sesli sohbet
kapsamına göre güncellendi. Ürün kodu değiştirilmedi.

### Doğrulama

Terminalde Python standart kütüphanesiyle iki Markdown dosyası okundu;
başlık, kapsam, bağlantı ve çalışma dizini kontrolleri yapıldı. Çıkış kodu: 0.

- PASS plan_adimlari: A0–A11 başlıklarının tamamı plan dosyasında.
- PASS yol_haritasi_adimlari: A0–A11 kontrol listeleri ilerleme dosyasında.
- PASS kapsam: Türkçe, 50 MB bayt önerisi, konuşma ayarları, veriussu.com,
  sunucu.txt, açık/koyu, yerel DB sınırı ve p95 ölçümü yer alıyor.
- PASS sonraya_birakilan_isler: SSH, nihai tasarım ve mobil sonraki fazlarda.
- PASS gercek_durum: Uygulama başlamadı, indirme yok ve renkler onaylı değil.
- PASS yerel_baglantilar: Dosyalar arasındaki Markdown bağlantıları mevcut dosyalara gidiyor.
- PASS urun_kodu_yok: src/package.json/pyproject.toml/Cargo.toml oluşturulmadı.

Plan 281 satır; yol haritası 154 satır. Gereksinimler ayrıca adım/kabul koşullarıyla
karşılaştırıldı. Donanım/teknoloji kararları açıkça A0'a bırakıldı.

### Sınır

Bu bir doküman kontrolüdür. Ses kalitesi, gecikme, Windows paketleme, klonlama ve
sunucu erişimi test edilmedi; hiçbir uygulama fazı başarılı olarak işaretlenmedi.
Hız değerleri ve motor adayları onaylanmamış öneridir. Nihai tasarım ertelendi.

## [2026-11-03] P0 — 4 GB hedef güncellemesi
Plan ve yol haritasına hafif model/4 GB hedefi, STT deneme profili ve gerçek cihaz
kabul ölçümleri eklendi. Python ile 5 doküman kontrolü PASS, çıkış kodu 0:
4gb_hedefi, profil_oneri, tts_belirsizligi, olcum, kod_yok.
Bu doküman doğrulamasıdır. Donanım benchmark'ı veya STT/TTS testi yapılmadı.

## [2026-11-03] P0 — Türkçe model karar güncellemesi
Doküman kontrolü Python ile çalıştırıldı (çıkış 0): Türkçe kalite ilkesi,
large-v3-turbo/Pocket/Chatterbox adayları, geliştirici ölçümü ayrımı, yol haritası
tutarlılığı ve ürün kodunun yokluğu PASS. Gerçek model/hız/kalite testi yapılmadı.

## [2026-11-03] P0 — Donanım/bellek/barge-in plan doğrulaması
Python doküman kontrolü çıkış 0; 6 PASS: donanım ayrımı, kalıcı bellek,
oynatım referanslı AEC/barge-in, zorunlu kabul, ek test senaryoları, ürün kodu yok.
Gerçek GPU/CPU seçimi, bellek kullanımı veya yankı giderme henüz çalıştırılmadı.
Gelecek kabul: 20 turda yeniden yükleme yok; yalnız Umay sesi 20 örnekte hedef 0
yanlış kesilme; 20 çift konuşma örneğinde algılama gecikmesi ve ≤200 ms iptal hedefi.

## [2026-11-03] P0 — Kullanıcı verisi ve hafıza planı
Python doküman doğrulaması çıkış 0, 5 PASS: A10.1–A10.4 alt adımları iki belgede;
model/sohbet/hafıza kapsamı; oturum ve hesap izolasyonu; endpoint/kolonların
varsayılmaması; ürün kodunun olmaması. Gerçek API veya hafıza testi yapılmadı.

## [2026-11-03] P0 — Windows dağıtım/oturum kapsam kontrolü
Python kontrolü çıkış 0; 7 PASS: Windows-only, dağıtım adresi/installer,
güvenli update/manifest yayını, veri koruma, kalıcı oturum/yenileme,
yol haritası A9.1/A10.5 eşleşmesi ve ürün kodu yok.
Installer, imzalama, update feed, sunucu oturumu veya restart testi yapılmadı.

## [2026-11-03] Uygulama doğrulaması — Windows geliştirme sürümü

- npm test: 10/10 PASS. İptal edilen turun sesi, eşzamanlı gönderim, geç STT
  sonucu ve askıda AudioContext/decoder sonrasında durdurma regresyonları dahil.
- .venv/Scripts/python.exe -m pytest tests/test_worker.py -q: 3/3 PASS.
  Paket kaldırmada profil koruma, eski kuyruk işi ve stdout yönlendirmesinde protokol.
- Electron smoke: gerçek Electron penceresi açıldı, izole preload, CSP, ekran gezinmesi
  ve iki konuşma paketi kontrolü doğrulandı; ekran görüntüsü yerel .superpowers alanında.
- node --check: main ve renderer sözdizimi geçerli. Python compileall başarılı.
- runtime/python.exe ile torch, ctranslate2 ve pocket_tts_turkish import testi PASS.
- STT ve TTS gerçekten indirildi/CPU'da yüklendi. Türkçe TTS → STT turunda metin doğru.
- 3 sıcak sentetik tur (4,39 sn ses): TTS 2,571/3,360/3,778 sn;
  STT 19,280/37,146/19,461 sn. Installer sıkıştırması aynı cihazda eşzamanlıydı;
  bu rakamlar kontrollü p50/p95 veya gerçek mikrofon ölçümü değildir. Hız hedefi geçmedi.
- Mevcut site auth/chat/model API'leri oturumsuz istekte 401 dönüyor. SSH ile kaynak
  sözleşmeleri incelendi; kullanıcı kimliği taklit edilmedi, canlı DB değiştirilmedi.
- Bağımsız kod incelemesinin 5 bulgusu düzeltildi; renderer regresyonları reviewer tarafından eklendi.
- npm audit --omit=dev: 0 bulgu. Tüm bağımlılıklarda 15 moderate build-tool bulgusu var;
  önerilen eski electron-builder sürümüne körlemesine downgrade yapılmadı.
- NSIS ilk test build'i üretildi (~356 MB); son kaynak düzeltmeleriyle yeniden build sürüyor.
- Gerçek login, 4 GB GPU, AMD hızlandırma, hoparlör AEC/20 tur, klon benzerliği,
  desktop refresh oturumu ve vN→vN+1 update kabulü henüz yapılmadı.

## [2026-11-03] Son regresyon ve klon testi
npm test: 11 PASS; Python worker testleri: 3 PASS. Hesap çıkışından sonra geç gelen
eski sohbet detayının gösterilmesini önleyen ek test dahil. Electron smoke yeniden PASS.
Sentetik olarak üretilmiş Türkçe sesi gerçek MP3'e kodlayıp klon oluşturma, profil seçme
ve silme denendi: PASS. Bu sonuç gerçek kişinin klon benzerliğini doğrulamaz.
GitHub'da kaynak dosyaları mevcut. Workflow yoluna yazma 404 ile reddedildi;
şablon scripts/windows-workflow.yml olarak yüklendi. Actions/CI çalıştı denmez.

## [2026-11-03] Son Windows paketi
Son kaynaklarla NSIS installer üretildi: dist/Umay Setup 0.1.0.exe, 357193787 bayt.
SHA256: 9E3DEFA9103EFC7EDA06FC2303E0F602C93DCE406FFBCA902D6263D071753258.
Paketin app.asar renderer içeriği ve speech/worker.py son kaynaklarla birebir eşleşiyor.
Paketlenmiş runtime/python.exe üzerinden gerçek worker status protokolü çalıştı.
11 Node / 3 Python / Electron smoke sonuçları yukarıda; temiz cihaz kurulumu henüz denenmedi.

## [2026-11-03] İmzalı derleme önkoşulu
npm test: 12 PASS. Yeni test, imzalama girdisi yokken signed build'in açık hata ile
durmasını doğruluyor. node --check scripts/build-signed.cjs PASS.
Windows sertifika depolarında CodeSigning sertifikası ve projede PFX/P12 bulunamadı.
Mevcut installer Get-AuthenticodeSignature: NotSigned. Gerçek imzalama yapılmadı.

## [2026-11-03] Varsayılan tarayıcı — 0.1.1
npm test: 19/19 PASS. Gerçek loopback HTTP callback, yanlış state/PKCE/URI,
expiry, eşzamanlı giriş, listener açılmadan iptal ve geç token iptali kontrolleri dahil.
Python worker: 3/3 PASS. Electron gerçek açılış/IPC/ayar gezinmesi yeniden PASS.
Sunucu Docker build içindeki TypeScript derlemesi başarılı. Başlangıçta mevcut
user-memory.controller.ts layers.notes nullable hatası çıktı; yedeklenip tür-only !
bildirimi eklendi. Canlı imaj bu dosyayı içermiyor; yalnız yeni auth modülü katmanı var.
Frontend yeniden oluşturuldu; healthy. 9 canlı kontrol PASS: authorize 200, kötü URI 400,
oturumsuz authorize 401, yabancı origin 400, bozuk exchange 401, logout sayfası 200,
yabancı origin logout 403, mevcut auth/me 401, JS endpoint 200/sözdizimi geçerli.
Gerçek hesaba otomatik giriş yapılmadı; kullanıcıyla manuel uçtan uca kabul bekleniyor.
NSIS 0.1.1 installer üretildi: 494622999 bayt, imzasız. Paketteki main/browser-auth/
renderer/index dosyaları kaynaklarla birebir karşılaştırıldı: hepsi eşleşiyor.

## [2026-11-04] Mikrofon / 0.1.2 doğrulaması
Önce kırmızı: .004 RMS ses sonrası sessizlik STT çağrısı üretmiyordu; ikinci worklet
kaydı açılışı bozuyordu. Her iki regresyon düzeltme sonrası geçti.
Çıkış sırasında bekleyen mikrofon izninin geç dönmesi testi de önce başarısızdı;
nesil kontrolü sonrası geç stream durduruluyor ve dinleme yeniden açılmıyor.
Son npm test: 23/23 PASS; pytest tests/test_worker.py: 3/3 PASS.
Electron smoke PASS. tests/electron-microphone.cjs gerçek Chromium izin/worklet/
16 kHz PCM hattını yapay WAV ile yürüttü; STT isteği, mesaj iletimi ve kapat/aç PASS.
Bu testte model/API taklidi var; fiziksel mikrofon veya Türkçe tanıma testi değildir.
Ayrı gerçek worker kontrolü: sentezlenmiş Türkçe ses .004 RMS'e indirildi; mevcut
Whisper turbo + vad_filter=True yolu “Merhaba ben Umay. Bugün hava nasıl?” tanıdı.
Bu cihaz CPU ölçümü: STT 49.31 sn. Gerçek konuşma doğruluğu/genel hız garantisi değildir.
Tam testte eski auth testindeki sabit 20 ms bekleme yoğun yükte başarısız oldu;
ürün auth kodu değişmeden test exchange başlangıcını bekleyecek şekilde düzeltildi.

0.1.2 installer üretimi başarılı: dist/Umay Setup 0.1.2.exe, 494623604 bayt.
Asar renderer/index birebir eşleşti; paket sürümü 0.1.2 doğrulandı.

## [2026-11-04] Gerçek HTTP exchange regresyonu
Kullanıcı tarayıcıda “Giriş aktarılamadı” gördü. Kurulu 0.1.2 main/browser-auth
kaynakla eşleşti. Electron 45 içinden yetkisiz exchange erişimi 401 INVALID_GRANT;
ağ/TLS erişimi çalışıyor. Sunucu controller doğrudan çağrıldığında geçiyordu,
ancak bu test Nest yanıt yaşam döngüsünü kapsamıyordu.
Yeni tests/server-auth-http.cjs izole Nest/Fastify örneği ve sahte DB kullanır;
gerçek kullanıcıya giriş yapmaz. Eski controller 5 sn'de HTTP yanıtı üretmeyip FAIL.
@Res({passthrough:true}) sonrası authorize HTTP yanıtı, exchange token/expiry/no-store
ve tek kullanımlık kod tekrarı 401 kontrolleri aday ve canlı imajda PASS.
23 Node testi PASS. Dokuz canlı yetkisiz/sınır kontrolü PASS.
Frontend healthy; gerçek hesap kabulü kullanıcıya bırakıldı.

## [2026-11-04] Hesap bağlama sayfası
İlk test çalışması yeni view modülü eksik olduğundan FAIL; uygulama sonrası 7 yeni
sayfa/client testi PASS: dış assetler, tema/responsive CSS, güvenilmeyen hesap adının
textContent ile yazılması, açık onay, oturumsuzluk, izinli callback, ağ hatası,
geç profil yanıtının atılması ve çıkış tamamlanması. Toplam npm test: 30/30 PASS.
Gerçek Electron görsel fixture'ı örnek Deniz Yılmaz / deniz@example.com hesabı kullanır;
masaüstü açık/koyu, 390px mobil ve oturumsuz mobil görüntüleri .superpowers altında.
Düğmeler/oturum durumu ve yatay taşma kontrolleri PASS. Gerçek hesap verisi kullanılmadı.
Derlenmiş aday ve canlı sunucuda izole Nest/Fastify sayfa/CSS/JS/CSP ve başarılı
exchange/tekrar 401 testi PASS. 10 canlı sınır kontrolü PASS. Canlı CSS/JS içeriği
kaynak sabitleriyle birebir karşılaştırıldı: eşleşiyor. Gerçek kullanıcı hesabıyla
onay, önceki kabul maddesi olarak ayrıca kullanıcı tarafından doğrulanmalıdır.

## [2026-11-04] Marka varlıkları
Özgün logo apps/api/public/home.html içindeki V path'lerinden; favicon mevcut
/favicon.svg?v=2 adresinden alındı. Açık/koyu/mobil Electron kontrolü PASS; Node 30 PASS.
Aday ve canlı Nest/Fastify HTTP regresyonu PASS; canlı sınırlar 10 PASS.
Bağlama ve çıkış HTML'inde resmi logo/favicon ve img-src self başlığı doğrulandı;
favicon HTTP 200 image/svg+xml ve özgün V içeriği PASS.

## [2026-11-04] Desktop 0.2.0 doğrulaması
Önce kırmızı: register entry taşınmıyordu, USER geçmiş mesajı yanlış etiketleniyordu,
eski başarısız hesap isteği ve bekleyen hesap temizliği yeni oturum durumunu eziyordu.
Regresyonlar düzeltildi; npm test son çalışması 35/35 PASS. Python 3/3 PASS.
tests/desktop-ui.cjs gerçek Electron/preload ile sahte API hesabı kullanır: giriş/kayıt,
register IPC, hesap kapısı, ana sayfa, ayar paketleri, sohbet yanıtı, temalar, 1024px
düzen/geçmiş çekmecesi ve çıkış PASS. Önizlemelerde Deniz Yılmaz örnek hesabı kullanılır.
Görseller .superpowers/desktop-{login,register,home,chat,settings,light,compact}.png.
Electron smoke ve yapay mikrofon → gerçek worklet → STT isteği hattı PASS.
Bu testler gerçek kullanıcı kimlik doğrulaması veya fiziksel mikrofon kabulü değildir.
Sunucu aday/canlı Nest/Fastify HTTP regresyonu PASS; dış sınırlar 10 PASS;
entry=register canlı HTML ana düğmesi /register doğrulandı. Frontend healthy.
Vektör işaretinden Windows PNG/ICO dışa aktarımı prebuild adımında PASS.
Installer build ve paket/kaynak eşleştirmesi son düzeltme sonrasında yeniden doğrulanır.

Son 0.2.0 installer üretildi; asar sürümü ve 14 kaynak/asset dosyası birebir eşleşti.
İmzalama önceki kullanıcı kararıyla ertelenmiş durumda.

## [2026-11-04] 0.3.0 canlı konuşma kanıtları
Kök neden: tüm cümleyi sessizlikten sonra tanıma; transcribing sırasında gelen
kareleri atma; STT/TTS'nin aynı executor'da birbirini beklemesi.
Önce kırmızı testlerle partial/final, meşgulken ses koruma, geç nesli reddetme,
kuyruk taşması, elle silinen metin, Stop taslağı ve yavaş reset altında iptal üretildi.
Son npm test 44/44 PASS; uv run ile Python 5/5 PASS.
Gerçek Electron: UI, smoke, 16kHz worklet mikrofon/yeniden açma PASS.
Gerçek Seda + gerçek worker + Electron yakalama: ilk partial 1517ms, ilk final
7048ms, mikrofon kapatılmadan 2 konuşma, yanıtı kesme sonrası listening=true PASS.
Hesap ve sohbet gönderimi taklit, ses kaynağı kamuya açık FLEURS Türkçe dev kaydı.
Tek örnek doğruluk garantisi değildir; fiziksel akustik geri beslemeyi kanıtlamaz.
CPU benchmark: 7.24s ses, balanced toplam hesaplama 1.062s, 100ms paket p95 41.3ms;
accurate 2.426s, aynı final. Balanced seçildi. Kaynaklar live-speech.md/NOTICE.txt.
Runtime yeniden hazırlandı; faster-whisper/ctranslate2 prod bağımlılıklarından çıktı.
Paketli Python ile mevcut TTS gerçek sentez 26 ses parçası PASS; motor/ses korunuyor.
0.3.0 installer 478039831 byte. Asar sürümü + 7 değişen uygulama dosyası + 5 speech
kaynağı birebir eşleşti. Installer içindeki Python + worker + gerçek model: 13 partial
ve doğru nihai cümle PASS. İmza önceki kullanıcı kararıyla ertelendi.

## [2026-11-04] 0.3.1 doğrulama
Önce FAIL: yalnız enerjiyle run iptali, playback sonrası sessiz konuşmanın görünmemesi,
FAILED run için eski cevabın seslenmesi, aynı pakette ikinci utterance kaybı.
Bunlar düzeltildi. Doğrudan selamlamada Umay adının yanlış yazımı ayrıca sınandı.
Son Node 50/50 PASS; Python 7/7 PASS.
TTS sıcak motor ölçümü (sentetik 3 Türkçe komut): ilk parça 144/159/165ms.
Seda accurate ikinci geçişi aynı örneklerde düzeltme getirmeden gecikmeyi artırdı;
motor değiştirilmedi. Selamlamadaki Umay adının yazımı dar bağlamda düzeltilir.
Gerçek soğuk worker: ONNX Runtime ve SciPy BLAS create_module içinde ayrı executor
thread'lerinde takılma; 20s faulthandler traceback ve 36s zaman aşımı ile doğrulandı.
Yalnız model kilidi yeterli olmadı. Native import'lar ana thread'e alınca gerçek
Electron tam zinciri geçti. Yanıt metninden ilk ses parçasına 243ms, oynatma kaynağına
266ms; 2 mesaj, listening=true. tests/electron-conversation.cjs pencereyi gizler,
sahte hesap/API ve kamuya açık FLEURS kaydı kullanır; gerçek getUserMedia/worklet,
Seda, renderer send, Pocket TTS, ses çözme/oynatma hattı çalışır.
Gerçek kullanıcının fiziksel mikrofon kalitesi ve hoparlör double-talk kabulü değildir.
Gerçek STT art arda iki tur testi de 1590ms partial / 7026ms final ile PASS.

Son incelemede yavaş HTTP iptali tamamlanmadan yeni sesli turun gönderilmesi de
kırmızı testle üretildi; yeni tur önceki sunucu iptalini bekliyor. 50 Node / 7 Python
PASS. Paketli Python soğuk eşzamanlı yükleme istekleri 11.711s içinde tamamlandı;
sıcak TTS ilk parça 110ms, 26 ses parçası PASS.

Run ID henüz dönmeyen ilk /messages POST'u sırasında söz kesme de FAIL üretildi.
Sunucu yazımları ve stale run iptali tek gönderim kuyruğuna alındı; sonraki POST
önceki yazım ve iptalin bitmesini bekler. Ek regresyonla Node 50 PASS.

Son 0.3.1 paketi üretildi: 478040745 byte; asar sürümü ve tüm değişen UI/speech
kaynakları son commit ile birebir eşleşti. Installer SHA256:
95d846aa1f559c37d005ca62721ebb3e730b2c6f9defba7c80180a63514ceb51.
Son tam zincir tekrarı: ilk ses parçası 196ms, oynatım kaynağı 220ms, 2 mesaj,
listening=true, temiz kapanış PASS. GitHub main üzerinde 16 kaynak dosyası yerel
Git blob SHA değerleriyle birebir doğrulandı.
