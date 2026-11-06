# Umay — Windows

Türkçe sesli asistan geliştirme sürümü. Fütüristik kontrol merkezi ve canlı Türkçe
konuşma akışı içerir.

## Genel görev yürütücüsü — 0.7.0

Sohbetten verilen işler genel dosya, uygulama, paket ve süreç araçlarıyla; Chrome MCP ve Windows arayüzü arasında geçiş yaparak yürütülür. Son işlem yolları ve sonuçları sonraki yönlendirmelerde kullanılır. İlk Windows yönetici onayından sonra yetkili yardımcı Umay oturumunda tutulabilir; Ayarlar → Modeller üzerinden kapatılır. Durdurma doğrulanmazsa yeni işler engellenir ve hata gösterilir.

Gerçek test sonuçları ve açık sınırlar: [genel yürütücü doğrulaması](Docs/general-operator-verification.md). Her uygulama/site için kusursuzluk veya sabit hız garantisi yoktur.

## Geliştirme

Windows, Node.js 24 LTS ve uv gerektirir. Son kullanıcının Python kurmasına gerek
kalmaması için yayın paketi Python çalışma zamanını içerir.

```powershell
npm ci
node node_modules/electron/install.js
uv venv --python 3.12 .venv
uv pip sync --python .venv/Scripts/python.exe speech/requirements-lock.txt
npm test
uv run --no-project --python .venv/Scripts/python.exe --with pytest python -m pytest tests/test_worker.py tests/test_live_stt.py -q
npm start
```

## Windows kurulum paketi

```powershell
./scripts/prepare-runtime.ps1
npm run build
```

Çıktı `dist/` altındadır. Depoya model ağırlığı, çalışma zamanı veya sunucu sırrı konulmaz.
GitHub bağlantısı `.github/workflows` yazmasını reddettiği için Actions henüz etkin değil.
`scripts/windows-workflow.yml` şablonunu GitHub üzerinde yetkili bir kullanıcı
`.github/workflows/windows.yml` olarak ekleyince test installer'ı artifact olarak üretilir.

## Kullanım

1. “Tarayıcıda giriş / kayıt” düğmesine basın. Sistemin varsayılan tarayıcısında açılan
   Veriüssü sayfasından giriş yapın; ardından bağlantı sekmesine dönüp “Hesabımı Umay’a bağla”
   düğmesine basın. Giriş otomatik olarak Umay'a aktarılır; uygulama içinde parola girilmez.
2. Hesabı yenileyin, yetkili modeli seçin. Mevcut sohbetler sunucudan gelir.
3. Ayarlar/Konuşma'dan STT ve TTS indirin. Bunlar büyük indirmelerdir; internet gerekir.
4. Kulaklıkla konuşmayı başlatın veya yazılı soru gönderin. Mikrofon iznini verin.
5. MP3 seçerek klon profil oluşturun, sesi seçin ve önizleyin.

İndirmeler/yerel modeller kullanıcı AppData alanındadır. Merkezi sohbet/hafıza
Veriüssü'den gelir; hesaba özel yerel arşiv ve işlem deneyimi de tutulur.
“Çıkış yap” Umay oturumunu temizler ve varsayılan tarayıcıda Veriüssü çıkış onayı açar.
Tarayıcıdaki Veriüssü oturumunu da kapatmak için bu onayı tamamlayın.
Merkezi hafıza çıkarımı sunucunun ChatMemory iş kuyruğu ve kullanıcının hafıza
ayarlarıyla yürür. Yerel hafıza ve işlem kayıtları için `Docs/device-features.md`
ve `Docs/computer-progress-learning.md` dosyalarına bakın.

### Chrome MCP (0.6.2)

