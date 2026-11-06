# Genel kişisel asistan yürütücüsü — 0.7.0

**Son kabul kaydı aşağıdaki “Gözden geçirilmiş teslim” bölümüdür.** Önceki ölçümler ve paket yolları, başarısız denemelerin de korunduğu geliştirme kaydıdır; son paket olarak kullanılmaz.

6 Kasım 2026. Dayanak: `general-assistant-scope.md` ve `general-operator-implementation.md`. Netflix, Chrome ve dosya adları kapsam sınırı değildir. Sohbetten başlayan tek görev, sistem araçları, Chrome MCP ve gerçek Windows girişi arasında geçebilir.

## Uygulanan yapı

- 21 genel araç: bağlı kökleri keşfetme, dosya listeleme/arama/sürüm/okuma/yazma/klasör/kopyalama/taşıma/ad değiştirme/geri dönüşüm/açma; kurulu uygulama keşfi/başlatma; paket arama/kurma/kaldırma; sahip olunan süreçleri çalıştırma/izleme/durdurma ve yerel bekleme. Hedefler gerçek sonuçlardan seçilir; site veya uygulama adına sabitlenmiş liste yoktur.
- Sistem, tarayıcı ve masaüstü aynı görev kimliğini, asıl kullanıcı isteğini, yetkiyi ve iptal neslini paylaşır. Gruplanan 1–5 sistem işlemi arasında iptal kontrol edilir; kısmi işlem makbuzları korunur. Eski sonuçlar yeni hesaba/göreve girdi uygulayamaz.
- İşlem çıktıları sayfalıdır. Son dosya yolları/sürümleri, uygulama ve süreç kimlikleri sonraki yönlendirmelerde kullanılabilir. Deneyim kaydına dosya içeriği, stdout/stderr, argüman veya parola kopyalanmaz. Bu, model ağırlıklarının kendiliğinden eğitilmesi değildir; sonraki görev için gerçek işlem geçmişidir.
- İlk gerçek Windows yetkilendirmesinden sonra yönetici yardımcısı Umay oturumunda tutulabilir. Özel named pipe ve tek kullanımlık bağlantı sırrıyla sistem worker'ı başlar. Normal araçlar normal kullanıcı bağlamında kalır; yalnız gereken işlem `administrator:true` kullanır. Ayarlar → Modeller üzerinden erişim kapatılabilir; hesap değişimi/çıkış bağlantıyı bırakır.
- Durdurma doğrulanmazsa başarı gösterilmez; görev hata açıklamasıyla duraklatılır, yeni iş/devam engellenir ve tekrar durdurma mümkündür. Başlatılan işin sahipliği kaybolmaz. F8 ve yerel sesli durdurma korunur.
- Sunucuda yeni istemci yetenekleriyle genel görev devri, araç sözleşmeleri ve ayrı sınırlı operatör istek kotası vardır. Genel açık işlem isteğinde başlangıç için sohbet modeli beklenmez; asıl istek değiştirilmeden yürütücüye verilir. Normal sohbetin 12/dakika kotası korunur. Operatör başlığı kimlik doğrulama veya model yetkisi sağlamaz.

## Gerçek doğrulama

