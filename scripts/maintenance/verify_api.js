const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/lines',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            const jsonData = JSON.parse(data);
            console.log('Number of lines:', jsonData.length);
            if (jsonData.length > 0) {
                console.log('First line sample:', jsonData[0]);
                console.log('Status of first line:', jsonData[0].status);
            }
        } catch (e) {
            console.log('Response is not JSON:', data.substring(0, 100));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