Web görevleri normal yazılı/sesli sohbetten Chrome DevTools MCP ile yürür.
Chrome cihazda kurulu olmalıdır; MCP, SDK ve çalışma ortamı installer'a dahildir,
son kullanıcı Node.js/npm kurmaz. İlk web görevinde Umay'a ait görünür ve kalıcı
Chrome profili açılır. Bu profilde sitelerinize giriş yapabilirsiniz.
**Ayarlar → Modeller → Chrome MCP** bölümünde bağlantıyı deneyebilir veya mevcut
Chrome oturumuna bağlanmayı seçebilirsiniz. İkinci seçenek Chrome 144+ içinde
`chrome://inspect/#remote-debugging` ve Chrome'un bağlantı onayını gerektirir.
Hesap bağlama sistemin varsayılan tarayıcısında kalır. Tarayıcı görevleri, izinler,
durdurma, paket ve gerçek model testleri: `Docs/chrome-mcp.md`.
Chrome kapatıldıktan sonraki komutta aynı profil yeniden açılır ve bağlantı
yenilenir. 0.6.1 hata kaydı ve testleri: `Docs/chrome-reconnect-fix.md`.
0.6.2'de açık ve bağımsız “netflix aç” / “https://example.org adresini aç”
komutları model beklemeden mevcut görev devriyle yürür; sonuç gerçek Chrome'dan
doğrulanır. Genel görevler seçili modellerle devam eder. Süreler ve masaüstü
metin/görsel optimizasyonu: `Docs/control-performance.md`.

Varsayılan tarayıcı girişi için `server/desktop-auth.controller.ts` ve
`server/desktop-auth-policy.ts` sunucu API'sine eklenir; `DesktopAuthController`
AppModule controllers listesine kaydedilir. Mevcut web_sessions tablosu kullanılır,
şema migration'ı yoktur. Kullanıcı kimliği/parolası masaüstüne URL ile taşınmaz;
90 saniyelik tek kullanımlık kod ve PKCE doğrulaması kullanılır.

## Doğrulanması gereken sınırlar

- Bu geliştirme sürümü tamamlanmış ürün değildir. Bkz. `Docs/implementation.md`.
- Mevcut sunucu sohbet API'si akış snapshot'larında yanıt metnini boş dönüyor.
  Bu nedenle ilk sürüm tamamlanan yanıtı seslendirir; erken model sesi hedefi henüz karşılanmaz.
- Web oturumu sunucuda 7 günle sınırlıdır; cookie korunur ancak sınırsız giriş için
  sunucuda ayrıca desktop refresh oturumu gerekir. Parola uygulamada saklanmaz.
- Mikrofon Chromium echoCancellation ile alınır. Gerçek hoparlör, klon ses ve
  double-talk testleri yapılmadan güvenilir barge-in tamamlandı kabul edilmez.
- NVIDIA/CUDA gerçek yükleme testi ve CPU fallback var. AMD/Vulkan STT sağlayıcısı
  henüz bağlanmadı; Intel/AMD bu sürümde CPU kullanır. GPU bulunması destek kanıtı değildir.
- Otomatik updater yapılandırıldı; imzalama sertifikası ve gerçek update feed yayınlanmadan
  güvenli üretim güncellemesi tamamlanmış sayılmaz. Test installer'ı imzasız olabilir.
- Ses klonlama kaynak dosyası en fazla 50 MB ve 10 dakika. Ses kalitesi için aynı
  Türkçe cümleler ve aynı referansla ana cihazda dinleme/performans testi gerekir.

## Ana cihaz testi

Installer'ı kurun; giriş, model listesi, eski/yeni sohbet, hafıza okuma, paket kur/kaldır,
klon oluştur/seç/sil, mikrofon/STT, TTS ve iptali sırayla deneyin. CPU/GPU adı, ilk ses
süresi ve hatayı kaydedin. Sonra Umay yalnız konuşurken yanlış kesilme, kullanıcı
aynı anda konuşurken algılama ve ilk hecenin korunmasını ölçün. 4 GB destek iddiası
bu ölçüm yapılmadan kullanılmamalıdır.

### Canlı konuşma (0.3.0)

