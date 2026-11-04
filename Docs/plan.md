# Umay — Windows ve Türkçe Sesli Sohbet Uygulama Planı

> Uygulayıcı: superpowers:executing-plans ile kullanıcı yönlendirmesine göre tek adım
> uygulanır. Bir adımın bitmesi sonraki adımı başlatma yetkisi değildir.

**Tarih:** 2026-11-03
**Durum:** Uygulama başladı. Gerçek teknik kararlar, tamamlanan işler ve açık kabul
koşulları [implementation.md](implementation.md) dosyasında izleniyor.
**Amaç:** Windows'ta doğal Türkçe karşılıklı konuşan; STT/TTS bileşenleri ayarlardan
kurulup kaldırılan ve MP3 referansından ses klonlayabilen kişisel asistan.
**Mimari:** Windows arayüzü, ayrı ses işçisi, değiştirilebilir STT/TTS sağlayıcıları
ve yanıt modeli istemcisi. Ağır ses işlemleri arayüzü kilitlemez. Gelecekte kalıcı
kullanıcı verisinin kaynağı veriussu.com olur.
**Teknoloji:** A0'da seçilecek. Mevcut Django + DRF notu gelecekteki sunucu/API
bağlamı olarak korunur; masaüstüne Django, ORM veya yerel DB kurulacağı anlamına gelmez.
**Gereksinim:** Kullanıcının 2026-11-03 tarihli kapsamı; [chat.md](chat.md).
**Proje kuralları:** Vault `kanun.md`; ilerleme: [walkthrought.md](walkthrought.md).

## 1. Kesin kapsam

- Kullanıcı tüm planın uygulanmasını, test edilmesini ve GitHub'a yüklenmesini başlattı.
  Eski adımlar arası bekleme talimatı son uygulama talebiyle kaldırıldı.
- Güncel teslim kapsamı **yalnızca Windows uygulaması**. Mobil, macOS/Apple M ve diğer
  işletim sistemleri bu sürümde geliştirilmeyecek, paketlenmeyecek veya test edilmiş sayılmayacak.
- Dağıtım adresi `https://umay.veriussu.com`; kullanıcı Windows kurulum dosyasını
  (`setup.exe` benzeri) buradan indirir. Bu, web tabanlı Umay uygulaması değildir.
- Yeni yayımlanan sürümler uygulamaya otomatik güncelleme yoluyla ulaşır.
- Kullanıcı giriş yaptıktan sonra açık çıkış eylemine kadar oturum korunur;
  uygulama/Windows yeniden başlatma ve güncelleme kendi başına çıkış yaptırmaz.
- Türkçe tam karşılıklı sohbet; vurgu, noktalama ve doğal tonlama hedeflenir.
- Konuşmaya başlamadan uzun bekleme olmaması için gecikme ölçülür ve iyileştirilir.
- Ses klonlama: klonlanacak MP3 en fazla 50 MB.
- `Ayarlar / Konuşma`: STT/TTS indirme, kurulum, kaldırma, durum, test ve klonlama.
- Kurulum sonrası hazır bileşenler otomatik etkinleşir; uygulamayı yeniden başlatma gerekmez.
- Yerel kullanıcı/veri DB'si yok; SQLite, ORM ve ikinci hesap sistemi kurulmaz.
- Gelecekte kayıt/giriş veriussu.com'dan, kullanıcı verisi sunucu API'sinden sağlanır.
- Aktif kullanıcının modelleri, sohbetleri ve hafıza kayıtları veriussu.com'dan alınır.
  Sohbetlerden kullanıcıya özel bilgi/kararlar çıkarılır, sunucu hafızasına işlenir ve
  sonraki konuşmalarda ilgili kayıtlar kullanılır.
- Model API notu korunur: `api.veriussu.com`, OpenAI uyumlu endpoint yaklaşımı.
  Gerçek endpoint, yetki ve streaming desteği incelenmeden var kabul edilmez.
- Sunucu ve DB entegrasyonu temel uygulamadan sonra. Şimdi SSH bağlantısı yok.
- Nihai görsel tasarım en son; açık/koyu mod hedefi korunur. Önceki renkler onaylı değildir.
- Kod/yorumlar İngilizce, kullanıcı arayüzü ve proje dokümanları Türkçe.

## 2. A0 kararları ve mimari seçenekler

1. **Python + PySide6 ve ayrı ses işçisi:** Python ses motorlarıyla daha az köprü;
  Windows paketleme/bağımlılık boyutu ve otomatik güncelleme çözümü ayrıca doğrulanır.
2. **Tauri/Electron + TypeScript ve ayrı ses işçisi:** Web arayüzü ve gelecekte ortak
   istemci mantığı için seçenek; süreç iletişimi ve işçi paketleme ek iş getirir.

**Öneri, alınmış karar değildir:** Önce donanım ve motorlar incelensin. Python
motorları baskınsa ilk Windows sürümü için birinci seçenek değerlendirilsin.
A0 sonunda kesin dosya yolları, sürümler ve çalıştırma/test komutları plana eklenir.
Seçilmemiş teknoloji için bağımlılık kurulmaz; bu belge kod yazma yetkisi değildir.

Karara bağlanacaklar:

- Windows sürümü/mimarisi, CPU, RAM, GPU/VRAM ve boş disk.
- STT/TTS için öneri yerel indirilebilir bileşenlerdir. Tam çevrimdışı LLM istenmiş değildir.
- Model/API erişimi ve geliştirme kimlik bilgisi; hesap/DB fazından ayrı bağımlılıktır.
- Paketlerin tüm gerekli çalışma zamanı/çözücü bağımlılıklarını yönetmesi;
  son kullanıcıdan terminal, Python/pip kurulumu beklenmemesi.
- 50 MB için önerilen kesin sınır: **50.000.000 bayt, dahil**. 50 MiB tercihi varsa
  uygulamadan önce sınır ve testler değiştirilir.
- İlk doğrulama bas-konuş; sonra otomatik konuşma sonu algılama. Uyandırma kelimesi
  ve sürekli arka plan dinleme bu ilk kapsama dahil değildir.

### Motor araştırması

STT çalıştırma adayları whisper.cpp ve faster-whisper. Güncel model değerlendirme
önceliği aşağıdaki Türkçe kalite kararıdır; XTTS-v2 tek TTS adayı değildir.
Henüz seçim yapılmadı. Windows'ta kurulum, Türkçe kalite, klonlama, gecikme,
donanım ve dağıtım koşulları incelenerek karar verilir. Tek modele bağımlı mimari kurulmaz.

### 4 GB VRAM hedefi — 2026-11-03 kullanıcı yönlendirmesi

**Yeni gereksinim:** Hafif modeller; 4 GB ekran kartında hızlı, yüksek kaliteli Türkçe
konuşma. Bu bir hedef donanım sınıfıdır; tüm 4 GB kartların aynı hızı vereceği veya
kusursuz kalite sağlayacağı garanti edilmez. GPU modeli/üreticisi, sürücü, CPU ve RAM
A0'da kaydedilir; NVIDIA/CUDA ile AMD/Intel çalışma yolları ayrı değerlendirilir.

- Önceki STT deneme önerisi çok dilli Whisper small/INT8 idi; aşağıdaki Türkçe kalite
  yönlendirmesiyle varsayılan kabulü kaldırıldı. Türkçe için `.en` modeli seçilmez.
- Daha düşük kaynak profili olarak çok dilli Whisper base karşılaştırılabilir;
  küçük olması Türkçe kalite kabulünü otomatik geçtiği anlamına gelmez.
- faster-whisper nicemleme seçenekleri ile whisper.cpp nicemleme biçimleri birbirinin
  aynısı sayılmaz; seçilen motor/donanımın desteklediği biçim gerçek testte doğrulanır.
- XTTS-v2 klonlama adayı olarak kalır; doğrulanmış bir “hafif XTTS” sürümü seçilmiş değildir.
  Türkçe klonlama, düşük VRAM ve ilk ses gecikmesi birlikte tutmazsa başka sağlayıcı
  araştırılır. Desteklenmeyen INT8/FP16/ONNX optimizasyonu varmış gibi yazılmaz.
