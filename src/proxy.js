import http from 'http';
import httpproxy from 'http-proxy';

const PORT = process.env.PORT || 8888;
const proxy = httpproxy.createProxyServer({});

const server = http.createServer(function (req, res) {
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
    proxy.web(req, res, {
      target: 'https://api.fastly.com/',
      changeOrigin: true,
      secure: false,
    });
  } else if (req.url.startsWith('/rt')) {
    req.url = req.url.replace(/^\/rt/, '');
    proxy.web(req, res, {
      target: 'https://rt.fastly.com/',
      changeOrigin: true,
      secure: false,
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const response = 'Proxy running...';
    res.end(response);
  }
});

server.listen(PORT, () => {
  console.log(`PXY > Server is listening on port: ${PORT}`);
});
