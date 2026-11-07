# Adres, OTP ve sipariş devamlılığı — 0.8.2 kabul kaydı

## Sonuç ve kapsam

0.8.1 üzerine genel Chrome MCP, yerel hafıza ve şifreli kasa korunarak yerel sipariş teyidi/durum kaydı eklendi. Yeni adres kullanıcı yanıtından kaynaklı kataloğa kaydolur; kayıtlı adres önerilebilir. Siteye uygulanan **adres, görünür ürünler, kargo dahil toplam ve ödeme etiketi her siparişte** aynı sohbet içinde teyit edilir. Kart/parola değerleri mevcut kasa aracında kalır; bu akış yalnız cüzdan/kart etiketini özetler. OTP değeri modele/normal hafızaya gönderilmez.

SQLite gönderim denemesini etkiden önce kaydeder. Hesap/görev/Chrome bağlantısı/profil/sekme/origin bağlanır; sayfa veya tutar değişince eski onay kullanılamaz. Aynı sipariş kimliği yeniden gönderilemez. Etki yanıtı kayıp veya uygulama yeniden başlamışsa modelin sonradan sunduğu metin kilidi açmaz; kullanıcı site ve banka/cüzdan geçmişini yerelde incelemelidir. Yerel çözüm `user-resolved` olarak kaydolur, sipariş başarısı sayılmaz ve yeni ödeme yapmaz.

Normal etki yanıtından sonra `checkout_verify`, önceki sayfada bulunmayan, güncel düzenlenemez sonuç metnini ve içindeki en az dört karakterli/rakam içeren referansı okur. Başlangıç metinlerinin özetleri yalnız RAM'dedir; ham görüntü/sayfa kalıcı kayda alınmaz. `verified`, bu **sayfa sonucunun** gözlemlendiğini belirtir; `financialSettlementVerified:false` açıkça döner. Banka mutabakatı veya her sitenin sonuç anlamı için bağımsız mali kanıt değildir. Model görünen ret/hata sonucunu başarı gibi anlatmamalıdır. Yalnız harfli, kısa veya farklı sayfa/profildeki sonuçlar yerel incelemeye düşer.

## Doğrulanan testler

| Kontrol | Gerçek kapsam ve sonuç |
| --- | --- |
| `npm test` | **440/440** Node testi. Sipariş, gerçek ajan döngüsü, kaynaklı hafıza, hesap, tarayıcı, süreç, Dur/Devam ve mevcut sohbet regresyonları. |
| Konuşma/klonlama | Runtime Python ile `test_turkish_speech.py` ve `test_voice_cloning.py`: **52/52**. Yeni bir mikrofon/insan ses kalitesi ölçümü değildir. |
| `checkout-flow.test.cjs` | Etkiden önce kalıcı kayıt, paralel/tekrarlı gönderim, değişen tutar/adres/ödeme/hedef, eski onay, bağlantı, restart, kayıp yanıt ve yerel çözüm. Modelin `approved:true` iddiası yetki vermez. |
| `checkout-agent.test.cjs` | Gerçek `ComputerAgent` döngüsü ve araç kaydı; kontrollü sağlayıcı ve tarayıcı ile aynı görevde yerel teyit → gönderim → güncel web gözlemi → yerel OTP → sonuç. Modele OTP gitmedi. Canlı bulut model kabulü değildir. |
| `electron-checkout-flow.cjs` | **Gerçek Chrome/MCP**, geçici profil ve yerel test mağazası: yeni adres, kayıtlı adres, 100→101 TL değişiminde eski onayın reddi, cüzdan, yanlış/doğru OTP, görünür referans. İkinci siparişte gerçek click sonrası yanıt kaybı ve restart; tekrar/Enter/native/process engellendi. İki ayrı teyitli test siparişi için toplam iki son etki, tekrar yok. |
| `live-checkout-fixture.cjs` | Mevcut kaynaklı kasa profiliyle gerçek Chrome'a yerel sahte kullanıcı/parola, tek kullanımlık OTP ve çıktı/görüntü gizleme regresyonu geçti. Gerçek hesap kullanılmadı. |
| `electron-checkout-chat.cjs` | Gerçek sohbet UI/IPC: adres/toplam/ödeme özeti, kesin soru kimliği, onay olmayan yanıtta beklemeyi koruma, yerel sesli yanıta eşdeğer metin teyidi, belirsiz sipariş kartı ve yerel çözüm. Buluta mesaj/OTP veya ek ödeme gitmedi. Gerçek STT ölçümü değildir. |
| Arka plan regresyonu | Gerçek Chrome'da diğer sekmeyi seçmeden okuma ve mevcut UID korunması; gerçek Windows'ta diğer iş girdi sahibiyken UIA okuma, odak çalmadan aynı PID/pencereye dönüş ve kalan işi bir kez tamamlama geçti. |

Sohbet UI testinin ilk başlangıç yarışında geliştirme `.venv`'i bulunmadığı için ses runtime uyarısı ve henüz test API'si takılmadan `LOGIN_REQUIRED` kaydı vardır; ardından asıl UI/IPC kontrolleri geçti. Bunlar gerçek giriş/mikrofon kabulü olarak sayılmaz.

