# Genel bilgisayar kontrolü — 0.5.0 doğrulama

## Son davranış

Normal sohbetten sesli/yazılı görev verilir. Aynı genel ekran/UIA → model kararı → gerçek Windows girişi → yeni gözlem döngüsü uygulama adlarına bağlı komut listeleri olmadan çalışır. Ayrı bilgisayar sayfası eklenmedi. Yerel `dur`/`bekle`, `devam et`, kesin iptal ve F8; görünür durum çubuğu; önceki uygulama/görev bağlamı; yerel uzun iş takibi; süreli basılı tuş/fare ve göreli fare hareketi eklendi.

Kurulum/kaldırma, kodlama araçları, web/video ve oyunlar aynı genel yetenekleri kullanır. Her gerçek uygulama/oyun/installer çeşidinin bağımsız kabulü yapıldığı anlamına gelmez. Oyunlarda sonuç, görsel modelin karar gecikmesine ve oyunun OS girişlerini kabul etmesine bağlıdır. Korumalı Windows ekranları veya anti-cheat atlatma eklenmedi; yönetici izni gerçek Windows onayından geçer.

## Doğrulama sonuçları

- `npm test`: **171/171**. Yerel komut/olumsuzluk/alıntı, kısmi STT düzeltmesi, pause/drain/generation/sürüm, onay kapsamı, hesap izolasyonu, watch/timeout ve native helper yeniden başlatma dahil.
- Python konuşma/klonlama/noktalama/worker/live-STT regresyonları: **60/60**.
- `tests/electron-control-primitives.cjs`: gerçek Windows'ta yalnızca testin iki penceresi. W+Shift+sol fare basılı girişi, durdurmada tümünün bırakılması, göreli fare, küçültülmüş/arka plandaki pencere ilerlemesi, odak koruması, PID/HWND bağı, kapanan pencere ve parola alanının dışlanması. Son kaynak ölçümü **41ms**, paket modüllerinden **51ms** yerel dur sinyali→keyup/mouseup. Fiziksel konuşmayı tanıma süresi değildir.
- `tests/electron-general-control.cjs`: normal sohbet → gerçek pencere odağı/UIA → yerel iş takibi → gerçek «Next section» tıklaması → ekranda Section2 doğrulaması. Kaynak ve paket modüllerinden geçti. Sağlayıcı kontrollüdür; mevcut UI metni `userAuthorization` alanına dönüşmez.
- `tests/electron-voice-stop.cjs`: gerçek getUserMedia yakalama → Seda → yerel `Dur` → gerçek Windows W key-up. Uygulama küçültülmüşken dinleme açık; F8 duraklatılmış görevi kesin durdurdu. Son ölçüm tanınan metinden key-up'a **174ms**. Ses dosyası varsayılan Türkçe TTS ile üretilmiş test kaydıdır; fiziksel insan mikrofon kaydı değildir. Model sağlayıcısı kontrollüdür; native giriş gerçektir.
- `tests/electron-native-folder-chat.cjs`: son paket modülleriyle gerçek Windows Run/Explorer başlatma → yeni Desktop klasörü → Unicode ad → Enter → dosya sistemi doğrulaması. Test hedefi `Umay 0.5 Kontrol`; kullanıcı dosyaları değiştirilmedi.
- Mevcut sohbet/izin/soru/rol/UI, hafıza/konum/tema/hesap temizliği regresyonları geçti.
- Mevcut gerçek mikrofon→Seda→sohbet→görev devri→Pocket TTS/WebAudio akışı geçti; dinleme açık; ilk ses353ms, oynatma412ms. Bunlar model sağlayıcısının yanıt süresi değildir.
- Gerçek PowerShell/C# hata protokolü, ilk/kısmi giriş, key-up hatası ve önceden iptal edilmiş hold testleri geçti; bu protokol testinde OS SendInput sınırı değiştirilir ve gerçek giriş yapılmaz.
- Gerçek Windows pipe/bootstrap/sıkıştırılmış native payload: geçti;21564 karakter. Mevcut oturum zaten yönetici tokenı taşıdığından yeni standart-kullanıcı UAC kabul/ret penceresi test edilmiş sayılmaz.

## İnceleme düzeltmeleri

Bağımsız incelemedeki4 önemli ve2 küçük konu testle yeniden üretildi ve giderildi:

1. Yeni/yeniden başlayan iş, önceki normal/yönetici girişlerinin bırakılmasını bekler. Sadece eski model Promise'inin bitmiş olması yeterli sayılmaz.
2. Hold zaman aşımı kalıcı `close` yerine geçici drain kullanır; key-up sonrası yeni helper başlayabilir. Bırakma bloğu tamamlanmadan süreç normal yoldan öldürülmez.
3. Bilgisayar görevi durdurulunca Windows girişleri kesilir ve eski nesil sonucu karantinaya alınır. Kabul edilmiş model isteği terminal duruma kadar okunur; sağlayıcı akışı sırf yerel dur komutu için iptal edilmez. Bu çağrının gerçek kullanım muhasebesi devam edebilir; yeni giriş veya yeni model adımı başlatılmaz. Devam, önceki muhasebe yanıtı ve native drain sonrasında güncel sürümü alır.
4. Duraklatılmış soru/onayın metni ve özel eylem kapsamı devamda korunur; onay otomatik verilmez.
5. Duraklatma ve yerel izleme, aktif işlem süresini tüketmez.
6. Watch tam bir metin koşulu veya `changed:true` ister; eksik/çelişen koşul tahmin edilmez.

Son düzeltme incelemesinde açık engelleyici bulgu yok; bağımsız171 unit testi geçti. Native/UI sonuçları yürütücünün kendi test kayıtlarıdır.

## Sunucu

İki worker için helper-only güncelleme: `veriussu-umay-control-worker:0.5.0`; aday test ve aktivasyon aynı immutable image ID'yi kullanır. Yedek `/root/umay-control-1793883090`, staging `/root/umay-control-stage-0.5.0`. Eski imajda yeni yetenekler eksik olduğu RED olarak doğrulandı; aday gerçek HTTP/izole PostgreSQL/denetimli SSE testlerinde GREEN oldu.

Canlı audit: iki worker healthy; helper hash'leri adayla aynı; helper dışındaki **bütün dist modülleri ve public varlıkların** toplu özeti aynı. Ortam/port/mount aynı. Frontend0.4.4 imajı ve10203 geçidi değiştirilmedi, ikisi healthy. DB şeması ve token muhasebe kayıtları elle değiştirilmedi.

Eski iptal edilmiş Alfa1.2 isteklerinde kullanım sayıları eksik `NEEDS_RECONCILIATION` kayıtları hâlâ mevcut. Bu yüzden gerçek kullanıcı hesabıyla son tam dış-model kabulü **geçmiş sayılmadı**. Bu kayıtlar için ölçülmüş sağlayıcı kullanımı gerekir; bilinmeyen kullanımı sıfır varsayarak bakiye açılmadı. Yeni yerel durdurma davranışı aynı sebeple yeni iptal kaydı üretmemek üzere düzeltildi.

## Paket

`dist/Umay Setup 0.5.0.exe` —478612604 bayt; SHA256 `857983f138e94caa70e1fed420c92a40deb07337153eb6d6a61d3a3ef7134e17`.

Çıktı `dist/control-0.5.0`. `node tests/verify-computer-package.cjs dist/control-0.5.0/win-unpacked/resources`: **42 uygulama dosyası**, unpacked native yardımcı ve4 ses modülü kaynaklarla birebir. Önceki kullanıcı kararı gereği imzasız test paketi. Paket sonrası uygulama yeniden açılmalıdır.
