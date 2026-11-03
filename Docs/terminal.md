# Terminal Kayıtları

## Log 1 — Ortam İncelemesi
Komut: `Get-ChildItem -Force`
Amaç: Çalışma dizini durumunu görmek.
Sonuç: Dizin boş, yalnızca `.claude/settings.local.json` var.

## Log 2 — Docs Oluşturma Doğrulaması
Komut: `Get-ChildItem Docs`
Sonuç: 5 dosya oluşturuldu.

## [2026-11-03] P0 — Planlama işlemleri

- Get-ChildItem ve rg --files: mevcut Docs dosyaları ve ürün kodunun yokluğu incelendi.
- Get-Content: plan.md, walkthrought.md, chat.md, test.md, terminal.md okundu.
- Planlama ve doğrulama beceri dosyaları okundu; vault kanun.md Obsidian MCP ile okundu.
- Resmi whisper.cpp, faster-whisper ve XTTS-v2 kaynakları web üzerinden incelendi.
- apply_patch ilk çağrısı aynı hedefe sil/ekle birleşimi nedeniyle reddedildi;
  dosya değişmedi. Güncelleme yamasıyla plan ve yol haritası başarıyla yazıldı.
- Python standart kütüphanesiyle 7 doküman/kapsam kontrolü çalıştırıldı: 7 PASS, çıkış 0.
- Doküman doğrulaması ve sohbet/terminal kayıtları güncellendi.
- sunucu.txt içeriği okunmadı. SSH, DB, model indirme ve bağımlılık kurulumu yapılmadı.

## [2026-11-03] P0 — Model seçimi sorusu
Get-Content ile chat.md, plan.md ve walkthrought.md kontrol edildi.
Sonuç: STT/TTS seçilmemiş; yalnızca adaylar var. Sohbet kaydı güncellendi.
Uygulama adımı başlatılmadı; P0 durumu değişmedi.

## [2026-11-03] P0 — 4 GB hedefi
Get-Content ile mevcut proje kayıtları okundu. Resmi faster-whisper,
whisper.cpp ve XTTS-v2 kaynakları kontrol edildi. apply_patch ile plan ve
walkthrought güncellendi; Python doküman kontrolü 5 PASS (çıkış 0).
Sohbet ve test kayıtları eklendi. Model indirilmedi, ürün kodu yazılmadı.

## [2026-11-03] P0 — Türkçe kalite araştırması
Get-Content ile proje kayıtları okundu. Resmi model kartları ve Türkçe değerlendirme
araştırması web üzerinden incelendi. apply_patch ile plan/walkthrought güncellendi.
Python doküman kontrolü PASS, çıkış 0. chat/test kayıtları eklendi. Kurulum yapılmadı.

## [2026-11-03] P0 — Donanım ve barge-in kapsamı
Get-Content ile proje kayıtları okundu. Resmi whisper.cpp/CTranslate2/PyTorch MPS
ve WebRTC APM kaynakları incelendi. apply_patch ile plan ve walkthrought güncellendi.
Python doküman kontrolü 6 PASS, çıkış 0. Sohbet/test kayıtları eklendi.
Ürün kodu yazılmadı; donanım probu, model indirme veya ses benchmark'ı yapılmadı.

## [2026-11-03] P0 — Kullanıcı modelleri/sohbet/hafıza
Get-Content ile ilgili kayıtlar okundu; OWASP nesne yetkilendirme kaynağı incelendi.
İlk yama beklenen satır eşleşmediği için uygulanmadı; sıralı yama ile plan ve
walkthrought güncellendi. Python kontrolü 5 PASS, çıkış 0. Sohbet/test kayıtları eklendi.
SSH/API/DB bağlantısı ve ürün kodu yok.

## [2026-11-03] P0 — Windows dağıtım ve oturum
Get-Content ile mevcut kayıtlar okundu. Resmi Tauri/Electron updater ve Microsoft
kaynakları incelendi. apply_patch ile plan/walkthrought Windows-only kapsamı,
A9.1 dağıtım/update ve A10.5 kalıcı oturum alt adımlarıyla güncellendi.
Python doküman kontrolü 7 PASS, çıkış 0. Sohbet/test kayıtları eklendi.
Kodlama, installer üretimi, imza veya canlı yayın/sunucu değişikliği yok.

## [2026-11-03] Uygulama terminal işlemleri
Git development deposu oluşturuldu. uv Python 3.12/venv, pip lock ve npm lock kuruldu.
SSH salt okunur inceleme: NestJS auth/chat/memory API sözleşmeleri; parola yıldızları
korununca giriş başarılı. Canlı sunucu dosyası/DB değiştirilmedi.
Node test 10 PASS, Python test 3 PASS, Electron pencere smoke PASS, runtime import PASS.
Gerçek TTS/STT CPU turu ve 3 sentetik sıcak ölçüm yapıldı. İlk yanlış model repo adı
resmi dönüşüm kartından doğrulanıp Dropbox Dash repo adıyla düzeltildi.
NSIS paket üretimi, özel GitHub repo oluşturma ve sır taraması yürütüldü.
Docs/sunucu.txt, .superpowers, .venv, runtime, model dosyaları Git dışında.

## [2026-11-03] GitHub ve son düzeltmeler
Özel Karam4ns/Umay deposuna kaynaklar yüklendi. Git tree toplu yazması reddedildi;
dosyalar Contents API ile ayrı commit'lerle gönderildi. Workflow yolu 404 döndü,
bunun yerine scripts/windows-workflow.yml şablonu yüklendi. Gerçek CI koşusu yok.
Son hesap/iptal regresyonu düzeltildi: Node 11 PASS, Python 3 PASS, Electron smoke PASS.
Sentetik MP3 ile klon oluştur/seç/sil gerçek testi PASS. Installer son kaynaklarla yenileniyor.

## [2026-11-03] Son paket doğrulama
NSIS installer 357193787 bayt; SHA256 test.md'ye kaydedildi. asar içindeki renderer
ve paketlenmiş worker kaynaklarla eşit. Paketlenmiş Python worker status testi PASS.
Git temiz, sunucu.txt ignored. Son kayıtlar GitHub Docs'a eşitlenecek.