| Kontrol | Sonuç ve sınır |
| --- | --- |
| Otomatik regresyon | **301/301** geçti. Dosya çakışması/sürüm, junction değişimi, Unicode, kısmi kopya, iptal, hesap değişimi, süreç sahipliği, başarısız durdurma, yönetici yaşam döngüsü ve eski istemci sözleşmeleri dahil. |
| Birleşik web/dosya/süreç | Gerçek Chrome MCP ile dört alanlı kayıt → giriş → sentetik sipariş → indirme → yerel kopya/düzenleme → yükleme → gerçek süreç/bekleme/geri okuma geçti; **6.730 ms**. Bu testte planlayıcı kontrollüdür; bulut modelinin genel becerisi veya gerçek mağazada sipariş kabulü değildir. |
| Gerçek modellerle dosya ve devam | Alfa1.2/Qwen3-VL: Türkçe klasör ve dosya **9.843 ms**, sonraki mesajda kopya ve ad değiştirme **6.793 ms**. Devir **493/247 ms**, model bekleme **8.674/6.044 ms**, gerçek dosya araçları **81/17 ms**. Orijinal dosya ve gerçek içerik doğrulandı; ekran görüntüsü/native giriş kullanılmadı. |
| Gerçek uygulama yaşam döngüsü | Yalnız bu testin oluşturduğu WinForms uygulaması özel installer ile kuruldu, gerçek Start Menu/registry keşfiyle bulundu, açıldı, UIA sınırları üzerinden Türkçe metin girildi/kaydedildi ve kaldırıldı; yeniden keşifte yokluğu doğrulandı. **17.455 ms**. Bu, canlı winget deposundan üçüncü taraf kurulum kabulü değildir. |
| Gerçek Windows girişi | Test pencerelerinde hover, sağ/orta/çift tık, dikey/yatay kaydırma, sürükleme, iki pencere odağı, planlayıcı/girdi/geri okuma ve fiziksel F8 geçti. Yalnız test pencereleri hedeflendi. |
| Ses regresyonu | Gerçek capture → Seda STT → sohbet → görev devri → Pocket TTS geçti; mikrofon açık kaldı. Kontrollü yanıttan ilk ses **103 ms**, ilk çalma **170 ms**. Bulut yanıt süresi bu ölçüme dahil değildir; STT/TTS ve klonlama modelleri değiştirilmedi. |
| Uygulama ayarları | Gerçek Electron arayüzünde Chrome profil modu, gerçek MCP bağlantısı ve durum; kapalı yönetici erişimi ve devre dışı bırakma düğmesi doğrulandı. |
| Yönetici worker | Gerçek native yönetici belirteci → doğrulanmış worker → geçici dosya ve gerçek yüksek yetkili PowerShell süreci geçti. Test ortamı zaten yükseltilmişti; standart kullanıcıdan başlayan ilk UAC etkileşimi bu kabulün kapsamında değildir. |
| Son paket | 57 uygulama dosyası, native yardımcı ve dört konuşma modülü kaynakla aynı. 361 MCP dosyası sabitlenmiş 1.12.0 ile aynı; SDK 1.32.2 paket içinde. Gerçek Umay.exe, proje dışındaki ASAR'dan yönetici worker'ını çalıştırdı; gerçek Chrome kapat/yeniden bağlan/gezinti/tıkla/geri okuma ve yardımcı çıkışı geçti. |

## Testte yakalanan sorunlar

İlk bulut devam görevi aynı aramayı tekrarladı, eksik şemadan kopyalama argümanlarını tahmin etti ve başarısız oldu. Yaygın araç listesi nedeniyle kesilen şemalar yerine **bütün araçların kısa ama tam argüman şemaları** sunuldu; güncel sistem gözleminin oturum bağlamındaki tekrarı kaldırıldı. Kopyalama `source/destination`, yeniden adlandırma `path/name` gereksinimleri regresyona eklendi. Ardından gerçek devam görevi geçti.

Bir bulut denemesi hiçbir araç etkisi oluşmadan **140.005 ms** sonunda sunucuda `CANCELED` oldu. Tekrarı yukarıdaki sürelerle geçti. Bu olayın kök nedeni kanıtlanmadı; başarılı tekrar önceki beklemeyi geçersiz kılmaz. Geniş, tekrarlı p50/p95 veya her uygulama/site için başarı/hız garantisi henüz yoktur.

İlk gerçek uygulama testinde WinForms alanı `Edit` yerine `Pane` olarak geldi. Test, kendi penceresinde gözlenen gerçek UIA sınırlarını kullanacak şekilde düzeltildi. İlk Windows regresyonunda test penceresi ön planda değildi; gerçek kendi pencere kimliğiyle odağa alındı. Farklı kullanıcı penceresine giriş yapılmadı.

Son incelemede doğrulanamayan süreç durdurmanın başarı sayılması bulundu: işlem sahipliği ve hata korunarak yeni etkiler engellendi. Ajan arayüzü de durdurma bitmeden başarı göstermeyecek şekilde düzeltildi; hem durdurma hem duraklatma hatası için regresyon geçti. Dosya ve uygulama katmanlarının ayrı incelemeleri tamamlandı; son bağımsız genel inceleme kullanım sınırı nedeniyle tamamlanamadı, kalan kontrol ve kabul ana ajan tarafından yürütüldü.

## Sunucu

Son geçiş yedeği `/root/umay-reply-1793983829`. Önce ayrı HTTP/PostgreSQL ve gerçek route kota testleri geçti, ardından değişmeyen ortam/port/mount kontrolleriyle frontend ve iki worker güncellendi. İki worker aynı imajda sağlıklı; **10203** proxy sağlıklı. API/public dosyaları, değişmesi beklenen execution/yardımcılar ve yalnız mesaj route kotası değiştirilmiş controller dışında aynı; controller da temel imaja yalnız beklenen kota yaması uygulanarak bayt karşılaştırmasıyla doğrulandı. Canlı planlayıcı ve ortak ayrıştırıcı kaynakla aynı. Kullanıcının model atamaları veya veri şeması bu dağıtımda değiştirilmedi.

