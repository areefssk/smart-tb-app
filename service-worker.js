/**
 * Service Worker — ระบบ Smart TB
 * กลยุทธ์:
 * - ไฟล์แอป (HTML/JS/CSS/ไอคอน) : cache-first แล้วอัปเดต cache เบื้องหลัง (ใช้งานได้แม้เน็ตหลุด)
 * - คำขอไปหา Apps Script API (script.google.com) : network-only เสมอ (ข้อมูลผู้ป่วยต้องสดใหม่ ห้าม cache)
 *
 * เพิ่มเวอร์ชัน CACHE_NAME ทุกครั้งที่แก้ไฟล์แอป เพื่อบังคับให้ผู้ใช้โหลดของใหม่
 */

const CACHE_NAME = 'smart-tb-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './javascript.js',
  './stylesheet.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ติดตั้ง: ดาวน์โหลดไฟล์ app shell เก็บไว้ใน cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// เปิดใช้งาน: ลบ cache เวอร์ชันเก่าทิ้ง
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const url = event.request.url;

  // คำขอไปหา Apps Script API — ห้าม cache เด็ดขาด ต้องได้ข้อมูลสดเสมอ
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('script.googleusercontent.com') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function () {
        return new Response(
          JSON.stringify({ ok: false, error: 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต ไม่สามารถโหลด/บันทึกข้อมูลได้ในขณะนี้', offline: true }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // เฉพาะ GET request เท่านั้นที่ทำ cache-first ให้ (ไฟล์ static ของแอปเอง)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return response;
        })
        .catch(function () { return cached; }); // เน็ตหลุด ใช้ของเก่าจาก cache แทน

      return cached || networkFetch;
    })
  );
});
