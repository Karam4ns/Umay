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