Eski sürümden geçişte Ayarlar/Konuşma → STT → İndir / hazırla ile yeni canlı modeli
bir kez kurun. TTS ve klon profilleri korunur. Konuşmayı başlatın; metin konuşurken
görünür, kısa duraklamada gönderilir. Mikrofon yanıt sırasında açık kalır;
yeniden konuşunca yanıt kesilir. Dinlemeyi kapat düğmesi mikrofonu kapatır.
Seviye hiç oynamıyorsa Windows Ayarlar → Sistem → Ses → Giriş bölümünden varsayılan
mikrofonu ve mikrofon gizlilik iznini kontrol edin. STT paketi Ayarlar / Konuşma'dan kurulur.

Canlı STT: sabit revision ile Seda v0.2 / sherpa-onnx, balanced int8, CPU üzerinde
2 thread; kurulduğunda açılışta RAM'e yüklenir. TTS motoru değişmedi. Atıf/lisanslar
speech/NOTICE.txt, karar ve ölçümler Docs/live-speech.md içindedir.

Geliştirici yakalama testi: `node_modules/.bin/electron.cmd tests/electron-microphone.cjs`.
Yapay mikrofon kullanır; gerçek worklet/PCM ve kapat/aç akışını sınar. Model/API bu testte
taklittir. Fiziksel mikrofon, hoparlör yankısı ve CPU/GPU STT süresi ayrıca ölçülmelidir.

Gerçek model testi için önce canlı STT'yi uygulamadan kurun, sonra:

```powershell
.venv/Scripts/python.exe scripts/download-stt-fixture.py
node_modules/.bin/electron.cmd tests/electron-live-stt.cjs
```

CC BY 4.0 lisanslı Türkçe FLEURS örneği kullanılır; gerçek yakalama/tanıma hattı ve
mikrofon yeniden açılmadan iki konuşma sınanır. Sohbet API'si testte taklittir.

### Yeni masaüstü arayüzü — 0.2.0

Umay açılışında giriş/kayıt karşılaması görünür. İşlem varsayılan tarayıcıdan tamamlanır;
onaydan sonra kontrol merkezi açılır. Sohbet, ses ayarları ve hafıza yeni düzendedir.
Ajanlar/otomasyon/dosyalar henüz geliştirilmediği için “Yakında” görünür.
Dar pencerede üstteki sohbet simgesi geçmiş çekmecesini açar. Escape ile kapanır.

`npm run build` öncesinde Windows simgesi SVG kaynaktan otomatik üretilir.
`node_modules/.bin/electron.cmd tests/desktop-ui.cjs` örnek hesapla arayüz akışını
sınar ve .superpowers altında önizleme görüntüleri üretir; gerçek hesaba giriş yapmaz.

### Ses akışı düzeltmesi — 0.3.1
Mevcut STT/TTS paketleri kullanılır; yeniden indirme gerekmez. Yanıt beklerken
mikrofon enerjisi tek başına yanıtı iptal etmez. Oynatım sonrası sessiz konuşma ve
kuyruktaki yeni sözcük başlangıcı korunur. Windows native kütüphane başlangıcı sıraya
alındı. `tests/electron-conversation.cjs` gerçek STT, gönderici ve TTS/oynatımı
birlikte sınar; yalnız sunucu API'si taklittir. İki ses paketinin de kurulu olması ve
`scripts/download-stt-fixture.py` örneğinin hazırlanması gerekir.

### Model yanıt düzeltmesi — 0.3.2
Yazılı mesaj, ses motorunun soğuk açılışındaki iptal onayını beklemez. Hazır cevap
250ms aralıklarla kontrol edilir; başarısız run sohbette açıklanır. Sunucuda modelin
istenmeyen araç çağrısı boş yanıt olarak tekrarlanmaz: çalıştırılmadığı açıkça belirtilir,
bir final devamı istenir; aynı sağlayıcı/model için kısa süreli metin modu öğrenilir.
Bu akış bir web araştırması çalıştırmaz. Modelin sağlayıcı kaynaklı bekleme süresini
ortadan kaldırdığı iddia edilmez. Mevcut STT/TTS paketlerini yeniden indirmeyin.