## Açık kabul ve sınırlar

- Dosya sürümü giriş metadatasıdır; bütün alt ağacın atomik anlık görüntüsü değildir. Aynı anda dışarıdan değişen her dosyaya OS düzeyinde compare-and-swap garantisi verilmez.
- Yerel taşıma aynı disk ve desteklenen dosya sistemiyle çalışır. EXDEV veya hard-link desteklemeyen FAT/exFAT durumunda kaynak korunur ve kopyala → doğrula → ayrıca yetkili geri dönüşüm adımları raporlanır. Gerçek çıkarılabilir disk/ağ aygıtı matrisi henüz kabul edilmedi.
- Süreç aracı yalnız kendi başlattığı işleri durdurur. Windows taskkill ağaç durdurması kullanılır; bağımsız kopan her alt süreç için Job Object garantisi yoktur. Doğrulanamayan durdurma açık hata olur.
- Canlı üçüncü taraf winget kur/kaldır, standart hesap ilk UAC onayı, çok monitör/oyun/canvas/uzun süreli uygulama yönetimi ve geniş hız dağılımı testleri açık kalır. Genel yürütme yolu vardır; her ürün için kusursuzluk kanıtı yoktur.
- İlk güvenli Windows UAC onayı kullanıcıya aittir; Windows güvenlik ayarları kapatılmaz. Kurulum, daha önce kararlaştırıldığı gibi imzasız test sürümüdür.

## Teslim

Paket dizini: `dist/general-0.7.0-release/win-unpacked`. Son installer: `dist/Umay Setup 0.7.0.exe`, **351.739.460 bayt**, SHA256 `49015a614e73e11902d1437a19653d43a90a593a8e6a83358671e052706f6862`. SHA512/boyut `latest.yml` ile eşleşir; blockmap vardır. Son kaynaklarla yeniden üretilen doğru dizin `dist/general-0.7.0-release` olup önceki ara installer teslim edilmez. Kullanıcı uygulaması kapatılıp kendiliğinden kurulmadı; genel güncelleme sunucusuna installer yayımlanmadı. GitHub kaynak teslim sonucu aşağıya eklenecek.

### Son inceleme ve biçim düzeltmesi

Tekrarlı bulut kabulünde 115.188 ms süren başka bir ilk görev ve yanlış üst/alt klasör yorumu da görüldü; beklenen kökte olmayan dosya başarılı kabul edilmedi. Devam testinin yönlendirmesi, önceki mesajdaki geçici kökü ve alt klasörün dışını açıkça belirtecek şekilde netleştirildi. Ardından bir tekrar iç içe `nextAction` ve bozuk JSON argümanlarıyla başarısız oldu. Bunlar model/amaç yorumunun bütün görevlerde doğrulandığı iddiasına engeldir.

Aynı gerçek planlayıcı girdisiyle sağlayıcı tanısında şema biçimi 5.256 ms sonunda 1.024 çıktı token sınırına ulaşıp geçerli eylem veremedi. Basit JSON nesnesi biçimi 547 ms, serbest biçim 823 ms içinde geçerli eylem döndürdü. Genel sistem yeteneğini bildiren yeni istemciler için ilk biçim `json_object` yapıldı; desteklenmezse tek kademede biçimsiz JSON talimatına dönülür. Eski istemcinin şema müzakeresi korunur. Yerel geçerli eylem, JSON argümanı, yetki/iptal, sürüm ve kısmi işlem kontrolleri kaldırılmaz. Yeni biçim izole gerçek HTTP/PostgreSQL kabulünden geçti; son geçiş yedeği `/root/umay-reply-1793985711`. Bu karşılaştırma her uzun beklemenin tek kök nedeninin şema olduğunu kanıtlamaz.

Hesap değişimi/kapanışta eski durdurma reddinin işlenmeyen hataya dönüşmesi engellendi; durduğu doğrulanamayan görevde Devam düğmesi gösterilmez. Son Windows kaynakları bu değişikliklerden sonra yeniden paketlendi.

Basit nesne biçiminin ilk canlı tekrarı klasör/dosya işini 7.326 ms içinde tamamladı; devamda model `action` yerine `nextAction` metin alanı döndürerek istemci doğrulamasından geçemedi. Sunucuda yalnız eylem alanı eksikken, `nextAction` bir metinken ve kayıtlı protokol eylemini açıkça belirtiyorken aynı eylemi `action` anahtarına taşıyan uyumluluk eklendi. Argüman, yetki ve işlem sayısı değiştirilmez; iç içe nesneler, onaylar, eylem zincirleri veya bilinmeyen adlar açılmaz. Hem olumlu/olumsuz birim hem gerçek HTTP taşıma testi vardır.

