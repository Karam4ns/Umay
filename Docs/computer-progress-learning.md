# İşlem ilerlemesi ve deneyim hafızası — 0.5.2

## Gerçek hatanın kanıtı

6 Kasım 2026 tarihli yerel arşiv ve sunucu mesajları birlikte okundu. `5c56820d-7aa0-4ee9-87cb-3deee48263f4` görevi yeni sekmeye tıkladıktan sonra `netflix.com` metnini 16 kez yazmış. Önceki tekrar özeti ekran görüntüsünü ve değişen alan değerini içerdiği için her ekleme farklı sanılmış. UIA'nın pencere ve belgelerdeki `HasKeyboardFocus` ipuçları da gerçek adres alanının önüne geçmiş.

Sohbet aktarımı örneğinde sunucu kuyruğu yaklaşık 20–40 ms, Alfa1.2 yanıtı 14.406 ms; yanıt aşamasında 15.617 giriş ve 1.104 çıkış tokenı kaydedilmiş. Bu ölçüm konuşma sentezi süresi değildir.

## Değişiklikler

- Aynı metnin aynı alana yeniden eklenmesi, değişen görüntü/alan kimliğinden bağımsız engellenir. İlk engellemede planlayıcı gerçek sonuca bakıp eksik adıma geçebilir; ikinci engellemede görev kullanıcıya görünür biçimde bekler. Ctrl+A ile açıkça yenileme ve idempotent `replace` ayrı değerlendirilir.
- Gerçek UIA odak kimliği, ağaç toplandıktan sonra okunur. Üst pencerenin odak ipucu adres alanını gölgelemez. Metin girişinde hedefin odağı ve Windows pencere kimliği yeniden denetlenir.
- UIA kuyruğundaki `($depth+1)` parantezlenir: PowerShell'in önceki dizi değerlendirmesi fazladan öğe üretip derinlik/üst-belge alanını kaydırıyordu. Bu hata gerçek Chrome testinde görüldü ve giderildi.
- `type` için odaklanmış Edit alanında `replace:true` ve `submit:true`: seçili içeriği değiştirme, Unicode giriş ve Enter tek işlemde çalışabilir. Uzun girişler mevcut 32 karakterlik iptal edilebilir parçalara ayrılır. Kullanıcı odağı değiştirirse körlemesine devam edilmez.
- `navigate` yalnız mevcut tarayıcı araç çubuğunda gözlenen adres alanıyla sunulur. HTTP/HTTPS adresini odakla/değiştir/gönder tek işlemine çevirir; web formundaki adres alanına uygulanmaz. Sonuç aynı penceredeki üst belgenin URL'siyle okunur; iframe veya yalnız adresin yazılmış olması doğrulama sayılmaz. Açık, tek URL ziyaretinde yeterli UIA bulunduğunda görüntü yükü atlanabilir; görsel istenirse veya hata toparlanırsa ekran görüntüsüne dönülür. Diğer görevlerin görsel kontrolü korunur.
- Önceki adımlarda hedef, tuşlar, karakter sayısı, giriş süresi ve sonraki gözlem sonucu bulunur. `input_sent`, `observed_after_input` ve `field_matches_input` farklı kanıt düzeyleridir. Bilgisayar yanıtı da kabul edilen run'ın `assistantMessageId` değeriyle eşleştirilir.
- Sohbet modeli en çok altı kısa adımlık yaklaşımı bilgisayar modeline aktarabilir. Seslendirme bitişini beklemeden görev başlar. Plan/orijinal istek ayrımı korunur: plan, ekran ve geçmiş deneyimler yeni yetki vermez.
- Bilgisayar yanıtında sağlayıcı destekliyorsa JSON işlem şeması kullanılır; geçmiş adımın `target/outcome/after/observation` alanlarını işlem diye kopyalaması engellenir. `response_format` reddinde JSON nesnesi ve sonra mevcut yönerge biçimine sınırlı dönüş yapılır; destek durumu beş dakika tutulur.
- Masaüstü sohbetindeki modele gönderilen yakın geçmiş 12 mesajla sınırlanır; kalıcı kaynaklı hafıza ve geçerli cihaz bağlamı ayrıca korunur. Karmaşık tutarlılık istemleri dışındaki masaüstü yanıtlarda düşük gecikmeli reasoning ayarı uyumlu biçimde denenir. Web sohbetinin normal yolu korunur.

## Kalıcı öğrenmenin kapsamı

Hesaba ait yerel SQLite dosyasına ayrı `computer_experiences` tablosu eklenir. Görev devam ederken gözlem sonrası kontrol noktaları, tamamlanınca veya hata/durdurma olduğunda son durum kaydedilir. Kayıtlar yeniden açılışta kalır; başka hesaba aktarılmaz. Yazılan metnin kendisi, ekran görüntüleri, koordinatlar ve eski onaylar deneyim kaydına alınmaz. Kullanıcı profiliyle karışmaz.

İlgili son 300 kayıttan sözcük eşleşmesiyle seçilen en çok iki deneyim sohbet/planlayıcı bağlamına verilir. Planlayıcı kendi etkin kaydını geçmiş deneyim olarak tekrar almaz. İşlem bağlamında ayrıca boyut sınırı uygulanır. Bu, model ağırlığı eğitimi veya uygulamanın kendi kodunu değiştirmesi değildir; doğrulanmış adımları ve hataları hatırlayan çalışma hafızasıdır. `model_reported` bir tamamlanma gerçek sonkoşul doğrulaması sayılmaz; eski koordinatlar veya izinler oynatılmaz.

