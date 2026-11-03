# Uygulama yürütme kaydı — 2026-11-03

Kullanıcı tüm adımların uygulanmasına, test edilmesine ve GitHub'a yüklenmesine izin verdi.
Önceki tek adım sonunda bekleme kuralı bu uygulama talimatıyla kaldırıldı.

## Teknik kararlar

- Yeni, bağımsız Git deposu `development` dalında oluşturuldu; önceden ürün deposu yoktu.
  Bu nedenle başka bir ana dal üzerinde çalışma veya mevcut checkout'u değiştirme yok.
- Windows: Electron 45.2.1 + electron-builder 26.18.0; ayrı Python 3.12.16 işçisi.
- STT: Whisper large-v3-turbo'nun Dropbox Dash CTranslate2 dönüşümü; CPU INT8,
  çalışıyorsa CUDA INT8/FP16; başarısız GPU yüklemesinde açık CPU fallback.
- TTS: pocket-tts-turkish 0.1.0; gerçek CPU yükleme ve üretim denendi.
- Beklenen Django yerine sunucuda NestJS/Fastify/PostgreSQL bulundu. Mevcut şema ve
  API'ler kullanılıyor; canlı sunucu dosyaları/veritabanı değiştirilmedi.
- SSH parolası yıldızlarıyla birlikte kullanılınca bağlantı başarılı oldu. İlk iki
  giriş başarısızlığı paroladaki yıldızların yanlışlıkla çıkarılmasından kaynaklandı.
- `Docs/sunucu.txt`, yardımcı SSH betikleri, runtime, modeller ve çalışma ortamı
  Git dışında. GitHub hedefi özel `Karam4ns/Umay` deposu.
- Kullanıcı imzasız test sürümünü seçti; üretim imzalama/yayınlama yapılmayacak.

## Gerçek sunucu sözleşmeleri

- `/site/auth/me`, `/site/auth/logout`: Veriüssü web oturumu.
- Giriş/kayıt 0.1.1: sistemin varsayılan tarayıcısı; loopback + PKCE tek kullanımlık
  koduyla bağımsız masaüstü oturumuna aktarım. Ayrıntı: browser-auth.md.
- `/site/chat/models`: mevcut hesaba yetkili PERSONAL/SUBSCRIPTION modelleri.
- `/site/chat/conversations`, detay ve messages: mevcut sohbetler, sürümlü yazma,
  requestId tekilleştirme ve run durumu.
- `/site/chat/runs/:id`, `/cancel`: yanıt takibi ve sunucu üretimi iptali.
- `/site/user-memory`: mevcut hafıza tablosu/API görünümü.
- ChatExecution, mevcut ChatMemory.enqueue üzerinden hafıza işini sunucuda kuyruğa alır;
  bu iş kullanıcının enabled/capture_enabled ayarlarına bağlıdır.

## Yapılanlar

- Windows kabuğu ve işlevsel Türkçe ekranlar; açık/koyu tercih. Nihai tasarım değil.
- İzole IPC/preload, uzak pencereye Node/preload verilmemesi, yerel CSP ve sabit API allowlist.
- Yerel DB kurmadan mevcut site API'si ve cookie oturumu bağlantısı.
- İndirilebilir STT/TTS, gerçek yükleme/ısıtma; modeller normal turlarda bellekte kalır.
- Paket kaldırma, iptal, klon oluştur/seç/sil/önizleme; 50 MB MP3 kontrolü.
- Gerçek mikrofon PCM, Türkçe STT, tamamlanan yanıtın TTS ile seslenmesi.
- Nesil kimliğiyle eski yanıt/ses/metnin iptal sonrasında kullanılmaması.
- Chromium echoCancellation + gürültü bastırma + VAD ile deneysel barge-in.
- Windows runtime hazırlığı, NSIS paketleme ve GitHub Actions installer şablonu.
  Kaynak kod özel GitHub deposuna yüklendi. Bağlantı workflow yoluna yazmayı 404 ile
  reddetti; uzakta `scripts/windows-workflow.yml` şablonu var, Actions etkin değil.

## Açık kalan kabul koşulları — tamamlandı sayılmayacak

1. Gerçek kullanıcı hesabıyla login/sohbet/hafıza senaryosu ana cihazda doğrulanmalı.
   SSH erişimi aktif kullanıcı oturumu veya kişisel hesap verisine erişim yerine kullanılmadı.
2. Sunucu web oturumu DB/cookie tarafında 7 gün. Sonsuz oturum için desktop refresh
   sözleşmesi ve test edilmiş sunucu değişikliği gerekli; bu sürüm yalnız mevcut oturumu saklar.
3. Sunucunun run snapshot'ları `draftContent` alanını boş döndürüyor. Mevcut sürüm son
   yanıtı bekliyor. Erken LLM→TTS için yetkili gerçek metin akışı sunucuya eklenmeli.
4. AMD/Vulkan sağlayıcısı bağlı değil. Intel/AMD bu sürümde CPU'ya düşer. NVIDIA'nın
   CUDA DLL/uygun PyTorch paketi de ana cihazda doğrulanmalı; 4 GB kabulü yapılmadı.
5. Chromium AEC, oynatım referansını açıkça kontrol ettiğimiz WebRTC AEC3 katmanının
   yerini doğrulanmış biçimde almış sayılmaz. 20 tur hoparlör/çift konuşma/klon testi eksik.
6. İmzalı update feed ve vN→vN+1 dağıtım testi yapılmadı. Kullanıcının seçimiyle imzasız
   test installer'ı hazırlanıyor; production publish yetkisi bu kayıtla varsayılmıyor.
7. Klon oluşturma/seçme/silme üretilmiş sentetik MP3 ile gerçekten denendi ve geçti.
   Klon benzerliği, gerçek mikrofon, ilk hece korunması ve CPU/GPU performansının
   kullanıcı dinlemesiyle kabulü henüz yok. 20 tur p50/p95 ölçümü yapılmadı.
8. Hafıza düzeltme/unutma için ayrı masaüstü düzenleme ekranı henüz yok; mevcut site
   yönetimi kullanılır. Okuma ve sunucu ChatMemory akışı adapter'da var.

Bu kayıt ilk test edilebilir geliştirme sürümünü açıklar; tüm ürün gereksinimlerinin
tamamlandığı anlamına gelmez. Sonuç ve komut kanıtları `test.md` dosyasındadır.