- STT ve TTS'nin birlikte açık kalabildiği toplam süreç/VRAM bütçesi ölçülür; model
  ağırlık boyutu tek başına yeterli kanıt değildir. Windows ve diğer GPU kullanımı için
  boşluk bırakılır; boş bellek kontrolü ve bellek yetersizliği toparlanması eklenir.
- GPU belleği yetmiyorsa STT'nin CPU/INT8 üzerinde, TTS'nin GPU'da çalışması karşılaştırılır.
  Her turda model boşaltıp yüklemek varsayılan çözüm değildir; ilk ses gecikmesini artırabilir.
- Küçük ses tamponları, VAD, sıcak motorlar, ilk anlamlı metin parçasından TTS ve ses
  profilinin tekrar kullanılan koşullandırma verisiyle hazırlanması değerlendirilir.
- Yerel LLM aynı 4 GB karta yüklenmiş kabul edilmez; mevcut model API yaklaşımı korunur.
- A7/A9 kabulüne gerçek 4 GB GPU üzerinde STT/TTS birlikte test, tepe VRAM/RAM,
  ilk ses p50/p95, klon ses kalitesi ve ses üretiminin gerçek zamandan hızlı olması
  (RTF < 1 hedefi) eklenir. CPU fallback sonuçları ayrı raporlanır.
- “4 GB destekli” ancak gerçek hedef kartta test geçtikten sonra söylenir;
  hız/kalite tutmazsa sonuç kullanıcıya sunulur, sessizce kalite düşürülmez.

### Güncel seçim ilkesi — Türkçe kalite önceliği

Kullanıcı Türkçede en iyi sonucu veren modellerin kullanılmasını istedi. Hafiflik
tek başına seçim nedeni değildir; 4 GB ve hızlı yanıt hedefleri de korunur.
Bu koşullarda evrensel bir birincilik iddiası yerine ortak Türkçe örneklerde kalite,
klon benzerliği, ilk ses süresi ve toplam bellek ölçümüyle seçim yapılacak.

- **STT öncelikli deneme:** `openai/whisper-large-v3-turbo`, donanıma uygun nicemlemeyle.
  `openai/whisper-large-v3` kalite referansı, small düşük kaynak karşılaştırması olur.
  Turbo'yu kesin Türkçe kalite birincisi ilan etmiyoruz; hız/kalite tercihi ölçülecek.
- **TTS/klonlama öncelikli deneme:** `wite-tech/pocket-tts-turkish`.
  Model kartı yaklaşık 110M parametre, 440 MB indirme, Türkçe ses klonlama ve
  streaming bildiriyor. CPU hız rakamları geliştirici ölçümüdür; Windows/4 GB
  cihazımızda doğrulanmış sonuç değildir. Bu model upstream İngilizce Pocket TTS
  ile aynı dil kapsamına sahipmiş gibi ele alınmaz.
- **TTS kalite karşılaştırması:** Chatterbox Multilingual V3 ve XTTS-v2.
  Aynı referans ses ve metinlerle telaffuz, vurgu, doğallık ve benzerlik dinlenecek.
  Türkçe destekli sürüm kullanılacak; Chatterbox'ın İngilizce sürümü karıştırılmayacak.
- Hız ölçümü kötü Türkçe telaffuzu gizlemez; TTS'de yalnızca STT ile ölçülmüş WER
  doğal tonlama veya klon benzerliği kanıtı sayılmaz. Kullanıcının dinleme değerlendirmesi gerekir.
- Daha kaliteli aday 4 GB/hız sınırını karşılamazsa sonuç açıkça sunulur;
  sessizce sunucuya taşıma veya kalite düşürme yapılmaz.
- Hiçbir model indirilmedi, kurulmadı veya test edilmedi. Nihai checkpoint/sürüm
  ve nicemleme biçimi A0/ölçüm sonucu kesinleştirilecek.

Güncel resmi kaynaklar (2026-11-03):

