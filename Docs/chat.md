# Sohbet Kaydı

## [2026-01-01] Kullanıcı
Kanun dosyasını oku: `C:\Users\Karam4n\Documents\Vault\Karam4n\kanun.md`

## [2026-01-01] Asistan
Kanun okundu. Docs yapısı (`plan.md`, `walkthrought.md`, `test.md`, `chat.md`, `terminal.md`) kuruldu.
Proje kapsamı soruldu: `UmayV0.1.0` dizini boş, ne inşa edileceği belirsiz.

## [2026-11-03] Kullanıcı — Umay çalışma yöntemi ve ilk kapsam

Kullanıcı kendisi için Jarvis benzeri Umay asistanını adım adım yönlendirecek.
Tek seferde tüm projeyi uygulama yetkisi yok. Tasarım örnekleri ve son renk
denemeleri reddedildi; tasarım en sona ertelendi. Windows önce, mobil sonra.

İlk kapsam: doğal Türkçe karşılıklı sesli sohbet, vurgu/noktalama/tonlama,
hızlı yanıt, ses klonlama. Ayarlar/Konuşma'dan STT/TTS indir/kaldır, otomatik
kullanılabilirlik ve en fazla 50 MB MP3 referansı. Yerel kullanıcı DB'si olmayacak.
Gelecekte veriussu.com üzerinden kayıt/giriş ve veri API'si kullanılacak;
Docs/sunucu.txt üzerinden SSH/site incelemesi temel uygulamadan sonraya bırakıldı.
Bu turda ayrıntılı plan ve walkthrought dosyasına kapsamlı yol haritası istendi.

## [2026-11-03] Asistan — Karar ve durum

Yalnızca Docs dosyaları güncellendi. A0–A11 ve gelecek mobil fazı ayrıldı.
Windows kabuğu/motorlar henüz seçilmedi; mevcut Django/DRF notu sunucu bağlamında
korundu. 50 MB = 50.000.000 bayt yorumu, yerel motorlar ve hız değerleri öneridir.
Gerçek LLM erişimi olmadan karşılıklı sohbet tamamlandı sayılmayacak.
Kullanıcı yönlendirmesiyle her adım ayrı uygulanacak; sıradaki öneri A0.

### Kullanıcıya verilen yanıt

Planı ve adım adım yol haritasını dosyalara ekledim:

- [Ayrıntılı proje planı](C:/Users/Karam4n/Desktop/UmayV0.1.0/Docs/plan.md)
- [İlerleme ve yol haritası](C:/Users/Karam4n/Desktop/UmayV0.1.0/Docs/walkthrought.md)

Windows temeli, Türkçe sesli sohbet, STT/TTS kurulumu-kaldırılması ve 50 MB MP3 ile
klonlama için ayrı adımlar ve kabul koşulları yazıldı. Sunucu/hesap entegrasyonu
sonraya, nihai tasarım en sona bırakıldı.

Doküman kontrolleri geçti. Kodlama veya sunucu bağlantısı başlatmadım;
sonraki adımı sen yönlendireceksin.

## [2026-11-03] Kullanıcı — STT/TTS seçimi

Soru: STT ve TTS olarak ne kullandık, hangi model?

Asistan yanıtı:
Henüz bir model seçmedik veya kurmadık; yalnızca adayları plana yazdık.
- STT: Whisper ailesi; çalıştırmak için faster-whisper veya whisper.cpp aday.
  Whisper model boyutu/sürümü henüz seçilmedi. Bunlar model değil, çalıştırma motorlarıdır.
- TTS ve ses klonlama: XTTS-v2 aday olarak yazıldı; kesinleşmedi.
Şu anda çalışan bir STT/TTS entegrasyonu yok.

## [2026-11-03] Kullanıcı — Hafif modeller ve 4 GB GPU
Kullanıcı 4 GB ekran kartlarında çok hızlı ve yüksek kaliteli çalışmayı hedefledi.
Plan/walkthrought güncellendi; kod, kurulum veya benchmark başlatılmadı.

Asistan yanıtı:
4 GB VRAM hedefini plana ekledim.
- STT başlangıç adayı: çok dilli Whisper small + INT8; Türkçe kalitesi ölçülecek.
- TTS/klonlama: XTTS-v2 henüz kesinleşmedi; 4 GB'ta hız ve kalite testinden geçmesi gerekiyor.
- Optimizasyon: sıcak motorlar, parça parça seslendirme, bellek bütçesi; gerekirse STT CPU'da.
Kusursuz kaliteyi bütün 4 GB kartlarda garanti edemeyiz. Gerçek cihazda gecikme,
bellek ve Türkçe ses kalitesini ölçerek karar vereceğiz. Henüz model kurulmadı.

## [2026-11-03] Türkçe kalite önceliği
Kullanıcı: Türkçede en iyi sonucu veren modeller kullanılsın.
Yanıt: Türkçe kalitesini öncelik yapıyoruz; 4 GB/hız hedefi korunuyor.
STT'de Whisper large-v3-turbo, TTS/klonlamada Pocket TTS Turkish ilk değerlendirme
adayları. Pocket model kartı 110M parametre, 440 MB, streaming ve klonlama bildiriyor;
geliştirici ölçümleri bizim Windows/4 GB sonuçlarımız değildir.
large-v3 ve Chatterbox Multilingual V3/XTTS-v2 kalite karşılaştırmasına alınacak.
Türkçede mutlak en iyi iddiası yok; aynı örneklerle ölçüm ve dinleme sonucu seçim.
plan.md ve walkthrought.md güncellendi. Model indirilmedi; kodlama başlamadı.

