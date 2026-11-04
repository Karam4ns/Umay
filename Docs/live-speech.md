# Kesintisiz Türkçe konuşma

Kullanıcı önceliği: doğru yazılan metnin geç gelmesini düzeltmek; konuşurken canlı
yazı ve Umay yanıt verirken de açık mikrofonla söz kesebilmek.

Kök nedenler: mevcut renderer yalnız sessizlikten sonra tüm kaydı Whisper'a yolluyor;
transcribing=true iken gelen ses karelerini atıyor. Tek Python iş kuyruğunda TTS/STT
birbirini bekliyor. Büyük Whisper CPU'da önceki ölçümde yaklaşık 49 saniye sürdü.

Karar: Türkçe için yerel Seda v0.2 / sherpa-onnx akış tanımasını gerçek cihazda
ölçerek kullan. Model revision sabitlenir, ses cihazdan dışarı gönderilmez. TTS korunur.
100ms ses paketleri, 320ms model adımları; balanced/int8, 2 CPU thread, 600ms duraklama.
Accurate ikinci geçişi aynı örnekte metni iyileştirmedi, işlem süresini artırdı;
kullanıcının gecikme önceliği nedeniyle balanced seçildi. Model açılışta RAM'de kalır.
Ses alımı ayrı 16kHz AudioContext ile tarayıcının örnekleme dönüşümünü kullanır;
TTS çıkışının örnekleme hızı değişmez. Her kare, tanıma sürerken de kuyruklanır.

- [x] Canlı model ve CPU gecikmesini birincil kaynak/FLEURS örneğiyle ölç.
- [x] STT'yi ayrı tek işçi kuyruğuna ayır, stream/generation kimliğiyle geç sonuçları ele.
- [x] Konuşma sırasında partial, duraklamada final; kayıt sırasında STT beklenip ses atılmasın.
- [x] Canlı yazıyı metin alanında göster, elle düzenlemeyi ezme; yalnız finali sohbetle.
- [x] Barge-in TTS'yi durdursun fakat devam eden mikrofon kaydını sıfırlamasın.
- [x] Model güncelleme/kurulum/kaldırma ve lisans atfı; runtime bağımlılıklarını paketle.
- [x] Birim, gerçek worker ve Electron gecikme kontrolleri.
- [x] Kurulum paketi sürüm/kaynak/runtime bütünlüğü.
- [x] GitHub main: 30 kaynak dosyası yerel Git blob SHA değerleriyle birebir doğrulandı.

## Ölçüm ve kabul sınırı

Intel UHD 620 / CPU, herkese açık Türkçe FLEURS kaydı: 7,24 saniyelik beslemede
balanced hesaplama 1,062s; 100ms paket işlem p95 41,3ms. Accurate 2,426s ile
aynı nihai metni verdi. Bu tek örnek bir doğruluk veya her cihazda hız garantisi değildir.

Gerçek Electron mikrofon/worklet → gerçek Python → gerçek Seda testi:
ilk metin 1.517ms, ilk final 7.048ms; mikrofon kapatılmadan art arda 2 final.
Yanıt kesme sonrasında dinleme açık, 16kHz giriş doğrulandı. Hesap ve sohbet
gönderimi testte taklittir; fiziksel mikrofon ve hoparlör yankısı kabulü değildir.

Çıkış oynarken düşük seviyeli ses ASR'a sıfır kare olarak gider. 100ms insan sesi
eşiği aşılırsa 100ms ön tampon eklenir ve yanıt derhal iptal edilir; STT sıfırlanmaz.
Chromium echoCancellation açıktır. Fiziksel hoparlörde double-talk testi gerekir.
Elle düzenlenen/silinen metin korunur, eski neslin partial/final olayları reddedilir.

Eski Whisper kurulumu yeni paket sayılmaz; Ayarlar/Konuşma STT güncellemesi gösterir.
İndirme sabit model revision'ını yükler. Kaldırma hem eski hem yeni STT'yi kaldırır,
TTS ve klon profillerini korur. Seda model lisansı CC BY-SA 4.0; NOTICE.txt pakete eklenir.

Kaynaklar: https://pypi.org/project/sedalib/1.1.0/ ve
https://huggingface.co/atasoglu/seda-v0.2 (üreticinin ölçümleri, bizim cihazın garantisi değil).

## 0.3.1 düzeltmesi
0.3.0'ın yalnız tanıma testi yanıt gönderimi ve TTS soğuk başlangıcını kapsamıyordu.
Yeni tam zincir testi eklendi. Ham enerji ağ yanıtını iptal edemez; tanınmış yeni söz
edebilir. Playback kuyruğu bitince bastırma temizlenir. Worker 20ms sınırlarında
endpoint keser. Native ML import'ları Windows ana thread'inde yapılır; iki modelin
ilk yüklenmesi sıralanır, sıcak çıkarım kuyrukları ayrı kalır. Model/paket revision'ı
ve TTS motoru değişmedi. Mevcut paketler 0.3.1 ile doğrudan kullanılabilir.

## Doğal Türkçe okuma — 0.3.4
Ses metni speech/turkish_speech.py içinde hazırlanır; görünen mesaj korunur.
Örnekler: 4. → dördüncü, 4. adım → dördüncü adım, TRT’den → tereteden,
TDK → tedeke. Bilinen harf kısaltmalarının son harfine ek bağlanır; sözcük
olarak okunan TÜBİTAK/ASELSAN gibi adlara harf okuması uygulanmaz.
Her nokta sıra sayısı değildir: Sonuç4. cümlesinde dört; tarih/saat/ondalık
ve binlik sayılar ayrı kurallardan geçer. Belirsiz bağlamda her rakam+nokta
körü körüne sıra sayısına çevrilmez. Sözlük sonlu ve genişletilebilirdir.
Noktalama işaretleri modele korunarak verilir. Virgül/noktalı virgül/iki nokta
nedeniyle cümle bölünüp bağlam kaybedilmez. Cümleler ve paragraflar arasına
kısa PCM araları eklenir; ilk parça için tam ses üretimi beklenmez.
Süreler ürün tercihidir; TDK belirli milisaniye veya perde değerleri tanımlamaz.
Soru/ünlem tonu mevcut TTS modelinden gelir, kusursuz insan vurgusu iddia edilmez.
İptal model stream'ini kapatır; sonraki cümleye geçmez. Klon ses yolu ve model
indirme/yerleşiklik değişmez. Mevcut konuşma paketleri kullanılmaya devam eder.
Kaynaklar:
- https://tdk.gov.tr/icerik/yazim-kurallari/sayilarin-yazilisi/
- https://tdk.gov.tr/icerik/yazim-kurallari/kisaltmalar/
- https://tdk.gov.tr/icerik/yazim-kurallari/noktalama-isaretleri-aciklamalar/
