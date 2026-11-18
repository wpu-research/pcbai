# PcbAi

Simülasyonda çalışan devreyi sanal laboratuvarda deneyip, yapay zekâ yardımıyla PCB tasarımına ve sipariş sürecine taşımayı hedefleyen web uygulaması (pcbai × MacademiaX). Uygulama `web/` klasöründedir.

## Özellikler
Kod ve sunum metnine göre:
- Üyelik (kayıt/giriş), kullanıcı paneli (yeni proje, atölye, siparişler, hesap)
- Sanal laboratuvar (`src/lib/lab`) ve atölye tasarımının laboratuvara aktarılması
- PCB kütüphanesi: şablonlar, DRC (tasarım kuralı denetimi), üretim (fab) kontrolü, 3D önizleme (three.js)
- Sipariş akışı ve sipariş olayları (durum geçmişi)
- Yönetim paneli: firmalar, projeler, siparişler, üyeler
- Türkçe/İngilizce arayüz sözlükleri
- Yapay zekâ özellikleri için Anthropic SDK kullanılır
- `sunum.html`: ürün tanıtım sunumu; `video/`: tanıtım videoları; `robotix-yama/`: bir yama dosyası

## Teknoloji
Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, three.js / react-three-fiber, Drizzle ORM, PostgreSQL (yerelde PGlite), zod, bcryptjs, `@anthropic-ai/sdk`.

## Kurulum ve çalıştırma
```bash
cd web
npm install
npm run db:local      # yerel PGlite sunucusu (port 5544), ayrı terminalde
npm run dev           # geliştirme sunucusu
npm run build && npm start
npm run db:generate   # Drizzle migration üretimi
```
Şema başlangıç dosyaları `web/drizzle/` altındadır; migration uygulama adımı depoda belgelenmemiştir.

## Ortam değişkenleri
`web/.env.local` dosyasında tanımlanır (git dışıdır). Yalnızca adlar:
- `DATABASE_URL`, `DB_POOL_MAX`
- `SESSION_SECRET`
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (ilk yönetici hesabı)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`
- `NEXT_PUBLIC_LAB_URL`, `NEXT_PUBLIC_LIBRARY_BASE` (isteğe bağlı, kodda kullanılıyor)

## Notlar
`web/README.md` create-next-app şablonudur; proje bilgisi bu dosyadadır.

Lisans: belirtilmemiş (LICENSE dosyası yok).