## [2026-11-03] Donanım seçimi, hazır modeller ve barge-in
Kullanıcı: AMD/NVIDIA/ARM/Apple M donanımı otomatik algılansın; GPU yoksa CPU.
Umay açıkken STT/TTS bellekte kalsın. Kullanıcı konuştuğunda Umay sussun;
kendi sesi konuşmasını kesmesin.

Asistan: Gereksinimler plan ve yol haritasına işlendi. GPU markası ile destekli
inference yolu ayrıldı; STT/TTS ayrı cihaz seçer. İlk kapsam Windows, macOS/ARM
platform testleri sonraki fazda. Normal turlarda modeller boşaltılmaz; CPU'da RAM,
Apple Silicon'da birleşik bellek değerlendirilir. Barge-in için gerçek oynatım PCM
referansı + AEC + VAD/çift konuşma denetimi ve eski yanıtı iptal tasarlandı.
20 tur/yalnız Umay/çift konuşma/klon ses kabul testleri eklendi.

Kullanıcıya verilen yanıt:
Planı ve yol haritasını güncelledim. Donanıma uygun destekli çalışma motoru otomatik
seçilecek; GPU yoksa veya kullanılamıyorsa CPU kullanılacak. STT/TTS normal konuşma
turları arasında boşaltılmayacak. Barge-in, Umay'ın gerçek oynatım sesini referans
alan yankı giderme üzerinden doğrulanacak; kullanıcı konuşunca eski ses ve yanıt
üretimi iptal edilecek, modeller bellekte kalacak. CPU modelleri RAM'de, Apple M
modelleri birleşik bellekte tutulur. Bellekte hazır olmak ağ/model üretim gecikmesini
sıfırlamaz. Henüz kodlama veya model kurulumu yapılmadı.

## [2026-11-03] Aktif kullanıcı modelleri, sohbetleri ve hafızası
Kullanıcı: veriussu.com'dan aktif kullanıcının modelleri, sohbetleri ve hafıza tablosu
çekilecek. Umay kullanıcı hakkındaki spesifik bilgi ve kararları toplayıp sohbetlerde kullanacak.
Yorum: Modeller ilk olarak yetkili sohbet/LLM listesi olarak ele alındı; gerçek şema
sunucu incelemesinde doğrulanacak. Yerel STT/TTS paketlerinden ayrı.

Asistan yanıtı:
Plan ve yol haritasına ekledim:
- Aktif kullanıcının modelleri, sohbet geçmişi ve hafızası veriussu.com'dan alınacak.
- Umay konuşmalardaki açık kullanıcı bilgilerini, tercihlerini ve kararlarını sunucu
  hafızasına kaydedip sonraki sohbetlerde ilgili olanları kullanacak.
- Tekrarlanan bilgi birleştirilecek; düzeltmeler güncellenecek, unutulan bilgi yeniden oluşturulmayacak.
- Asistan önerileri kullanıcı kararı sayılmayacak; hesaplar arasında veri karışmayacak.
Kalıcı veriler veriussu.com'da kalacak; Umay'da yerel DB olmayacak.
Henüz sunucu bağlantısı veya kodlama yapılmadı.

## [2026-11-03] Windows dağıtım, otomatik güncelleme ve kalıcı oturum
Kullanıcı: umay.veriussu.com üzerinde kurulum dosyası indirilecek; yeni sürümler
kurulu uygulamaları otomatik güncelleyecek. Giriş kullanıcı çıkış yapana kadar
korunacak. Şimdilik yalnızca Windows.

Asistan yanıtı:
Planı güncelledim:
- Yalnızca Windows uygulaması; mobil/macOS bu sürümün dışında.
- umay.veriussu.com üzerinden setup.exe benzeri kurulum dosyası indirilecek.
- Yeni sürümler otomatik kontrol edilip indirilecek; aktif konuşma bitince güvenle uygulanacak.
- Güncellemelerde giriş, ayarlar, ses modelleri ve klon profilleri korunacak.
- Uygulamayı kapatmak veya PC'yi yeniden başlatmak çıkış yaptırmayacak;
  oturum arka planda yenilenecek. Sunucu oturumu iptal ederse yeniden giriş gerekebilir.
Henüz kodlama, yayınlama veya sunucu değişikliği yapılmadı.

## [2026-11-03] Kullanıcı — Uygulamaya başlama ve GitHub
Kullanıcı tüm adımların kodlanması/test edilmesi ve GitHub'a yüklenmesini istedi.
SSH parolasının baş/son ikişer yıldızının gerçek parola parçası olduğunu açıkladı;
yıldızları koruyan bağlantı başarılı oldu. Kullanıcı imzasız Windows test sürümünü seçti.

Uygulama: Electron + Python 3.12, CPU testleri, mevcut NestJS API adapter'ı ve
Windows installer çalışmaları. Güncel sınırlar implementation.md'de. Private GitHub
hedefi Karam4ns/Umay. Kullanıcı sırrı hiçbir commit/yüklemeye dahil edilmedi.
Bu kayıt tüm gereksinimlerin tamamlandığını iddia etmez.

## [2026-11-03] Test sürümü durumu
Kaynaklar özel https://github.com/Karam4ns/Umay deposunda. 11 Node ve 3 Python testi
ile Electron açılış/IPC/gezinme testi geçti. Sentetik Türkçe TTS/STT ve MP3 klon profil
işlemleri gerçek motorla denendi. Windows imzasız test installer'ı hazırlanıyor.
Tüm hedefler bitmedi: kalıcı desktop refresh, erken yanıt metni akışı, AMD/Vulkan,
4 GB GPU, güvenilir hoparlör barge-in ve gerçek kullanıcı hesabı testleri açık.
Workflow yazma bağlantı tarafından reddedildi; Actions henüz çalışmadı. Kullanıcıya
ana cihaz testi için README ve implementation.md sınırlarıyla birlikte aktarılacak.