Chrome ile birleşik ilk bulut denemesi de modelin protokol sarmalayıcısı yerine `action:fill, toolName:fill` dönmesiyle durdu. Uyarlama güncel istemci gözlemindeki kayıtlı araçlara genişletildi: yalnız eylem ve araç adı birebir aynı, argüman metni mevcut, ilgili yürütücü o aracı ve sarmalayıcı eylemi gerçekten bildiriyor ve başka koordinat/iç içe eylem yoksa aynı çağrı `browser_tool`/`system_tool` biçimine alınır. Araç adı listesi site/ürün örneklerinden oluşmaz; güncel registry/MCP keşfidir. Eşleşmeyen/bilinmeyen/çelişkili çağrı değişmez ve yerelde reddedilir.

İlk alias adayının HTTP kabulü, uyarlama çağrısı execution modülüne uygulanmadığı için başarısız oldu; canlıya alınmadı. Dar execution yaması düzeltildi ve gerçek HTTP testinde scalar aliasın taşıma öncesi canonical biçime geldiği doğrulandı. Son aday worker/frontend testleri geçti; yedek `/root/umay-reply-1793986361`.

### Son birleşik kabul ve hız incelemesi

Araç şemaları etkin yürütücüye ayrıldı: tarayıcı/native görünümünde kısa sistem köprüsü, `system_start` sonrasında gerçek tam sistem şemaları vardır. Uzun artifact listelerinde önce eski bağlam kayıtları çıkarılır; gerçek yollar kesilmez, kayıtçı/hafıza kaydı korunur. Bu değişiklikten sonra gerçek modellerle Chrome formu → gerçek fetch → dosya yazma/geri okuma geçti: **90.939 ms**, bunun **87.707 ms** kısmı model beklemesiydi; hızlı kabul edilmedi. Sonraki tekrarı zaman aşımına gitti.

Tur ölçümünde normal kararlar 1,3–3 saniye ve 42–140 çıktı token iken, form sonrasındaki bir karar **4.170 çıktı token / 68.863 ms** üretti. Aynı girdide bir tanı çıktısı `body > div > div ...` biçiminde uydurulan CSS seçicisini tekrar ederek 1.024 token sınırına ulaştı. Dolayısıyla biçim değişikliği tek başına çözüm değildir. Tarayıcı yönergesi, güncel snapshot metnini gerçek sonuç kanıtı sayacak, gerekmedikçe script okumayacak ve uydurma seçici zincirleri kullanmayacak şekilde netleştirildi.

Yeni genel istemcide ilk tek işlem çıktısı **en çok 1.024 token** ister; mevcut token rezervasyonu/muhasebesi ve uzun içerik gerektiğinde tam çıktı bütçesiyle yeniden deneme korunur. Kesilen yanıtta modele yalnız en küçük sonraki işlemi, gerçek snapshot/DOM kanıtını ve kalan görev için yürütücü geçişini kullanması hatırlatılır. Normal web sohbeti ve eski istemci bütçesi değişmez. Gerçek HTTP/PostgreSQL testinde ilk sistem yanıtı bilerek kesildi; düşük ilk bütçe, büyük yeniden deneme, son tek canonical işlem ve arşivleme doğrulandı. Son aday worker/frontend kabulü geçti: `/root/umay-reply-1793987642`.

### Yapılandırılmış gerçek araç çağrısı

Metin içinde iki kere JSON kodlatma yaklaşımı yeterli olmadı: düşük çıktı bütçesi çağrı başına beklemeyi azaltmasına rağmen bir birleşik deneme 25 tarayıcı adımında tekrara girdi. Alfa1.2 ile ayrı operatör denemesi de bu yolu güvenilir biçimde tamamlamadı; kullanıcının kurulu uygulamadaki model atamaları değiştirilmedi.

Yeni genel istemcide model, güncel sistem/MCP şemalarından üretilen gerçek sağlayıcı fonksiyonlarını kullanır. Araç argümanları metin içine tekrar kodlatılmaz; sunucu yalnız doğrulanmış çağrıyı aynı yerel işlem protokolüne çevirir ve **hiçbir cihaz işlemi sunucuda çalıştırılmaz**. Güncel kayıt dışında isim, bozuk/çoklu bağımlı tarayıcı çağrısı reddedilir. Birden fazla bilinen sistem çağrısı en çok beşli mevcut sıralı/iptal denetimli gruba çevrilebilir. Yönetici bayrağı aynı gerçek yerel Windows iznine tabidir.