### Anlaşılır hata uyarıları — 0.3.3
Web ve Windows'ta token yetersizliği, kullanım limiti, bekleyen token işlemi,
oturum, bağlantı ve model hataları kullanıcı diliyle açıklanır. Uyarı sohbet içinde
ve ekran okuyucuya uygun görünür; teknik kodlar ve sağlayıcı hata içerikleri saklanır.
Bu değişiklik token bakiyesini veya bekleyen rezervasyonları değiştirmez.
Yeni modeller indirmek gerekmez. Ortak mesaj kataloğu src/ui/user-errors.js içindedir;
webde dağıtılan aynı katalog tests/web-errors.test.cjs ile eşleştirilir.

### Türkçe okuma ve noktalama — 0.3.4
`4.` ve `4. adım` gibi sıra sayıları, TRT/TDK gibi bilinen harf kısaltmaları ve
ekleri seslendirmeden önce Türkçeye hazırlanır. Mesajın görünen metni korunur.
Tarih, saat, ondalık ve cümle sonundaki miktarlar ayrılır. Noktalama modele
korunarak verilir; cümle/paragraf aralarına kısa duraklamalar eklenir.
Mevcut TTS ve klon sesler kullanılır; konuşma paketini yeniden indirmek gerekmez.
Python kontrolleri: `uv run --no-project --python .venv/Scripts/python.exe --with pytest python -m pytest tests/test_turkish_speech.py tests/test_worker.py tests/test_live_stt.py -q`.

### Klon ses hazırlama — 0.3.5
Klonlama kaynak kaydın ilk saniyeleri yerine uygun bir kısa konuşma arası seçer;
seçilen referansı WAV olarak saklar ve yeniden kesmez. Özgün MP3 korunur.
Doğal ses için tek kişinin konuştuğu, müziksiz10–30 saniyelik kayıt önerilir.
50MB/10dk sınırı aynı; ses yetersizse anlaşılır kayıt önerisi gösterilir.
Yeni klon otomatik seçilir; aynı adlı profiller ayrılır, seçim yeniden kodlama yapmaz.
Eski profiller seçilince hazırlanır. Mevcut TTS modeli, Türkçe okuma ve duraklamalar
korunur; yeni model indirilmez. Ses benzerliği için %100 garanti verilmez.
Kontrol: Python komutuna tests/test_voice_cloning.py eklenir; gerçek UI akışı
`node_modules/.bin/electron.cmd tests/electron-clone.cjs` ile sınanır.

### Yerel hafıza, konum ve bilgisayar — 0.4.0
Hafıza sayfasında hesabına özel kalıcı konuşma arşivi, bağlantılı notlar, tercihler,
dosya yolları ve işlem günlüğü bulunur. Sunucudan silinen sohbetler yerel
arşivden silinmez. Masaüstü/Belgeler/İndirilenler yolları arka planda indekslenir;
içerikler okunmaz. Özel hesaplar Windows ile şifrelenir, modele gönderilmez.
Konum ve uyarılar sayfasından cihaz konumu veya şehir seçilebilir. Hava tahmini
MET Norway'den; deprem AFAD/USGS, haberler AA/OGM RSS kaynaklarından gelir.
Uygulama açık ve hesap bağlıyken kontrol edilir; kaynak/son kontrol ve hata
durumu görünür. Bildirim tercihleri ve özel RSS/Atom kaynakları düzenlenebilir.
Bilgisayar kontrolünü açıp görev yazabilir veya sohbette “Bilgisayarda çalış”
seçebilirsin. Ekran, seçtiğin görsel modele iletilir; metin modelleri Windows
erişilebilirlik öğeleriyle çalışır. F8 veya görev çubuğuyla durdurabilirsin.
UAC/yönetici pencerelerine Windows izin vermeyebilir. Yeni ses modeli gerekmez.
Ayrıntı ve kaynak lisansları: Docs/device-features.md.