- [Whisper large-v3-turbo model kartı](https://huggingface.co/openai/whisper-large-v3-turbo):
  large-v3'ten hız için sadeleştirilmiş model; kalite ödünleşimi belirtiliyor.
- [Pocket TTS Turkish model kartı](https://huggingface.co/wite-tech/pocket-tts-turkish):
  Türkçe odaklı model, boyut, streaming, klonlama ve geliştirici değerlendirmesi.
- [Chatterbox model kartı](https://huggingface.co/ResembleAI/chatterbox):
  Multilingual V3, Türkçe ve referans sesle üretim.
- [Türkçe TTS değerlendirme araştırması](https://arxiv.org/abs/2610.06057):
  doğallık, anlaşılırlık ve konuşmacı benzerliğinin ayrı ölçütlerle değerlendirilmesi.

Resmi kaynaklar (2026-11-03):

- [whisper.cpp README](https://github.com/ggml-org/whisper.cpp): Windows/yerel STT adayı.
- [faster-whisper README](https://github.com/SYSTRAN/faster-whisper): CPU/GPU ve nicemleme seçenekleri.
- [XTTS-v2 model kartı](https://huggingface.co/coqui/XTTS-v2): Türkçe ve klonlama;
  model kartındaki Coqui Public Model License kullanım/dağıtım seçimi sırasında incelenir.

### Donanım algılama, kalıcı bellek ve barge-in — güncel gereksinim

Kullanıcı GPU'nun otomatik belirlenmesini, GPU yoksa CPU kullanılmasını, STT/TTS'nin
uygulama açıkken bellekte kalmasını ve kendi çıktısından tetiklenmeyen barge-in istedi.
Bu bölüm önceki “önceden hazır tutma” ve isteğe bağlı söze girme ifadelerini güçlendirir:
güvenilir barge-in artık tamamlanma koşuludur. Yalnızca bas-konuş yeterli kabul değildir.

#### Donanım seçimi

GPU markası, işlemci mimarisi, model ağırlığı ve inference motoru ayrı bilgilerdir.
ARM bir GPU markası değildir; Windows ARM ile Apple Silicon/macOS aynı çalışma yolu değildir.
Türkçe model sırf kart markasına göre değişmez; önce aynı modelin uygun çalışma zamanı,
dosya biçimi, hassasiyet/nicemleme profili seçilir. Kaliteyi etkileyen model değişimi görünür olur.

| Sistem | STT çalışma yolu adayı | TTS çalışma yolu adayı |
|---|---|---|
| NVIDIA, destekli sürücü | CUDA: faster-whisper/CTranslate2 veya whisper.cpp | Modelin doğrulanmış CUDA yolu |
| AMD, destekli OS/kart | whisper.cpp Vulkan; uygun kart/sürümde ROCm karşılaştırması | Modelin doğrulanmış ROCm yolu; yoksa CPU |
| Intel/diğer GPU | whisper.cpp Vulkan veya uygun sağlayıcı | Yalnızca modelin test edilmiş yolu; yoksa CPU |
| Apple M, macOS (gelecek) | whisper.cpp Metal | Modelin desteklediği ve test edilmiş MPS/Metal yolu; yoksa CPU |
| Windows ARM64/diğer ARM | Dağıtılabilir ARM64 CPU motoru; GPU ancak test edilmişse | Uyumlu ARM64 CPU motoru veya test edilmiş GPU yolu |
| GPU yok/kullanılamıyor | CPU, uygun nicemleme ve iş parçacığı bütçesi | CPU, bellekte hazır |

Bu tablo her TTS modelinin Vulkan/ROCm/MPS desteklediği iddiası değildir. STT ve TTS
cihaz seçimi ayrı sonuç üretir. CPU'ya dönüşün nedeni ayarlarda görünür; desteklenmeyen
GPU var diye uygulama çökmez. İlk teslim yine Windows; macOS/ARM dağıtımları sonraki
platform fazlarında doğrulanır, Windows testleri bunların çalıştığına kanıt sayılmaz.

Algılama sırası:

1. İşletim sistemi, işlemci mimarisi, RAM ve tüm GPU aygıtlarını keşfet.
2. Her aday için sürücü/çalışma zamanı, motor desteği ve kullanılabilir belleği kontrol et.
3. Ayrı işçide kısa gerçek yükleme/inference sağlık testi yap; marka adına göre hazır sayma.
4. STT ve TTS birlikte bellek bütçesine sığan doğrulanmış profili seç; birden fazla
   GPU varsa kullanılabilirlik/bellek ve kısa ölçümle değerlendir.
5. Destekli GPU yolu yoksa CPU'yu seç. GPU çalışma zamanı çökmesi/bellek hatasında
   kontrollü toparlan ve cihaz geçişini göster; sonsuz yeniden deneme yapma.
6. Seçimi sürücü/motor sürümüyle önbellekle; cihaz/sürücü değişince yeniden doğrula.

#### Modellerin bellekte kalması

- Kurulu ve etkin STT/TTS Umay açılınca bir kez yüklenir ve ısıtma çağrısı yapılır.
  İkisi de sağlık testini geçmeden konuşma “hazır” gösterilmez.
- GPU'da çalışan modeller uygulama açıkken GPU belleğinde, CPU modelleri RAM'de kalır.
  Apple Silicon'da ayrı ekran kartı VRAM'i yerine birleşik bellek bütçesi değerlendirilir.
- Normal turlar arasında veya boşta model boşaltılmaz; her konuşmada tekrar yüklenmez.
  Konuşmayı durdurmak yalnızca üretim/oynatımı iptal eder, modeli bellekten çıkarmaz.
- İki model ve çalışma tamponları birlikte 4 GB hedefte ölçülür; işletim sistemi ve
  diğer uygulamalar için boşluk bırakılır. Sessizce bellek taşması/paging kabul edilmez.
- İkisi GPU'da birlikte sığmıyorsa STT/TTS'nin birini veya ikisini CPU RAM'inde hazır
  tutan profil değerlendirilir; hangi cihazda oldukları gösterilir. Bu, iki modelin de
  VRAM'de olduğu anlamına gelmez. Kalite/hız hedefi tutmazsa açık sınırlama kaydedilir.
- Kullanıcı bileşeni kapatınca/kaldırınca veya Umay kapanınca modeller boşaltılır.
  İşçi arızası veya sürücü resetinde geçici yeniden yükleme ayrı “hazırlanıyor” durumu taşır.
- Hazır tutma model yükleme gecikmesini kaldırır; STT, LLM/ağ ve TTS üretim sürelerini
  sıfırlamaz. “Anlık” hedefi ilk duyulur yanıt ölçümüyle doğrulanır.

#### Barge-in ve kendi sesinden tetiklenmeme

Konuşma oturumu açıkken full-duplex mikrofon/oynatım hattı kullanılır. Mikrofonu TTS
boyunca kapatmak barge-in çözümü değildir; oturum dışında gizli arka plan dinleme yoktur.

1. Umay'ın gerçekten hoparlöre gönderdiği PCM, oynatım referansı olarak AEC'ye verilir.
   Üretilmiş metin veya henüz çalınmamış ses referansın yerine kullanılmaz.
2. Mikrofon ve referans akışlarının saat, örnekleme ve gecikmesi eşlenir; çıkış aygıtı,
   ses seviyesi ve Bluetooth gecikmesi değişince yankı durumu yeniden uyarlanır.
3. Yankı giderilmiş mikrofon üzerinde VAD + çift konuşma/artık yankı denetimiyle
   yakın kullanıcı konuşması doğrulanır. Sadece ses yüksekliği veya VAD yeterli değildir.
4. Kullanıcı konuşması doğrulanınca hoparlör kuyruğu hemen durur/temizlenir;
   eski LLM/TTS işi iptal edilir, yanıt kimliği geçersizleşir. Modeller bellekte kalır.
5. Kısa mikrofon ön tamponu korunur; kullanıcının ilk hecesi kesilmeden STT'ye gider.
   Önerilen başlangıç tamponu 300 ms; barge-in doğrulama penceresi gerçek testte ayarlanır.
6. Geç gelen eski ses/metin yeni tura karışmaz. LLM bağlamına çalınmamış eski yanıt
   tamamıyla söylenmiş gibi eklenmez; kesilen yanıt durumu korunur.

Ses klonu kullanıcının kendi sesiyse konuşmacı benzerliğiyle engelleme kullanıcının
kendisine de engel olabilir. Temel ayrım AEC oynatım referansıdır; metin eşleştirme
veya konuşmacı kimliği tek başına kendinden tetiklenmeme güvencesi sayılmaz.

AEC adayı WebRTC Audio Processing/AEC3'tür; derleme ve dağıtım uygunluğu A0'da doğrulanır.
Ses tanıma/yanıt motoru işleri gerçek zamanlı ses callback'ini bloke etmez.
AEC başarısızsa sorun açıkça görünür, durdur/bas-konuş kontrolü erişilebilir kalır;
güvenilir otomatik barge-in doğrulanmadan A7 tamamlandı sayılmaz.

#### Ek kabul testleri

- GPU yok; bozuk sürücü; desteklenmeyen GPU; iki GPU; düşük boş VRAM;
  desteklenmeyen nicemleme; GPU yükleme hatasından CPU'ya kontrollü dönüş.
- Aynı uygulama oturumunda 20 tur: model yükleme sayacı ilk yüklemeden sonra artmaz;
  konuşma iptali modeli boşaltmaz. Bellek kararlı, sınırsız kuyruk/bellek sızıntısı yok.
- Yalnız Umay konuşuyor: en az 20 ayrı örnek, farklı çıkış seviyeleri ve yankılı odada
  yanlış kesilme sayısı kaydedilir; tanımlı kabul setinde hedef 0 yanlış kesilme.
- Kullanıcı + Umay aynı anda: en az 20 örnekte ilk hece korunur, kullanıcı turu işlenir;
  yakın konuşma doğrulanmasından ses kesilmesine hedef ≤ 200 ms. Gerçek konuşma
  başlangıcından doğrulamaya kadar gecikme ayrıca raporlanır.
- Kulaklık, dahili hoparlör, harici hoparlör, cihaz değişimi/Bluetooth ve klonlanmış
  kullanıcı sesi ayrı denenir. Test edilmemiş aygıt/OS için garanti verilmez.

Resmi teknik kaynaklar:

- [whisper.cpp](https://github.com/ggml-org/whisper.cpp): CPU, CUDA, Vulkan, ROCm ve Apple yolları.
- [CTranslate2 donanım desteği](https://opennmt.net/CTranslate2/hardware_support.html):
  hazır paket ve derleme türüne bağlı donanım desteği.
- [PyTorch MPS](https://docs.pytorch.org/docs/stable/notes/mps.html): macOS hızlandırma yolu.
- [WebRTC Audio Processing](https://webrtc.googlesource.com/src/+/refs/heads/main/api/audio/audio_processing.h):
  capture/render akışları, yankı giderme ve gecikme bilgisi.

## 3. Sorumluluk ve dosya haritası

Önerilen sınırlar aşağıdadır; uzantılar A0'da kesinleşir. Şimdi oluşturulmazlar.

| Konum | Sorumluluk |
|---|---|
| `src/app/` | Windows başlatma, gezinme ve kapanış |
| `src/features/speech-settings/` | Ayarlar/Konuşma ekranı |
| `src/features/conversation/` | Oturum, metin ve ses durumları |
| `src/speech/audio/` | Cihaz, mikrofon, oynatım ve VAD |
| `src/speech/packages/` | İndirme, doğrulama, kurulum, kaldırma |
| `src/speech/providers/` | STT/TTS motor uyarlayıcıları |
| `src/speech/worker/` | Ağır iş, sağlık kontrolü ve iptal |
| `src/speech/hardware/` | Cihaz keşfi, gerçek backend testi ve STT/TTS için ayrı seçim |
| `src/speech/runtime/` | Kalıcı model belleği, ısıtma, kaynak bütçesi ve toparlanma |
| `src/speech/audio/echo/` | Oynatım referansı, AEC, çift konuşma ve barge-in doğrulaması |
| `src/speech/voices/` | MP3 kontrolü ve ses profilleri |
| `src/services/llm/` | Akışlı model istemcisi |
| `src/services/identity/` | Sonraki fazdaki sunucu oturumu; DB bağlantısı yok |
| `src/services/updates/` | Windows sürüm kontrolü, paket doğrulama ve güvenli kurulum |
| `src/services/user-data/` | Kullanıcı modelleri/sohbetler API istemcisi, oturum önbelleği |
| `src/features/memory/` | Bilgi çıkarma, tekilleştirme/çelişki, hafıza getirme/yazma |
| `tests/` | Davranış, akış ve hata testleri |

Ortak sözleşmeler (kesin imzalar A0'da seçilen dile uyarlanacak):

- Paket: `list_packages`, `install_package`, `cancel_install`, `remove_package`, `get_health`.
- STT: ses + dil + iptal → kısmi/kesin metin ve zaman bilgisi.
- LLM: mesajlar + iptal → sıralı metin parçaları ve bitiş nedeni.
- TTS: metin + dil + voice_id + iptal → sıralı ses parçaları, örnekleme biçimi ve bitiş.
  Gerçek streaming yoksa cümle parçalaması kullanıldığı açıkça belirtilir.
- Profil: oluştur, önizle, seç, sil. Her yanıt/iş benzersiz kimlik taşır;
  iptal edilen işin geç gelen parçaları oynatılmaz.
- Ortak hatalar: paket yok, hazırlanıyor, cihaz yok, dosya geçersiz, disk yetersiz,
  ağ/API hatası, motor hatası ve iptal.

### Yerel dosyalar ve verinin sınırı

Önerilen alan `%LOCALAPPDATA%/Umay/`: `settings.json` cihaz/dil/profil tercihleri;
`packages/` motorlar ve modeller; `voices/` klon profilleri; `cache/` geçici dosyalar;
`logs/` teknik hata ve süreler. Bunlar kullanıcı hesabı DB'si değildir.

Sohbet bu fazda bellekte tutulur. Ham ses/sohbet/token/SSH bilgileri varsayılan loglanmaz.
API sırrı gerekiyorsa Windows güvenli kimlik deposunda tutulur, ayar dosyasına yazılmaz.
MP3 bu fazda yerel seçilir/işlenir; sessizce sunucuya yüklenmez. Geçici ses temizlenir;
profil dosyaları yalnızca kullanıcının silme eylemiyle kaldırılır.

## 4. Ayrıntılı uygulama adımları

### A0 — Donanım ve teknoloji kararları

- [ ] Kullanıcı yönlendirmesiyle cihaz profilini ve hedef Windows ortamını kaydet.
- [ ] Kabuk, motor adayları, API erişimi, yerel dosyalar ve MB yorumunu netleştir.
- [ ] Motorların Windows/Türkçe/klonlama/dağıtım koşullarını karşılaştır.
- [ ] Kesin dosya adları, sürümler ve doğrulama komutlarını plana ekle.

**Kabul:** Kullanıcı kararları ve uygulayıcı önerileri ayrılmış; A1 uygulanabilir.
Ürün kodu, kurulum ve model indirmesi yapılmaz.

### A1 — Temel Windows uygulaması

- [ ] Minimum uygulama kabuğunu oluştur; ana ekran, Ayarlar, Ayarlar/Konuşma gezinmesi.
- [ ] Yerel tercih okuma/yazma ve temiz kapanış; konuşma başlangıçta kapalıdır.
- [ ] Açılış, gezinme, eksik/bozuk ayar dosyası ve kapanışı doğrula.

**Kabul:** Windows'ta açılan temel uygulama; DB, hesap, SSH ve nihai tasarım yok.

### A2 — Mikrofon, çıkış ve işçi

- [ ] Cihaz seçimi, mikrofon seviye göstergesi, kısa kayıt/oynatma testi.
- [ ] Mikrofon izin reddi, cihaz çıkarılması/değişimi ve güvenli hata durumu.
- [ ] Ses işçisi başlatma, sağlık kontrolü, iptal, model boşaltma ve kapanış.
- [ ] Donanım/backend keşfi, CPU fallback ve oynatım referanslı AEC hattını kur;
  barge-in için mikrofon/oynatımı aynı anda destekle.
- [ ] Ağır işlemde arayüz tepkisini; durdurmada mikrofonun serbest kaldığını doğrula.

**Kabul:** Kayıt/oynatım gerçek cihazda çalışır; gizli dinleme ve kilitlenen arayüz yok.

### A3 — Ayarlar/Konuşma paket yönetimi

- [ ] STT/TTS için ayrı boyut, alan ihtiyacı, sürüm, indir/kaldır ve test kontrolleri.
- [ ] Durumlar: kurulu değil → indiriliyor → doğrulanıyor → kuruluyor → hazırlanıyor
  → hazır; ayrıca hata, iptal ve kaldırılıyor.
- [ ] Geçici indirme, boyut/bütünlük doğrulama, atomik etkinleştirme ve bağımlılık yönetimi.
- [ ] Kopan ağ, iptal/yeniden deneme, yarım kurulum, yetersiz disk senaryoları.
- [ ] Kaldırmadan ilgili işleri durdur; işçiyi/modeli boşalt; diğer paketi/profilleri koru.
- [ ] Gerçek motor sağlık testi geçmeden hazır gösterme; kurulumdan sonra otomatik hazırla.
- [ ] Her iki modeli birlikte yükle/ısıt; oturum boyunca seçilen GPU/RAM'de hazır tut.

**Kabul:** Terminal kullanmadan kur/kaldır; bozuk paket hazır sayılmaz. STT/TTS hazırsa
ses katmanı otomatik açılır. Gerçek sohbet ayrıca LLM erişimi ister; eksiklik ayrı gösterilir.

### A4 — Türkçe STT

- [ ] Seçilen motoru Türkçe dil ile bağla; mikrofon sesini uygun biçime dönüştür.
- [ ] Bas-konuş ardından VAD ve konuşma sonu algılaması; sessizlik soru başlatmaz.
- [ ] Kısmi metni destekleniyorsa göster; kesinleşmeden LLM isteği gönderme.
- [ ] Türkçe karakter, sayı/tarih, kısa cevap ve arka plan gürültüsünü gerçek sesle dene.

**Kabul:** Gerçek konuşma kullanılabilir Türkçe metne dönüşür; hatalar görünürdür.

### A5 — Model bağlantısı ve Türkçe yanıt

- [ ] Sağlayıcıdan bağımsız istemci ve doğal Türkçe sohbet talimatı.
- [ ] api.veriussu.com sözleşmesi, yetki ve akış desteğini doğrula; DB/hesap eşlemesi yok.
- [ ] Geliştirme erişimiyle gerçek modelden akışlı ve çok turlu metin yanıtı al.
- [ ] İptal, zaman aşımı, bağlantı kopması ve akış ortası hatayı doğrula.
- [ ] Erişim yoksa sözleşme testlerini yap; gerçek sohbet kabulünü beklemede tut.

**Kabul:** Gerçek model yanıtı ve bellek içi bağlam çalışır. Taklit çıktı uçtan uca başarı
sayılmaz. Çevrimiçi LLM kullanılıyorsa sohbet internet gerektirir.

### A6 — Türkçe TTS, noktalama ve tonlama

- [ ] Varsayılan Türkçe sesle kısa metin üretimi ve sıralı ses kuyruğu.
- [ ] Soru/ünlem/virgül/duraklama; tarih, saat, sayı, para ve kısaltma normalizasyonu.
- [ ] Markdown'ı konuşulabilir metne dönüştür; cümleleri anlamlı küçük parçalara böl.
- [ ] Ondalık/kısaltma ortasında yanlış kesme; dolu kuyrukta sınırsız üretimi önle.
- [ ] Motorun desteklemediği vurgu/duygu/SSML yeteneğini var kabul etme.
- [ ] Türkçe doğallığı kullanıcıyla dinleyerek değerlendir.

**Kabul:** Anlaşılır ve uygun tonlu ses; kalite yalnızca otomatik testle onaylanmaz.

### A7 — Karşılıklı konuşma ve düşük gecikme

- [ ] Mikrofon → VAD → STT → gerçek LLM → TTS → hoparlör hattını birleştir.
- [ ] Hazır/dinliyor/metne çeviriyor/yanıt hazırlıyor/konuşuyor/hata durumlarını göster.
- [ ] Tüm yanıt bitmeden ilk uygun parçayı seslendir; motorları önceden hazır tut.
- [ ] Durdur/yeni soru: LLM, TTS, tampon ve oynatımı birlikte iptal et.
- [ ] Oynatım referanslı AEC, VAD/çift konuşma denetimi, ön tampon ve atomik iptalle
  barge-in uygula. Umay'ın kendi sesi veya klon ses benzerliği yanlış kesilme yaratmamalı.
- [ ] Ek kabul setlerini doğrula; AEC eksikse durdur/bas-konuş erişilebilir kalır,
  fakat güvenilir otomatik barge-in olmadan bu adım tamamlandı sayılmaz.
- [ ] En az 20 tur kısa/uzun gerçek sohbette sıra, gecikme ve arayüz tepkisini ölç.

**Kabul:** Karşılıklı Türkçe sohbet; eski yanıt iptal sonrası yeniden başlamaz;
Umay kendi sesini kullanıcı sorusu olarak işlemez.

### A8 — En fazla 50 MB MP3 ile ses klonlama

- [ ] Ayarlara profil adı, MP3 seçimi, boyut, oluştur/iptal/önizle/seç/sil alanları.
- [ ] İşlemeden önce boyut; uzantı yanında gerçek biçim/çözülebilirlik kontrolü.
- [ ] Boş/bozuk/sahte MP3, sessizlik, gürültü ve tek konuşmacı niteliği kontrolü.
- [ ] Uzun MP3'ü tümüyle belleğe almadan çöz; motor kararında süre/çözülmüş ses
  kaynak sınırını belirle ve işleme başlamadan kullanıcıya göster.
- [ ] Uygun referans kesitinden profil üret. 50 MB kabulü dosyanın tamamının eğitime
  girmesi anlamına gelmez. İlerleme/iptal ve başarısız işlem temizliği ekle.
- [ ] Türkçe önizleme ve sonraki gerçek sohbette klon profilinin kullanılması.
- [ ] Yeniden açılış, profil silme ve aktif seçim temizliği; TTS kaldırma profili silmez.
  Motor yoksa profil kullanılamaz gösterilir, yeniden kurulumda sağlık kontrolü yapılır.

**Kabul:** Gerçek klon profilinden Türkçe konuşma. Önerilen bayt sınırı için 49.999.999,
50.000.000 ve 50.000.001 bayt; bozuk dosya, aşırı çözülmüş ses ve iptal testleri.
Ses benzerliği ve tonlama kullanıcı tarafından dinlenerek doğrulanır.

### A9 — Temel Windows sürümünü doğrula ve paketle

- [ ] Dağıtım paketini oluştur; geliştirme araçları olmayan temiz Windows'ta dene.
- [ ] Ses paketlerini kur/kaldır/yeniden kur; alan geri kazanımını doğrula.
- [ ] Yeniden açılış, işçi çökmesi, cihaz/ağ kaybı, bozuk paket onarımını dene.
- [ ] Gerçek performans, donanım sınırı ve kalan sorunları test.md'ye kaydet.

**Kabul:** Yönetilebilir temel Windows sesli sohbet sürümü. Hesap ve tasarım bitti denmez.

#### A9.1 — umay.veriussu.com üzerinden Windows dağıtımı

Kullanıcı kararı: Uygulama `umay.veriussu.com` üzerinden `setup.exe` benzeri kurulum
dosyasıyla indirilecek; yeni sürüm yayımlanınca kurulu uygulamalar otomatik güncellenecek.
Bu aşamada site oluşturma/yayımlama veya sunucuya paket yükleme yapılmaz.

- [ ] A0'da Windows kabuğuyla birlikte bakım gören installer/updater çözümünü seç.
  PySide6 için ayrı updater gerekir; Tauri/Electron seçilirse kendi destekli paket
  formatı/updater'ı değerlendirilir. Henüz biri seçilmiş değildir.
- [ ] İlk Windows hedef sürümü ve işlemci mimarisini kesinleştir; yalnızca gerçekten
  üretilip test edilen Windows mimarilerinin indirmesini sun. ARM algılamak ARM64 paketinin
  mevcut olduğu anlamına gelmez. macOS/Apple M ve mobil paket/link ekleme.
- [ ] Kararlı ürün kimliği/yükleme yolu ile kurulum paketi oluştur. Program dosyaları
  ile kullanıcı ayarı, token, indirilen STT/TTS ve ses profillerini ayrı tut.
- [ ] Yayın çıktısı: sürümlü değişmez kurulum paketi, sürüm notu ve updater'ın beklediği
  manifest/metadata. Sürüm, Windows mimarisi, indirme adresi, bütünlük ve imza bilgisi
  seçilen updater sözleşmesine göre kesinleşir; endpoint varmış gibi davranılmaz.
- [ ] HTTPS indirme ve imzalı güncelleme doğrulaması uygula. Paket hash'i tek başına
  yayıncı kimliği kanıtı değildir; güncelleme imza güven kökü uygulamada bulunur.
  Windows Authenticode kod imzası ile updater imzası ayrı gereksinimlerdir;
  imzalama anahtarları istemciye, loglara veya yayın dizinine konmaz.
- [ ] Yayında önce sürümlü paket ve imzasını yükle/doğrula, manifesti en son atomik değiştir;
  yarım yüklenen sürüm istemcilere teklif edilmez. Bu yayın işlemi ayrı kullanıcı adımıdır.
- [ ] Açılışta ve aralıklarla sürüm kontrolü; indirmeyi arka planda yap. Önerilen kontrol
  aralığı 6 saattir; A0'da kesinleştirilecek. Uygulama kapalıyken güncelleme servisi
  kurulmuş varsayılmaz; yeni sürüm sonraki açılışta kontrol edilir.
- [ ] Doğru Windows mimarisi/sürümü kontrol edilir; paket geçici alanda tam indirilip
  doğrulanmadan kurulum başlamaz. Ağ kopması, disk yetersizliği ve bozuk imza işlenir.
- [ ] Otomatik kurulum aktif konuşmayı veya ses klonlama işlemini kesmez; işler bitince
  durum bildirimiyle güvenli yeniden başlatma yapılır. Windows izin/UAC gereksinimi
  kurulum türüne göre doğrulanır; zorunlu OS izni atlanacakmış gibi vaat verilmez.
- [ ] Kurulum sırasında worker kapanır, mikrofon/çıktı bırakılır; yeniden açılışta modeller
  yeniden yüklenip ısıtılır. Güncelleme boyunca modellerin kesintisiz VRAM'de kalacağı
  vaat edilmez; normal konuşma turları için kalıcı bellek gereksinimi korunur.
- [ ] Kullanıcı ayarları, Windows güvenli depodaki oturum, model dosyaları ve ses profilleri
  korunur. Uyumlu modeller sırf uygulama güncellendi diye tekrar indirilmez.
- [ ] Model/runtime uyumluluğu manifestle kontrol edilir; gerekli paket güncellemesi A3
  paket yaşam döngüsünden yürütülür. Ses modeli güncellemesi installer ile karıştırılmaz.
- [ ] Yarım kurulumda çalışan önceki sürümü koru; açılış sağlık kontrolü başarısızsa seçilen
  updater'ın desteklediği kurtarma/geri dönüş yolunu doğrula. Eski sürümü çalıştırmayı
  bozan ayar değişikliği yapma; sürüm düşürme varsayılan otomatik işlem değildir.

**Kabul:** Temiz Windows kurulumundan sonra vN → vN+1 gerçek update feed ile otomatik
güncellenir; aktif konuşma güvenle tamamlanır. Bozuk/yanlış mimarili paket reddedilir,
eski kurulum çalışır; token, ayar, model ve klon profili korunur. İnternet yokken eski
sürüm açılır; update hatası çıkış yaptırmaz. Nihai kullanıcı oturumu testi A10.5 ile kapanır.

Kaynaklar: [Tauri updater](https://v2.tauri.app/plugin/updater/),
[Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater).
Bu kaynaklar kabuk seçimi değildir; destekli kurulum/güncelleme yolları A0'da karşılaştırılır.

### A10 — veriussu.com hesap ve veri entegrasyonu (sonra)

- [ ] Bu fazda Docs/sunucu.txt'yi sırları loglara taşımadan incele; eksik erişimi kaydet.
- [ ] SSH ile önce salt okunur site dizinleri/API/oturum/şema incelemesi yap.
- [ ] Uygulama–API–DB eşleme alt planını yaz. Masaüstünden DB'ye doğrudan bağlanma;
  DB işlemleri sunucuda, gereken erişim API üzerinden olur.
- [ ] Kayıt/girişi veriussu.com'a bağla; ikinci hesap sistemi kurma.
- [ ] Mevcut sistem uygunsa sistem tarayıcısı + kod/PKCE güvenli dönüşü değerlendir;
  gerçek kimlik sağlayıcı veya endpoint desteğini varsayma.
- [ ] Token saklama/yenileme/çıkış, süresi dolmuş oturum ve farklı hesap veri ayrımı testleri.

**Kabul:** Tek hesap kaynağı veriussu.com; dağıtımda DB/SSH sırları yok.
Sunucu incelemesi ile canlı şema/veri değişikliği ayrı adımlar halinde yürütülür.

#### A10.1 — Aktif kullanıcı modelleri ve sohbetleri

Yeni kullanıcı gereksinimi: veriussu.com'daki aktif kullanıcının modelleri, sohbetleri
ve hafıza tablosu çekilecek. “Modeller” için ilk yorum kullanıcıya yetkili sohbet/LLM
modelleridir; site incelemesinde gerçek anlam/şema doğrulanır. Bu liste yerel STT/TTS
paketlerinden ayrıdır; API modeli seçmek model ağırlıklarını indirmek değildir.

- [ ] Oturumdan aktif kullanıcıyı doğrula. İstemcinin verdiği user_id tek başına yetki değildir;
  sunucu her model/sohbet/mesaj/hafıza nesnesinde kullanıcının yetkisini denetler.
- [ ] Mevcut site/API içinde modeller, sohbetler/mesajlar ve hafıza tablosunu eşle.
  Endpoint/kolon adları varsayılmaz; eksik API için sunucu değişikliği alt planı yazılır.
- [ ] Model kimliği, görünen adı, kullanılabilirliği ve varsa streaming/bağlam yeteneklerini al.
  Yetkisi iptal edilmiş modelde açık durum göster; sessizce başka modele geçme.
- [ ] Sohbet listesini sayfalayarak, seçili sohbetin mesajlarını gerektiğinde çek;
  rol, sıra, zaman ve varsa model/yanıt durumu korunur.
- [ ] Yeni mesajları aynı sunucu sohbetine yaz; işlem kimliği/idempotency ile yeniden
  denemelerin mükerrer kayıt üretmemesini doğrula. Kesilen sesli yanıt durumu korunur.
- [ ] Hesap değişimi/çıkışta önbelleği boşalt, eski istekleri iptal et; oturum nesli
  kontrolüyle eski hesabın geç gelen sonucunu ekrana veya hafızaya yazma.

**Kabul:** Aktif hesaba ait yetkili modeller ve sohbetler alınır; başka hesabın nesne
kimliğiyle okuma/yazma reddedilir. Yerel kullanıcı/sohbet DB'si kurulmaz.

#### A10.2 — Sohbetlerden bilgi ve karar toplama

Kullanıcı gereksinimi: Umay kullanıcı hakkında spesifik bilgi ve kararları toplayıp
sohbetlerde kullanır. Aşağıdaki düzen önerilen uygulama politikasıdır; mevcut hafıza
şemasına uyarlanır, ikinci bağımsız tablo kendiliğinden kurulmaz.

- [ ] Kesin kullanıcı mesajlarından kalıcı tercihler, açık kullanıcı bilgileri, proje
  kararları ve hedefler çıkarılır. Asistan önerisi kullanıcı kararı, soru/alıntı/varsayım
  kullanıcı gerçeği sayılmaz; eksik STT/kesilmiş ifadeden kalıcı kayıt çıkarılmaz.
- [ ] Kayıt türü, normalleştirilmiş içerik, kaynak sohbet/mesaj, zaman ve geçerlilik
  mevcut API alanlarına eşlenir. Tahmin, doğrulanmış bilgi olarak kaydedilmez.
- [ ] Çıkarım şeması ve alan sınırları doğrulanır; erişim anahtarları/parolalar ve
  doğrulanmamış hassas çıkarımlar kişisel hafıza kaydı yapılmaz.
- [ ] Tekrarlanan bilgi tekilleştirilir. Açık yeni düzeltme/karar eskisini geçersiz kılar;
  belirsiz çelişki sessizce üzerine yazılmaz, aday olarak ayrılır.
- [ ] Hafıza çıkarma/yazma sesli yanıtın kritik yolundan ayrılır. Sunucu onayı alınmadan
  “kalıcı olarak hatırladım” denmez. Ağ hatası görünür; yerel kalıcı yazma kuyruğu/DB yoktur.
- [ ] Kullanıcı düzeltme/silme/“unut” istediğinde sunucu ve oturum kopyası güncellenir.
  Unutulan bilgi eski sohbet yeniden işlendiğinde geri üretilmez; yeniden çıkarımı önleyen
  silme/geçerlilik politikası sunucu tarafında saklanır.

**Kabul:** Açık bilgi/karar kaynağıyla doğru hesaba kaydedilir; tekrar, düzeltme ve
unutma tutarlıdır. Asistanın uydurduğu bilgi kullanıcı hafızasına dönüşmez.

#### A10.3 — Hafızayı konuşmada kullanma

- [ ] Girişte küçük profil/tercih özeti ve sürüm bilgisi al; her soruya ilgili hafızayı
  sınırlı bağlam bütçesiyle getir. Tüm tablo/arşivi her LLM isteğine ekleme.
- [ ] Güncel açık kullanıcı talimatı eski hafızadan önce gelir. Eski karar güncel kararı
  ezmez; ilgisiz bilgi yanıta zorla eklenmez. Kaynak/geçerlilik bilgisi korunur.
- [ ] Sohbet/hafıza içerikleri veri olarak ayrı bağlamda işlenir; içlerindeki talimatlar
  uygulama veya yetki kurallarını değiştiremez.
- [ ] Yeni sunucu kaydı onaylanınca oturum önbelleğini tazele; başka cihazdan değişiklikleri
  mevcut sürüm/zaman mekanizmasıyla yenile. Model değişimi hesabın hafızasını kaybettirmez.
- [ ] Hafıza erişimi zaman aşımına uğrarsa beklemeyi sınırla, erişilebilir bağlamla yanıtla;
  kullanıcı bilgisi uydurma. Getirme/yazma gecikmesini ayrı ölç.

**Kabul:** Yeni sohbette doğrulanmış bilgi/kararlar ilgili olduğunda kullanılır;
hesap değişimi/çıkış diğer hesaba bilgi taşımaz. Kalıcılık veriussu.com'dadır.

#### A10.4 — Kabul testleri

- [ ] İki hesapla model/sohbet/mesaj/hafıza yetki izolasyonu; hesap değişirken geç yanıt.
- [ ] Tercih → sunucu kaydı → yeni sohbetten kullanım; tekrar → tek kayıt;
  düzeltme → yeni değer; unut → eski sohbetten yeniden oluşmama.
- [ ] Asistan önerisi, soru, alıntı, belirsiz çelişki, eksik STT gerçek bilgi sayılmıyor.
- [ ] Sayfalama, model yetki iptali, mükerrer yazma, ağ kopması ve hafıza zaman aşımı.
- [ ] Gerçek tablo/API eşlemesi, alanlar ve ölçümler Docs'a kaydedildi.

Yetki referansı: [OWASP nesne düzeyinde yetkilendirme](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).
Bu alt fazlar plan kapsamıdır; sunucu/DB incelemesi veya entegrasyon yapılmadı.

#### A10.5 — Çıkış yapılana kadar kalıcı Windows oturumu

Kullanıcı kararı: Girişten sonra uygulama kendiliğinden çıkış yapmayacak. Hedef,
sunucuda sonsuz ömürlü tek bir access token değil, mevcut oturum mekanizmasıyla
yenilenen ve Windows'ta güvenli saklanan kalıcı giriş deneyimidir.

- [ ] Mevcut veriussu.com oturum/refresh desteğini incele; kısa access token süresinin
  bitmesini kullanıcı çıkışı sayma. Yenileme gereksinimini sunucu/API alt planına işle.
- [ ] Refresh token veya mevcut sistemin eşdeğer oturum sırrını Windows Credential
  Locker/Win32 Credential API ya da kullanıcıya bağlı DPAPI ile koru; parolayı saklama.
  Token settings.json/loglara yazılmaz; yerel DB gerekmez. Kesin depo A0/A10'da seçilir.
- [ ] Yeniden açılışta oturumu geri yükle; token süresi dolmadan veya uygun 401 yanıtında
  tekilleştirilmiş yenileme yap. Varsa token rotation'ı atomik kaydet; eşzamanlı
  isteklerin birden fazla yenilemeyle oturumu geçersiz kılmasını önle.
- [ ] Uygulamayı kapatma, boşta kalma, PC yeniden başlatma ve güncelleme çıkış değildir.
  Ağ kopması, API zaman aşımı, 5xx veya tek başına 403 yerel token silme nedeni değildir.
- [ ] Sunucunun açık iptal/geçersiz refresh yanıtı, hesap kapatılması veya güvenli depoya
  erişilememesinde yeniden giriş gerekebilir. Bunu kullanıcı çıkışı gibi gizleme;
  sebebini göster. Sunucu tarafından iptal edilmiş oturumla erişime devam edilmez.
- [ ] Kullanıcı “Çıkış yap” dediğinde bekleyen sohbet/hafıza işlerini iptal et, yerel sırrı
  ve hesaba ait RAM önbelleğini temizle; destekliyorsa sunucu oturumunu iptal et.
  Çevrimdışı çıkış yerelde hemen gerçekleşir; sunucu iptalinin henüz doğrulanmadığı belirtilir.
- [ ] Kurulum ürün kimliği/güvenli depo anahtarı sürümler arasında sabit tutulur;
  model paketleri ve konuşma ayarları hesap çıkışı yüzünden kendiliğinden kaldırılmaz.

**Kabul:** Giriş → kapat/aç → PC yeniden başlat → güncelle sonrası aynı hesap sürer.
Access token süresi dolması ve ağ hatası gereksiz giriş ekranı açmaz. Açık çıkıştan sonra
otomatik giriş olmaz; sunucu iptali ve hesap değişimi doğru ele alınır.

Kaynak: [Microsoft Windows Credentials Management](https://learn.microsoft.com/en-us/windows/win32/secauthn/credentials-management).

### A11 — Nihai tasarım, en son

- [ ] Çalışan ekranlar üzerinden görsel yönü kullanıcıyla seç; önceki taslaklar onaylı değil.
- [ ] Claude/Vercel/Node.js ve vault tasarım referanslarını yeniden incele.
- [ ] Açık/koyu tema, okunabilirlik, odak, Windows ölçekleme ve tüm durumları tasarla.
- [ ] Görsel değişiklik sonrası konuşma ve paket yönetimini tekrar doğrula.

**Kabul:** Kullanıcının seçtiği Windows arayüzü iki modda. Bu sürümde mobil veya macOS
uygulaması teslim edilmeyecek; önceki platform notları yalnızca gelecek referansıdır.

## 5. Performans ve kalite ölçümü

Bu değerler **önerilen başlangıç hedefleri**, ölçülmüş sonuç veya garanti değildir.
Donanım/motor/ağ seçimi sonrası kullanıcıyla kesinleştirilir.

| Ölçüm | Tanım | Sıcak çalışma önerisi |
|---|---|---|
| Tur kapanışı | Son gerçek sesten konuşma sonu algılamasına | 300–700 ms |
| İlk duyulur yanıt | Son gerçek kullanıcı sesinden ilk anlamlı sesli yanıta | p50 ≤ 2 sn, p95 ≤ 4 sn |
| Durdurma | Kullanıcı durdur eyleminden sesin kesilmesine | ≤ 200 ms |
| Arayüz | İndirme/üretim sırasında | Donmadan yanıt verir |

Son kullanıcı sesi, VAD sonu, STT kesinleşmesi, ilk model metni, ilk TTS parçası
ve ilk duyulur ses ayrı ölçülür. Soğuk başlangıç/model yükleme ayrıca raporlanır.
Normal/klon ses ve donanım profili için en az 20 tur; p50/p95 ve örnek sayısı kaydedilir.
20 Türkçe örnekte soru/ünlem, virgül, uzun cümle, sayı/tarih/saat, özel ad,
konuşma hızı ve gürültü denenir. Anlam korunumu, doğallık ve klon benzerliği ayrı değerlendirilir.
Hedef tutmazsa darboğaz kaydedilir; motor/kalite değişimi kullanıcıyla ele alınır.

## 6. İncelemede öncelikli hata sınıfları

1. Bozuk/yarım paketin hazır görünmesi: A3 bütünlük ve yeniden açılış testleri.
2. İptal sonrası eski sesin gelmesi: A7 iş kimliği ve kuyruk iptal testi.
3. Hoparlör geri beslemesi: A7 gerçek hoparlör/kulaklık testi.
4. MP3 çözülürken bellek/süre taşması: A8 kaynak sınırı ve iptal testi.
5. Ağ/API/oturum kaybı: A5/A10 görünür hata, güvenli tekrar ve hesap veri ayrımı.

## 7. Tamamlama ve kayıt düzeni

Her adım: kullanıcı talimatı → sınırlı değişiklik → ilgili doğrulama → Docs kaydı → sonuç.
plan.md kararları, walkthrought.md güncel durumu, test.md gerçek doğrulama kanıtını,
chat.md yönlendirme/yanıtı, terminal.md son terminal işlemlerini tutar.
Çalıştırılmamış testler başarılı gösterilmez. Her tamamlanmış adımın ardından durulur;
sonraki uygulama kullanıcı yönlendirmesini bekler.

## [2026-11-04] Mikrofon / STT düzeltmesi — 0.1.2
Kapsam: çalışan TTS davranışını koruyarak mikrofon girişini onarmak.
1. Düşük seviyeli ses ve ikinci dinleme açılışını testte yeniden üret.
2. Boşta düşük giriş eşiği, seslendirme sırasında daha yüksek kesme eşiği kullan.
3. Worklet kaydını bir kez yap; mikrofon kaynaklarını kapat; geç açılışı çıkışta iptal et.
4. Mikrofon seviyesi, yakalama ve metne çevirme durumlarını göster.
5. Node/Python, gerçek Electron yapay mikrofon ve düşük seviyeli Türkçe STT kontrolleri.
6. 0.1.2 Windows test installer'ı üret; GitHub kaynaklarını güncelle.
Fiziksel mikrofon/hoparlör geri besleme kabulü ana cihazda yapılacak.

## [2026-11-04] Tarayıcı girişinin zaman aşımı
Başarılı kod exchange HTTP yanıtını gerçek Nest/Fastify katmanında test et;
yanıt yönetimini düzelt; yalnız controller değişikliğini sunucuya dağıt;
sağlık/sınır testleri sonrası mevcut 0.1.2 uygulamayla kullanıcı kabulü iste.

## [2026-11-04] Hesap bağlama tasarımı
Kullanıcı GPT benzeri sade bağlama sayfası istedi. Görsel yön ve uygulama adımları
account-link-design.md'de: aktif hesap satırı, erişim özeti, tek onay düğmesi,
açık/koyu tema, mobil düzen ve oturumsuz giriş/kayıt yönlendirmesi.
Sayfa/component ve client script ayrıldı; mevcut PKCE/exchange sözleşmesi korundu.

## [2026-11-04] Özgün logo ve favicon
Veriüssü sitesinin mevcut V vektörü üst marka ve sağlayıcı işaretine; aynı sitenin
/favicon.svg?v=2 faviconu hesap bağlama/çıkış sayfalarına eklendi.

## [2026-11-04] Referans görselle Windows tasarımı — 0.2.0
Kullanıcının fütüristik Umay kontrol merkezi görseli ana tasarım referansı seçildi.
Uygulama içi Codex benzeri giriş/kayıt karşılaması, koyu turkuaz kontrol merkezi,
yeni sohbet/ayar/hafıza düzeni, gerçek sistem göstergeleri ve Windows simgesi tamamlandı.
Kararlar ve adımlar desktop-design.md'de. Kimlik doğrulama varsayılan tarayıcıda kalır.

## [2026-11-04] Kesintisiz ve canlı Türkçe konuşma — 0.3.0
Kullanıcı açıklaması: tanıma doğruluğu değil, metnin gecikmesi sorun; Jarvis gibi
karşılıklı sürekli konuşma istiyor. Ayrıntılı karar/yol haritası live-speech.md'de.
CPU'da büyük Whisper yerine gerçek akış destekli Seda v0.2 balanced int8 kullanıldı.
100ms taşıma, 320ms model adımı, ayrı STT kuyruğu; TTS motoru korundu.
Metin konuşurken görünür, 600ms duraklamada final gönderilir; mikrofon yanıt sırasında
kapanmaz. Kullanıcı söze girince yanıt iptal edilir, devam eden tanıma sıfırlanmaz.
Eski kurulumlar Ayarlar/Konuşma STT güncellemesiyle geçer. 0.3.0 test installer hazır.

## [2026-11-04] STT / yanıt / TTS regresyonu — 0.3.1
Kullanıcı: tanıma eksik, mesaj gelmiyor, önceden hızlı başlayan seslendirme bekliyor.
Önce gerçek kurulu uygulama durumu ve mevcut sunucu sözleşmesi okundu; model
motorları değiştirilmeden hatalar kırmızı testlerle üretildi.
1. Ham enerji bekleyen run'ı iptal etmesin; yeni tanınmış söz iptal etsin.
2. Oynatım sonrası bastırmayı kaldır; sessiz konuşma partial/final metnini koru.
3. Kuyruk paketini 20ms adımlarla kes; endpoint sonrası yeni kelimeyi kaybetme.
4. Başarısız run'da eski mesajı seslendirme; hata durumunu görünür tut.
5. Native kütüphaneleri Windows ana iş parçacığında başlat; ilk model yüklemelerini sırala.
6. Gerçek mikrofon/STT → renderer gönderimi → run → gerçek TTS → oynatım testini ekle.
Selamlamalarda bilinen Ummay/Hümay hatası yalnız doğrudan hitapta Umay olarak düzeltilir;
başka insan adları ve normal metin değiştirilmez. Yeni model indirmesi gerekmez.

## [2026-11-04] Model yanıtı / gönderim — 0.3.2
Kullanıcı: cevaplar yavaş, gönderilen bazı mesajlara cevap gelmiyor; kaldığın yerden devam.
Canlı sunucuda son beam hataları INVALID_PROVIDER_RESPONSE; gerçek sağlayıcı ve
başarısız sorunun sohbet geçmişiyle yeniden üretim: content boş, search_web tool_call.
Metin endpoint'i bu aracı sunmuyor. Aynı boş isteği yinelemek yerine açık executed=false
araç sonucu ve tek sınırlı final devamı; ikinci araç döngüsünde açık hata. Sorgu çalıştırılmaz.
Sağlayıcı/model/credential anahtarına özel 5dk/200 kayıt önbelleği sonraki turu tek
metin çağrısıyla gönderir. Güncel bilgi doğrulanamadığında model bunu belirtmeli.
Masaüstü: yazılı soru soğuk ses motoru iptalini beklemez; 250ms durum kontrolü ve
sohbette anlaşılır hata. TTS/STT motorları değişmez; sunucu kalite/faturalama korunur.

## [2026-11-04] Kullanıcıya anlaşılır hata mesajları — 0.3.3
Kapsam: Veriüssü 10203 web sohbeti ve Umay Windows. Kullanıcı teknik hata yerine
“Token limitiniz yetersiz” gibi açıklama ve çözüm yönlendirmesi istiyor.
Ortak TR/EN hata kataloğu; HTTP ve run hata kodunu kaybetmeden güvenli eşleme.
Token bakiyesi, dönem limiti ve bekleyen kullanım doğrulaması ayrı mesajlardır.
Webde sohbet altında tek role=alert kartı; yeni çalışan turda/hesap çıkışında temizlenir.
Windows'ta uyarı mesajı sohbet içinde görünür. Kod/ham sağlayıcı yanıtı gösterilmez.
Sunucuda yalnız chat.js/chat.html/chat.css varlıkları değişir; host checkout içindeki
başka mevcut değişiklikleri korumak için çalışan sürüme göre dar git patch uygulanır.
Frontend ve chat imajları kendi çalışan temelinden üretilir; ortam/port eşitliği kontrol edilir.

## [2026-11-04] Doğal Türkçe seslendirme — 0.3.4
Kullanıcı: 4. → dördüncü, TRT → terete; noktalama/vurgu Türkçe kurallarına uygun olsun.
Seslendirme girişinde ayrı Türkçe okuma katmanı; sohbet metni değiştirilmez.
Sıra sayıları: tek başına, liste, açık isim/sıralama bağlamı ve kesmeli ekler.
Cümle sonundaki miktarlar korunur; tarih, saat, binlik ve ondalık sayı ayrılır.
Bilinen harf kısaltmaları Türkçe okunur, kesmeli ek son harfe bağlanır;
TÜBİTAK/ASELSAN gibi sözcük olarak okunan kısaltmalar hecelenmez.
Virgül/noktalı virgül/iki nokta aynı cümlede modele verilir; soru/ünlem korunur.
Nokta180ms, soru220ms, ünlem200ms, üç nokta320ms, satır260ms, boş paragraf320ms
ara PCM sessizlik hedefidir; başta/sonda yapay bekleme yoktur. Bunlar TDK'nin
belirlediği süreler değildir. Ton ve vurgu akustik modelin yeteneğiyle sınırlıdır.
Mevcut pocket-tts-turkish0.1.0 ve klon sesler korunur; yeni model indirilmez.

## [2026-11-04] Klon ses doğallığı — 0.3.5
Kullanıcı: metalik ses, düşük benzerlik ve yapay vurgu birlikte iyileşsin; onaylanan
konuşma hızı, Türkçe okuma ve noktalama ayarları bozulmasın. %100 benzerlik garanti
edilemeyeceği açıklandı; dinleme karşılaştırması kabulün parçasıdır.
Mevcut motorun ilk3–5s kesimi yerine kaynak boyunca uygun kısa sözcük arası seçimi.
Tek sabit kazanç, DC düzeltmesi, faz iptalini önleyen stereo çözümü; perde/hız
değişimi, ağır gürültü filtresi ve dinamik kompresör yok. Referans PCM WAV olarak
saklanır, yeniden kesilmez; özgün MP3 korunur. Kalitesiz örnek anlaşılır uyarı verir.
Profil kimliği ses adı olarak benzersizdir; aynı görünen ad birbirini ezmez.
Eski profil seçilince yerel referans hazırlanır; model yeniden konuşma/seçimde
tekrar kodlanmaz. Yeni profil doğrudan seçilir, önizleme aynı sesi kullanır.
Pocket TTS0.1.0/model/speech text katmanı aynen kalır. Yeni bağımlılık yoktur.

## [2026-11-04] Yanıtın ilk ifadeden sonra kesilmesi — 0.3.6
Kapsam yalnız hata: kullanıcı örneğindeki virgüllü yanıtın devamı okunmuyor.
Önce aynı metin varsayılan ve üç klonla üretildi; WAV'ların geri yazımı son
bölümün de üretildiğini gösterdi. Kurulu Program Files sürümü0.3.5 ve kaynaklar eşleşti.
Renderer testi: oynatılan sesin gecikmeli/yüksek seviyeli dönüşü100ms enerji
eşiğini aşınca stop(true,true) çağrılıyor. Model kesmiyor, mikrofon çıkışı kesebiliyor.
Dar düzeltme: gerçek oynatım PCM'ine göre kısa akustik eşleşme; açık yankı yeni
kullanıcı konuşması sayılmaz. Farklı/üstüne konuşan ses eski barge-in yolunu kullanır.
STT/TTS modelleri, klonlama, Türkçe okuma/duraklama ve sunucu değiştirilmez.

## [2026-11-05] Yerel hafıza, konum/bildirim ve bilgisayar kontrolü — 0.4.0
Kullanıcı üç aşamayı başlattı ve yarıda kalan işin atlanmadan sürdürülmesini istedi.
Önceki yerel DB yok kararı bu açık istekle değiştirildi. Her hesabın ayrı SQLite
hafızası: sohbet arşivi, açık kişisel bilgiler/tercihler, bağlantılı notlar, dosya
yolları, işlem günlüğü, şifreli özel hesaplar. Veriussu merkezi hafızası korunur.
Windows konumu, cihaz saati ve şehir seçimi; MET Norway hava tahmini; AFAD JSON,
USGS Atom, AA ve OGM RSS. Yerel zamanlı kontrol/tekilleştirme ve Windows bildirimi.
Bilgisayar kontrolü: ekran/UIAutomation gözlemi, SendInput klavye/fare, seçili
modelle tek eylemli gözlem döngüsü, durdurma çubuğu/F8, özel hesap parolaları hariç.
Ayrıntılı kararlar ve test sınırları device-features.md içindedir.