Sağlayıcı `tools` özelliğini reddederse sınırlı süre için önceki JSON yolu kullanılır; eski istemci aynı yolda kalır. Yeni biçimle özel tanıda Qwen3-VL uydurma div zinciri yerine gerçek `document.body.innerText` çağrısı verdi: **2.672 / 1.167 ms, 39 çıktı token**. Bunlar yalnız karar tanısıdır, tam görev süresi değildir.

Native araç şemaları sağlayıcının araç arabirimine taşınırken kullanıcı mesajındaki yinelenen şemalar çıkarılır. Mesaja sonradan eklenmiş gerçek bağlam ve görüntüler korunur; kaynak kullanıcı mesajı mutasyona uğramaz. Bu ek bağlamı önce düz JSON sanan izole test başarısız oldu; önek dönüşümü ve bağlamı koruyan regresyon düzeltildi. Testte artan makine mesajları, gerçek uygulamadaki gibi operatör başlığını kullanır; normal kullanıcı kotası değiştirilmedi. Son birim kabulü **301/301**. Son native HTTP ve canlı kabul sonucu aşağıya eklenecek.

Native araç protokolü için izole HTTP/PostgreSQL kabulü de geçti: gerçek fonksiyon çağrısı aynı canonical yerel eyleme çevrildi; bilerek kesilen yanıt tam bütçeyle yeniden denendi; `tools` reddeden sağlayıcı JSON yoluna döndü; kullanıcı bağlamı ve arşiv/muhasebe akışı korundu. Üretimdeki provider modülüne müdahale edilmedi; sağlayıcının varsayılan araç seçimi kullanılır. Son aday worker ve gerçek frontend testleri geçti; native dağıtım yedeği son aktivasyon kaydına göre teslim bölümüne eklenecek.

## Gözden geçirilmiş teslim

Son kaynak kabulü **307/307 otomatik test**. Son doğru istemci dizini `dist/general-0.7.0-reviewed/win-unpacked`; önceki `final` ve `release` dizinleri ara üretimdir. Bu dizinde 57 uygulama dosyası, native yardımcı, dört konuşma modülü ve 361 MCP dosyası eşleşmesi; gerçek paketlenmiş Umay.exe üzerinden proje dışı Chrome MCP ve yüksek yetkili worker kabulü geçti. Son installer hash/boyut ve canlı ölçümler aşağıda tek teslim kaydında belirtilecektir.

Native araç çağrısında güncel gözlem ayrı araç verisine taşınır. Hemen önceki gerçekten denenmiş eylem ve gerçek dönüş sonucu eşleşiyorsa, aynı fonksiyon çağrısı ve sonucu sağlayıcının normal araç geçmişine eklenir. Gerçek bir mutasyon veya başarı uydurulmaz; hatalar da aynen hata olarak taşınır. Önceki metin protokolünün tekrara girdiği tanıda bu yapı doğru `source/destination` ile `files_copy` çağrısını **1.086 ms** içinde üretti. Canlı klasör/dosya ve sonraki mesaj kabulü **8.666 / 14.872 ms** ile geçti. Birleşik web işi, JavaScript ifadesinin işlev bekleyen alana yalın metin verilmesi yüzünden soru aşamasında kaldı ve başarılı sayılmadı. MCP parametre açıklamaları/varsayılanları korunur; `format:function` ve `format:script` ayrımı açık verilir, kod kendiliğinden farklı anlamla çalıştırılmaz.

Bağımsız son inceleme (`native_transport_review`) önceki aynı adlı aracın başarılı sonucunun sonraki başarısız girişime yanlış bağlanabildiğini buldu. BrowserMcp hem başarılı hem başarısız girişimi özgün argüman hash'iyle kaydeder. SystemTools da güncel gözleme ait sürüm/parametre doğrulama hatasını hash ile kaydeder; eski hesap/görev gözlemi yeni hesabın sonucuna yazamaz. Sunucu eşleştirmede hem araç adı hem argüman hash'i ister; eşleşme yoksa yalnız gerçek okunmuş gözlem verilir. Güncel hata eski başarı olarak gösterilmez.

İki Important bulgu düzeltildi. İnceleyici özgün stale-system ve failed-repeat-browser örneklerini tekrar çalıştırdı; **31 odak testinde** geçti ve bu kapsamda kalan Critical/Important bulgu olmadığını bildirdi. Bu inceleme canlı UI veya bütün ürün kapsamının kabulü değildir. Gözden geçirilmiş sunucu adayında gerçek HTTP/PostgreSQL ve frontend kabulü geçti; yedek `/root/umay-reply-1793995235`.
