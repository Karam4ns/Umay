# Umay — Windows

Türkçe sesli asistan geliştirme sürümü. Nihai görsel tasarım henüz uygulanmadı.

## Geliştirme

Windows, Node.js 24 LTS ve uv gerektirir. Son kullanıcının Python kurmasına gerek
kalmaması için yayın paketi Python çalışma zamanını içerir.

```powershell
npm ci
node node_modules/electron/install.js
uv venv --python 3.12 .venv
uv pip sync --python .venv/Scripts/python.exe speech/requirements-lock.txt
npm test
.venv/Scripts/python.exe -m pytest tests/test_worker.py -q
npm start
```

## Windows kurulum paketi

```powershell
./scripts/prepare-runtime.ps1
npm run build
```

Çıktı `dist/` altındadır. GitHub Actions da indirilebilir Windows test installer'ı
oluşturur. Depoya model ağırlığı, çalışma zamanı veya sunucu sırrı konulmaz.

## Kullanım

1. Veriüssü giriş/kayıt penceresini açıp kendi hesabınızla giriş yapın, pencereyi kapatın.
2. Hesabı yenileyin, yetkili modeli seçin. Mevcut sohbetler sunucudan gelir.
3. Ayarlar/Konuşma'dan STT ve TTS indirin. Bunlar büyük indirmelerdir; internet gerekir.
4. Kulaklıkla konuşmayı başlatın veya yazılı soru gönderin. Mikrofon iznini verin.
5. MP3 seçerek klon profil oluşturun, sesi seçin ve önizleyin.

İndirmeler/yerel modeller kullanıcı AppData alanında; sohbet/hafıza veriussu.com'dadır.
Hafıza çıkarımı mevcut sunucunun ChatMemory iş kuyruğu ve kullanıcının hafıza ayarlarıyla
yürür; istemci ikinci bir hafıza DB'si oluşturmaz.

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