Arka plan regresyonunun ilk iki çalışmasında üst üste duran Electron test penceresi UIA'ya eski metin verdi; hata gizlenmedi. Test pencereleri erişilebilirlik açık, arka plan yavaşlatması kapalı ve ayrı konumlarda tekrar çalıştırıldı; tam kontrol geçti. Bu yalnız test düzeneğini deterministik yapar. Başka uygulamanın kapalı/örtülü durumda güncel UIA verisi üretmesi evrensel olarak garanti edilmez; ürün motoru bu turda değiştirilmedi.

## Bağımsız inceleme

Tek bağımsız inceleme, OTP yolunun bilinen son sipariş düğmesini gönderebilmesini, eski adres/sepet metninin sonuç sayılmasını, tamamlanmamış siparişin `done` ile bitirilmesini, sayısal alt dizge eşleşmesini ve `take_snapshot.filePath` ham dışa aktarma yolunu saptadı. RED/GREEN testleriyle kapatıldı. OTP sorusu iptal nesli/bağlantı/kimliğe bağlıdır; güncel alan ve düğme tekrar bulunur. Yeniden bağlantı kimliği eski izin yerine kullanılamaz. Onay bekleyen/gönderilmiş siparişte alternatif browser/native/system mutasyonları kapalıdır; dosyaya snapshot da yazılamaz. Dur/F8 ve yeni işe geçiş eski onayı iptal eder; Vazgeç gönderilmemiş siparişi kapatır. İncelemenin iki küçük notu da düzeltildi: ilk kısmi eşleşme daha sonraki gerçek değeri gizlemez ve eski sonuç testi geçerli rakamlı referansla çalışır. İnceleme sonunda Critical/Important bulgu kalmadı.

Sipariş güvenlik kartları hesap genelindedir; yeni sohbette de çözülmemiş gönderim görünür. Sipariş onayı asıl göreve bağlı kalır. Bu, ayrı bir bilgisayar kontrol sayfası değildir.

## Açık kabul ve sonraki adım

- Gerçek sipariş, banka/kart, dış hesap veya gerçek OTP ile test yapılmadı. Bu turda canlı bulut sağlayıcısının her mağazada bu akışı seçtiği kanıtlanmadı.
- Genel modelin alışveriş olarak hiç bildirmediği bütün eylemleri evrensel biçimde tanıma iddiası yoktur. Koruma, `checkout_review` ile etkinleşen bilinen siparişin yürütme sınırıdır; site/banka tarafında exactly-once garanti değildir.
- Görünür metnin doğru kalemi/son tutarı temsil etmesi ve gerçek sonuç anlamı siteye göre değişir. Sürekli değişen sayfalar yeniden teyit gerektirebilir. Bu aşama tüm siteler/sağlayıcılar için otomatik finansal doğrulama değildir.
- Gerçek saatler, yönetici/SSH süreç parkı, profesyonel uygulamalar, geniş cihaz/çok monitör ve kullanıcı ana cihazındaki ses/etkileşim kabulü açık kalır. Sıradaki mühendislik adımı yönetici/SSH uzun iş sahipliği ve güvenli devam matrisi; 0.8.1 ana cihaz geri bildirimi gelirse önce somut sorun incelenir.

## Paket ve teslim

0.8.2 imzasız test installer hazır. `verify-computer-package`: 76 uygulama dosyası, native yardımcı ve dört konuşma modülü kaynakla aynı. `verify-browser-package`: Chrome MCP 1.12.0 / SDK 1.32.2 ve 361 runtime dosyası aynı. İzole ASAR içinde gerçek DPAPI/katalog/SSH2/izleyici ile kalıcı sipariş gönderiminden önce SQL kaydı, restart ve tekrar engeli geçti; kaynak `node_modules` geri dönüşü yok. Gerçek paket `Umay.exe` ile MCP sunucusu, kapanan Chrome'a yeniden bağlantı, click/readback ve yardımcı süreç çıkışı geçti.

- Ana checkout: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/checkout-0.8.2/Umay Setup 0.8.2.exe`
- Boyut: **378205064 bayt**; blockmap: **392877 bayt**.
- SHA-256: `54aa3999c4f66f4aab80fa21b0263d1aecf48edb215713ec54db99116ceebaa7`
- SHA-512 (latest.yml ile aynı): `u4cKRHFzK1NqnYe7W3fsEdT1vAmWKN/lzDVjIquhvYfQQrqUCT/a/HaMM3BjJLUeOVeovdmKLS9U/8aORwh4jw==`
- Kaynak ve ana checkout'taki dört dağıtım dosyasının (exe/blockmap/latest.yml/verification.json) hash'leri eşleşti. İmza önceki kullanıcı kararına göre ertelidir; test paketi `NotSigned`.
- Önceki 0.8.1 installer SHA-256 değişmedi: `f09ec617b22cda78dab08d658141c5887fabc70ffe1a70292558a63c992ff5a4`.

Kaynak dalı `codex/obsidian-continuity`; teslim commit'i Git kaydında izlenir. Güncel 34 Markdown proje belgesinin kopyaları Obsidian `Umay/Docs` altında tutulur. Önceki 0.8.1 kurulumu korunur; kullanıcı cihazına otomatik kurulum veya genel güncelleme yayını yapılmaz. Sunucu kodu ve üretim sohbet servisi değiştirilmedi.
