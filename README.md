# Umay — Windows

Türkçe sesli asistan geliştirme sürümü. Fütüristik kontrol merkezi ve canlı Türkçe
konuşma akışı içerir.

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

İndirmeler/yerel modeller kullanıcı AppData alanında; sohbet/hafıza veriussu.com'dadır.
“Çıkış yap” Umay oturumunu temizler ve varsayılan tarayıcıda Veriüssü çıkış onayı açar.
Tarayıcıdaki Veriüssü oturumunu da kapatmak için bu onayı tamamlayın.
Hafıza çıkarımı mevcut sunucunun ChatMemory iş kuyruğu ve kullanıcının hafıza ayarlarıyla
yürür; istemci ikinci bir hafıza DB'si oluşturmaz.

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
