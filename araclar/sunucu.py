"""
END214 – lokal test sunucusu (önbelleksiz)

python3 -m http.server tarayıcıya önbellek kuralı göndermez; Safari de CSS/JS dosyalarının
eski halini göstermeye devam edebilir. Bu sunucu her dosyayı "önbelleğe alma" başlığıyla verir.

Kullanım (depo kök klasöründen):
    python3 araclar/sunucu.py          → http://localhost:8000
    python3 araclar/sunucu.py 8080     → başka port
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class OnbelleksizIsleyici(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'END214 test sunucusu: http://localhost:{port}  (durdurmak için Ctrl+C)')
    ThreadingHTTPServer(('localhost', port), OnbelleksizIsleyici).serve_forever()