## Ses

Seda balanced/c16, dil modeli ve noktalama korunur. IPC toplama eşiği 100 ms'den 40 ms'ye, birikmiş paket sınırı 400 ms'den 200 ms'ye düşer. Konuşma bitiş sessizliği 600 ms yerine 350 ms'dir. Pocket TTS, klon sesi, Türkçe sayı/kısaltma kuralları ve ses çalma sırası değiştirilmez.

Aynı gerçek WAV'da eski/yeni son metin aynı kaldı. İlk kısmi metin sesin 480. ms'sinde; son metin 5.020 yerine 4.760 ms'de çıktı. İşleme/gerçek zaman oranı 0,313/0,336 idi. Bunlar tek kayıt ve bu cihaz içindir. Gerçek capture→Seda→sohbet arayüzü→Pocket TTS testinde, kontrollü API yanıtının görünmesinden ilk sese 314 ms, ilk çalmaya 407 ms ölçüldü; mikrofon açık kaldı. Bu ölçüm gerçek bulut modelinin yanıt bekleme süresini içermez.

## Doğrulama ve dağıtım

197 Node testi ve 60 Python testi geçti. Gerçek Windows testinde odaklanmış Edit üzerinde değiştir/yaz/Enter geçti; son basılı tuş/fare iptali 48 ms idi. Gerçek capture→Seda `Dur` testinde tanıma olayı sonrası yerel duraklama 158 ms, gerçek basılı W tuşunun bırakılması 160 ms; fiziksel F8 ve küçültülmüş pencerede dinleme geçti. Ayrı Chrome profili ve gerçek atanmış modellerle kabul testi, ilk denemede planlayıcının geçmiş kaydı kopyalamasını yakaladı; bu sonuç başarısız olarak korundu, ardından işlem şeması eklendi.

Sunucu, üretim kullanıcılarını değiştirmeyen ayrı HTTP/PostgreSQL testinden sonra iki worker olarak güncellendi. 10203 geçidi, kimlik doğrulama, kullanıcı model rolleri, bakiye ve sunucu DB şeması korunur. İlk yedek `/root/umay-reply-1793966097`; şemalı worker yedeği `/root/umay-reply-1793966566`; son gezinme yeteneği yedeği `/root/umay-reply-1793967049`.

## Son canlı kabul

Kullanıcının seçili Alfa1.2 sohbet ve kişisel Qwen3-VL bilgisayar rolleri değiştirilmeden, ayrı Chrome profili açılarak gerçek Veriüssü API'si üzerinden test edildi. İlk şemalı geçiş 42.576 ms; tek gezinme işlemiyle sonraki geçiş 28.760 ms, son metin bağlamlı geçiş 30.988 ms idi. Son iki denemede yalnız Ctrl+L ve tek `replace+submit` metin girişi oldu; Netflix'in gerçek sayfa başlığı ve adresi doğrulandı, tekrar eden alan adı yoktu. İşlem deneyimi gerçek yerel DB'de saklandı. Son görev devri 7.872 ms idi. Bunlar tekil canlı denemelerdir, kontrollü hız karşılaştırması veya tüm uygulamalar için başarı/hız garantisi değildir. Seçili modellerle toplam 29–31 saniye hâlâ anlık sayılmaz; sağlayıcı çıkarımı belirgin sınır olmaya devam eder.

Geçici API doğrulama oturumu iptal edildi. Üretimdeki iki planlayıcı yardımcısının kaynakla SHA256 eşleşmesi kontrol edildi. Aynı gerçek imajın ayrı HTTP/PostgreSQL testinde `response_format` reddi özellikle üretildi; JSON nesnesine geri dönüş ve yürütmenin devam etmesi doğrulandı. 10203 geçidi sağlıklı, yalnız iki güncel worker etkin; diğer API/public dosyaları önceki sürümle aynı.

## Kurulum

`dist/Umay Setup 0.5.2.exe`: **347.467.935 bayt**, SHA256 `514b93ce08e3d80bc94dc58b43faf5a9a86506c992e8d9a604f331ac3d982732`. Son paket dizini `dist/hotfix-0.5.2-final`; önceki tamamlanmamış paket teslim edilmez. Installer SHA512/uzunluğu `latest.yml` ile eşleşir. 44 uygulama dosyası, açılmış Windows yardımcısı ve dört konuşma modülü kaynaklarla byte düzeyinde aynı. Paket üzerinden gerçek odaklı alanı değiştir/yaz/Enter, arka planda izleme, parola gizleme ve basılı tuş/fare bırakma testi geçti; son bırakma süresi 31 ms. Ağaç derinliği 24, öğe sınırı 160 olarak gerçek Electron arayüzünde doğrulandı.

Dağıtılan Python ile aynı STT WAV testi de geçti: metin değişmedi, son metin 5.020 yerine 4.760 ms'de; yeni decode 1.692 ms/6.080 ms ses (oran 0,278). Bu makineye ait tek ölçümdür. Klonlama, Pocket TTS ses hızı ve Türkçe okuma kuralları değiştirilmedi. Kullanıcının önceki kararı gereği test installer'ı imzasızdır. Bu çalışma çalışan kullanıcı uygulamasını kapatıp yeni kurulumu kendiliğinden yüklemedi; yeni istemci davranışı için 0.5.2 kurulmalıdır.
